import { ObjectId } from "mongodb";
import { ExpenseFrame } from "../controller/chatController";
import { Expense } from "../model/expenseModel";

export function sanitizeString(input: string): string {
  let output = input.toString();

  output = output.trim();
  output = output.replace(/\s+/g, " ");

  output = output.replace(/<[^>]*>/g, "");
  output = output
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  return output;
}

export function sanitizeObject(obj: any): any {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, sanitizeString(v as string)])
  );
}

export function validateCreateAnExpense(expense: any): string | null {
  if (!expense.user_id) throw new Error("user_id is required");
  if (!expense.type || !["expense", "income"].includes(expense.type)) {
    throw new Error("type must be either 'expense' or 'income'");
  }
  if (!expense.description?.trim()) throw new Error("description is required");
  if (!expense.price || parseInt(expense.price) <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!expense.category?.trim()) throw new Error("category is required");
  if (!expense.paid_at || isNaN(Date.parse(expense.paid_at))) {
    throw new Error("paid_at must be a valid ISO date string");
  }

  return null;
}

export function extractCriteriaForSearch(query: any): any {
  const criteria: any = {};
  if (query.user_id) criteria.user_id = String(query.user_id);
  if (query.type) criteria.type = String(query.type);
  if (query.description)
    criteria.description = { $regex: String(query.description), $options: "i" };
  if (query.price) criteria.price = Number(query.price);
  if (query.category) criteria.category = String(query.category);

  if (query.paid_after || query.paid_before) {
    criteria.paid_at = {};
    if (query.paid_after)
      criteria.paid_at.$gte = new Date(String(query.paid_after));
    if (query.paid_before)
      criteria.paid_at.$lte = new Date(
        String(`${query.paid_before} 23:59:59Z`)
      );
  }

  if (query._ids) {
    const ids = Array.isArray(query._ids)
      ? query._ids
      : String(query._ids).split(",");

    criteria._id = {
      $in: ids
        .map((id) => {
          try {
            return new ObjectId(id);
          } catch {
            return null;
          }
        })
        .filter(Boolean), // remove invalid ObjectIds
    };
  }

  return criteria;
}

export function isFrameEnough(frame: ExpenseFrame): boolean {
  if (frame.intent === "add_expense") {
    // add_expense needs target_price (or price) AND description
    return !!((frame.target_price || frame.price) && frame.description);
  } else if (
    frame.intent === "delete_expense" ||
    frame.intent === "search_expense" ||
    frame.intent === "stat_expense"
  ) {
    // search/delete/stat need at least one condition field
    return !!(
      frame.description ||
      frame.price ||
      frame.date ||
      frame.location ||
      frame.condition_description ||
      frame.condition_price ||
      frame.condition_date ||
      frame.condition_location
    );
  } else if (frame.intent === "update_expense") {
    // update_expense needs both condition (to find) and target (to update)
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

    return !!(hasCondition && hasTarget);
  } else {
    return false;
  }
}

export function mapAddExpenseFramesToRecords(
  userId,
  addExpenseFrames: ExpenseFrame[]
): Expense[] {
  const expenseRecords = addExpenseFrames.map((frame) => ({
    user_id: userId,
    type: "expense" as any,
    description: (frame.description || "").concat(
      frame.location || frame.target_location
        ? `ở ${frame.location || frame.target_location}`
        : ""
    ),
    price: (() => {
      const raw = (frame.target_price ?? frame.price) as any;
      if (typeof raw === "number") return Math.round(raw as number);
      const text = String(raw ?? "0");
      try {
        // lazily import to avoid circular deps in some bundlers
        const parsed = require("./priceConverter").parseVietnameseMoney(text);
        return parsed?.priceValue ?? Number(text) ?? 0;
      } catch {
        return Number(text) ?? 0;
      }
    })(),
    category: frame.category || "none",
    paid_at:
      frame.target_date || frame.date
        ? new Date(frame.target_date || frame.date)
        : new Date(),
    created_at: new Date(),
    modified_at: new Date(),
  }));
  console.log("Mapped expense records:", expenseRecords);

  return expenseRecords;
}

export function frameToCriteria(userId: string, frame: ExpenseFrame): any {
  const criteria: any = {
    user_id: userId,
  };

  if (frame._id) {
    try {
      criteria._id = new ObjectId(frame._id);
    } catch {
      // Invalid ObjectId, skip
    }
  }

  // For update_expense, use condition_* fields first, then regular fields
  // For search/delete/stat, use condition_* or regular fields
  let description: string | undefined;
  let price: string | number | undefined;
  let date: string | undefined;
  let location: string | undefined;
  let category: string | undefined;

  if (frame.intent === "update_expense") {
    // For update: prioritize condition_* fields, then regular fields
    description = frame.condition_description || frame.description;
    price = frame.condition_price || frame.price;
    date = frame.condition_date || frame.date;
    location = frame.condition_location || frame.location;
    category = frame.category;
  } else {
    // For search/delete/stat: use condition_* or regular fields
    description = frame.condition_description || frame.description;
    price = frame.condition_price || frame.price;
    date = frame.condition_date || frame.date;
    location = frame.condition_location || frame.location;
    category = frame.category;
  }

  if (description) {
    criteria.description = { $regex: description, $options: "i" };
  }
  if (price) {
    if (typeof price === "number") {
      criteria.price = price;
    } else {
      try {
        const parsed = require("./priceConverter").parseVietnameseMoney(
          String(price)
        );
        criteria.price = parsed?.priceValue ?? Number(price);
      } catch {
        criteria.price = Number(price);
      }
    }
  }
  if (category) {
    criteria.category = category;
  }
  if (date) {
    const dateObj = new Date(date);
    // Match expenses on the same day
    const startOfDay = new Date(dateObj);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(dateObj);
    endOfDay.setHours(23, 59, 59, 999);
    criteria.paid_at = {
      $gte: startOfDay,
      $lte: endOfDay,
    };
  }

  return criteria;
}

export function buildUpdateData(
  userId: string,
  frame: ExpenseFrame,
  existingExpense: any
): any {
  // For update_expense, use target_* fields for new values, fallback to regular fields
  const targetPrice = frame.target_price || frame.price;
  const targetDate = frame.target_date || frame.date;
  const targetDescription = frame.target_description || frame.description;
  const targetLocation = frame.target_location || frame.location;
  const targetCategory = frame.category;

  return {
    _id: existingExpense._id.toString(),
    user_id: userId,
    type: frame.type || existingExpense.type || "expense",
    description: targetDescription || existingExpense.description,
    price: (() => {
      if (!targetPrice && targetPrice !== 0) return existingExpense.price;
      if (typeof targetPrice === "number") return Math.round(targetPrice);
      try {
        const parsed = require("./priceConverter").parseVietnameseMoney(
          String(targetPrice)
        );
        return (
          parsed?.priceValue ?? Number(targetPrice) ?? existingExpense.price
        );
      } catch {
        return Number(targetPrice) ?? existingExpense.price;
      }
    })(),
    category: targetCategory || existingExpense.category || "none",
    paid_at: targetDate
      ? new Date(targetDate)
      : existingExpense.paid_at
      ? new Date(existingExpense.paid_at)
      : new Date(),
    created_at: existingExpense.created_at
      ? new Date(existingExpense.created_at)
      : new Date(),
  };
}

export function frameToStatisticsCriteria(
  userId: string,
  frame: ExpenseFrame
): any {
  const criteria: any = {
    user_id: userId,
  };

  if (frame.date) {
    // If single date, use it as both start and end
    const date = new Date(frame.date);
    criteria.paid_at = {
      $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      $lte: new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        23,
        59,
        59,
        999
      ),
    };
  } else if (frame.date_start && frame.date_end) {
    // Date range provided
    criteria.paid_at = {
      $gte: new Date(frame.date_start),
      $lte: new Date(frame.date_end),
    };
  } else {
    // Default to current month if no date specified
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );
    criteria.paid_at = {
      $gte: startOfMonth,
      $lte: endOfMonth,
    };
  }

  return criteria;
}
