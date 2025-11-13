import { LlmModel, UtteranceInfo, EntityInfo, Intent } from "../model/llmModel";
import { cache } from "../globalClient";
import * as Utils from "../utils";
import { ExpenseModel } from "../model/expenseModel";
const CONF_THRESHOLD = 0.3;

export class ChatController {
  async handleChat(userId: string, utterance: string) {
    console.log("Handling chat for user:", userId, "utterance:", utterance);
    const cacheKey = `chat_${userId}`;
    const unfilledFrames = (
      cache.get(cacheKey) as ExpenseFrame[] | undefined
    )?.filter((f) => f.ttl > 0);

    unfilledFrames?.forEach((f) => --f.ttl);

    const utteranceInfo: UtteranceInfo = await new LlmModel().parseUtterance(
      utterance
    );

    // handle low confidence with no intent, when there's no unfilled frames
    // fallback to add_expense
    if (!unfilledFrames) {
      if (
        // intent = add-in
        utteranceInfo.confidence < CONF_THRESHOLD &&
        utteranceInfo.intents.length == 0
      ) {
        utteranceInfo.intents = ["add_expense"];
        utteranceInfo.entities.forEach((e) => (e.intent = "add_expense"));
      }
    }

    let { doableFrames, incompleteFrames } = this.groupFrameByActions(
      utteranceInfo,
      unfilledFrames
    );

    const TURN_TO_LIVE = 1;

    incompleteFrames = incompleteFrames
      .map((f) => ({ ...f, ttl: f.ttl ?? TURN_TO_LIVE }))
      .filter((f) => f.ttl > 0);
    const ret = await this.executeFrames(userId, doableFrames);

    doableFrames = doableFrames.map((f) => ({ ...f, ttl: undefined }));

    // Save incompleteFrames to cache and generate message asking for more info
    let message = null;
    cache.del(cacheKey);

    if (incompleteFrames.length > 0) {
      cache.set(cacheKey, incompleteFrames);
      message = this.generateMissingInfoMessage(incompleteFrames);
    }

    return { doableFrames, incompleteFrames, message, ret };
  }

  groupFrameByActions(
    utterance: UtteranceInfo,
    initFrames: ExpenseFrame[] = []
  ): any {
    let lastChatFrames: ExpenseFrame[] = initFrames;

    let idx = 0;
    for (const frame of lastChatFrames) {
      while (
        !Utils.isFrameEnough(frame) &&
        idx < utterance.entities.length &&
        utterance.entities[idx]?.intent === frame.intent
      ) {
        const mappedKey = this.mapEntityKeyToFrameKey(
          utterance.entities[idx].key,
          frame.intent
        );
        frame[mappedKey] = utterance.entities[idx].text;
        idx++;
      }
    }

    let newFrames: ExpenseFrame[] = [];

    for (const entity of utterance.entities.slice(idx)) {
      const mappedKey = this.mapEntityKeyToFrameKey(entity.key, entity.intent);
      const last = newFrames[newFrames.length - 1];
      if (
        last &&
        last.intent === entity.intent &&
        last[mappedKey] === undefined // ✅ only merge if key not set
      ) {
        last[mappedKey] = entity.text;
      } else {
        // create new frame
        const newFrame: ExpenseFrame = {
          intent: entity.intent,
          [mappedKey]: entity.text,
        };
        newFrames.push(newFrame);
      }
    }

    let totalList = [...lastChatFrames, ...newFrames];
    let doableFrames = totalList.filter((f) => Utils.isFrameEnough(f));
    let incompleteFrames = totalList.filter((f) => !Utils.isFrameEnough(f));

    // add intents with no entity as incomplete frames
    const intentsWithNoEntity = utterance.intents.filter(
      (intent) =>
        intent != "none" && !utterance.entities.find((e) => e.intent === intent)
    );
    for (const intent of intentsWithNoEntity) {
      incompleteFrames.push({ intent });
    }

    // post-process date and location
    this.applySharedKeyToFrames(doableFrames, "date");
    this.applySharedKeyToFrames(doableFrames, "location");

    return { doableFrames, incompleteFrames };
  }

  applySharedKeyToFrames(frames: ExpenseFrame[], key: string) {
    let i = 0;

    while (i < frames.length) {
      const intent = frames[i].intent;

      // collect a block of continuous frames with the same intent
      let j = i;
      while (j < frames.length && frames[j].intent === intent) {
        j++;
      }

      // process this block only
      const block = frames.slice(i, j);
      const indices = block
        .map((f, idx) => (f[key] ? idx : -1))
        .filter((idx) => idx >= 0);

      if (indices.length === 1) {
        const v = block[indices[0]][key];
        block.forEach((f) => (f[key] ??= v));
      } else if (indices.length > 1) {
        for (let k = 0; k < indices.length; k++) {
          const cur = indices[k];
          const prev = indices[k - 1] ?? -1;
          const next = indices[k + 1] ?? block.length;
          const v = block[cur][key];

          for (let m = prev + 1; m < next; m++) {
            block[m][key] ??= v;
          }
        }
      }

      // move to next block
      i = j;
    }
  }

  executeFrames = async (userId: string, frames: ExpenseFrame[]) => {
    const expenseModel = new ExpenseModel();

    // Spread frames by date range into one frame per day with Date objects
    // Exception: search_expense and stat_expense don't spread, keep date range as criteria
    const spreadedFrames: ExpenseFrame[] = [];
    for (const frame of frames) {
      // Don't spread search_expense and stat_expense - they use date ranges in criteria
      if (
        frame.intent === "search_expense" ||
        frame.intent === "stat_expense"
      ) {
        spreadedFrames.push(frame);
        continue;
      }

      const dateKeys = ["condition_date", "target_date", "date"];
      const foundKey = dateKeys.find((k) => frame[k]);
      if (!foundKey) {
        spreadedFrames.push(frame);
        continue;
      }

      const raw = String(frame[foundKey]);
      const r = Utils.parseDateRange(raw);
      // Per design, parseDateRange returns a range; if not, default to today
      const startIso = r?.start || new Date().toISOString().slice(0, 10);
      const endIso = r?.end || startIso;
      const start = new Date(startIso + "T00:00:00Z");
      const end = new Date(endIso + "T00:00:00Z");
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        spreadedFrames.push(frame);
        continue;
      }

      for (
        let d = new Date(start.getTime());
        d.getTime() <= end.getTime();
        d.setUTCDate(d.getUTCDate() + 1)
      ) {
        spreadedFrames.push({ ...frame, [foundKey]: new Date(d.getTime()) });
      }
    }
    const results: any = {
      add_expense: null,
      delete_expense: null,
      update_expense: null,
      search_expense: null,
      stat_expense: null,
    };

    const addExpenseFrames = spreadedFrames.filter(
      (f) => f.intent === "add_expense"
    );
    const deleteExpenseFrames = spreadedFrames.filter(
      (f) => f.intent === "delete_expense"
    );
    const updateExpenseFrames = spreadedFrames.filter(
      (f) => f.intent === "update_expense"
    );
    const searchExpenseFrames = spreadedFrames.filter(
      (f) => f.intent === "search_expense"
    );
    const statExpenseFrames = spreadedFrames.filter(
      (f) => f.intent === "stat_expense"
    );

    // Handle add_expense
    if (addExpenseFrames.length > 0) {
      const descriptions = addExpenseFrames.map((frame) => frame.description);
      const categories = await new LlmModel().detectCategories(descriptions);
      addExpenseFrames.forEach((frame, idx) => {
        frame.category = categories[idx] || "none";
      });

      console.log("Adding expenses:", addExpenseFrames);
      const records = Utils.mapAddExpenseFramesToRecords(
        userId,
        addExpenseFrames
      );

      results.add_expense = await expenseModel.createExpenses(records);
    }

    // Handle delete_expense
    if (deleteExpenseFrames.length > 0) {
      const expenseIds: string[] = [];

      for (const frame of deleteExpenseFrames) {
        if (frame._id) {
          // Direct ID provided
          expenseIds.push(frame._id);
        } else {
          // Search for expenses matching criteria
          const criteria = Utils.frameToCriteria(userId, frame);
          const foundExpenses = await expenseModel.getExpenses(criteria);
          expenseIds.push(...foundExpenses.map((e: any) => e._id.toString()));
        }
      }

      if (expenseIds.length > 0) {
        console.log("Deleting expenses with IDs:", expenseIds);
        results.delete_expense = await expenseModel.deleteExpenses(expenseIds);
      }
    }

    // Handle update_expense
    if (updateExpenseFrames.length > 0) {
      const expenseUpdates: any[] = [];

      for (const frame of updateExpenseFrames) {
        if (frame._id) {
          // Direct ID provided, use update fields from frame
          const existingExpense = await expenseModel.getAnExpense(frame._id);
          const updateData = Utils.buildUpdateData(
            userId,
            frame,
            existingExpense
          );
          expenseUpdates.push(updateData);
        } else {
          // Search for expenses matching criteria, then update each
          const criteria = Utils.frameToCriteria(userId, frame);
          const foundExpenses = await expenseModel.getExpenses(criteria);

          for (const foundExpense of foundExpenses) {
            const updateData = Utils.buildUpdateData(
              userId,
              frame,
              foundExpense
            );
            expenseUpdates.push(updateData);
          }
        }
      }

      if (expenseUpdates.length > 0) {
        console.log("Updating expenses:", expenseUpdates);
        results.update_expense = await expenseModel.updateExpenses(
          expenseUpdates
        );
      }
    }

    // Handle search_expense
    if (searchExpenseFrames.length > 0) {
      const allSearchResults: any[] = [];

      for (const frame of searchExpenseFrames) {
        const criteria = Utils.frameToCriteria(userId, frame);
        console.log("Searching expenses with criteria:", criteria);
        const foundExpenses = await expenseModel.getExpenses(criteria);
        allSearchResults.push(...foundExpenses);
      }

      results.search_expense = allSearchResults;
    }

    // Handle stat_expense
    if (statExpenseFrames.length > 0) {
      const allStats: any = {};

      for (const frame of statExpenseFrames) {
        const criteria = Utils.frameToStatisticsCriteria(userId, frame);
        if (criteria.paid_at) {
          console.log("Getting statistics with criteria:", criteria);
          const stats = await expenseModel.getStatistics(criteria);
          // Merge stats into allStats
          Object.assign(allStats, stats);
        }
      }

      results.stat_expense = allStats;
    }

    return results;
  };

  private generateMissingInfoMessage(frames: ExpenseFrame[]): string {
    const messages: string[] = [];

    for (const frame of frames) {
      const missingFields: string[] = [];

      if (frame.intent === "add_expense") {
        // add_expense needs both target_price (or price) AND description
        if (!frame.target_price && !frame.price) {
          missingFields.push("giá tiền");
        }
        if (!frame.description) {
          missingFields.push("mô tả");
        }
      } else if (
        frame.intent === "delete_expense" ||
        frame.intent === "search_expense"
      ) {
        // These intents need at least ONE condition field
        const hasCondition =
          frame.description ||
          frame.price ||
          frame.date ||
          frame.location ||
          frame.condition_description ||
          frame.condition_price ||
          frame.condition_date ||
          frame.condition_location;
        if (!hasCondition) {
          missingFields.push(
            "ít nhất một trong: mô tả, giá tiền, ngày tháng, hoặc địa điểm"
          );
        }
      } else if (frame.intent === "stat_expense") {
        // These intents need at least ONE condition field
        const hasCondition = frame.date || frame.condition_date;
        if (!hasCondition) {
          missingFields.push("khoảng thời gian cần thống kê");
        }
      } else if (frame.intent === "update_expense") {
        // update_expense needs both condition and target fields
        const hasCondition =
          frame.description ||
          frame.price ||
          frame.date ||
          frame.location ||
          frame.condition_description ||
          frame.condition_price ||
          frame.condition_date ||
          frame.condition_location;

        const hasTarget =
          frame.target_price ||
          frame.target_date ||
          frame.target_description ||
          frame.target_location ||
          frame.description || // description can be both condition and target
          frame.category; // category is a target

        if (!hasCondition) {
          missingFields.push(
            "điều kiện để tìm chi tiêu (mô tả, giá tiền, ngày tháng, hoặc địa điểm)"
          );
        }
        if (!hasTarget) {
          missingFields.push(
            "giá trị mới để cập nhật (giá tiền, ngày tháng, mô tả, hoặc địa điểm)"
          );
        }
      } else {
        // Intent with no specific fields yet
        messages.push(
          `Bạn vui lòng cung cấp thêm thông tin cho ${frame.intent} nhé!`
        );
        continue;
      }

      if (missingFields.length > 0) {
        const intentName = this.getIntentDisplayName(frame.intent);
        messages.push(
          `Để ${intentName}, bạn vui lòng cung cấp ${missingFields.join(
            ", "
          )} nhé!`
        );
      }
    }

    return messages.length > 0 ? messages.join(". ") : null;
  }

  private getIntentDisplayName(intent: Intent): string {
    const intentMap: Record<string, string> = {
      add_expense: "thêm chi tiêu",
      delete_expense: "xóa chi tiêu",
      update_expense: "cập nhật chi tiêu",
      search_expense: "tìm kiếm chi tiêu",
      stat_expense: "thống kê chi tiêu",
    };
    return intentMap[intent] || intent;
  }

  private mapEntityKeyToFrameKey(entityKey: string, intent: Intent): string {
    // Extract base key
    let baseKey: string;
    let isTarget = false;
    let isCondition = false;

    if (entityKey.startsWith("target_")) {
      baseKey = entityKey.replace("target_", "");
      isTarget = true;
    } else if (entityKey.startsWith("condition_")) {
      baseKey = entityKey.replace("condition_", "");
      isCondition = true;
    } else {
      baseKey = entityKey;
    }

    // Normalize base keys (handle amount -> price, etc.)
    const keyMap: Record<string, string> = {
      price: "price",
      date: "date",
      description: "description",
      location: "location",
    };
    baseKey = keyMap[baseKey] || baseKey;

    // Map based on intent
    if (intent === "add_expense") {
      // add_expense only uses target values
      // If condition_* is provided, ignore it (shouldn't happen per spec)
      // If base key is provided, treat as target
      if (isCondition) {
        // Invalid for add_expense, but map to base key anyway
        return baseKey;
      }
      // Both target_* and base keys map to base key (representing target value)
      return baseKey;
    } else if (
      intent === "search_expense" ||
      intent === "delete_expense" ||
      intent === "stat_expense"
    ) {
      // search/delete/stat only use condition values
      // If target_* is provided, ignore it (shouldn't happen per spec)
      // If base key is provided, treat as condition
      if (isTarget) {
        // Invalid for search/delete/stat, but map to base key anyway
        return baseKey;
      }
      // Both condition_* and base keys map to base key (representing condition value)
      return baseKey;
    } else if (intent === "update_expense") {
      // update_expense can use both condition_* and target_*
      if (isCondition) {
        return `condition_${baseKey}`;
      } else if (isTarget) {
        return `target_${baseKey}`;
      } else {
        // Base key without prefix: treat as target for update
        // (since update needs both condition and target, base key likely means target)
        return `target_${baseKey}`;
      }
    }

    // Fallback: return as is
    return entityKey;
  }
}

export type ExpenseFrame = {
  intent: Intent;
  [key: string]: any;
};
