import { LLM_PARSE_URL } from "../../..//config";

export class LlmModel {
  async parseUtterance(utterance: string) {
    const url = LLM_PARSE_URL;
    if (!url) {
      throw new Error(
        "LLM parse URL is not configured in environment variables"
      );
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utterance }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `LLM parse failed: ${res.status} ${res.statusText} ${text}`
      );
    }

    const data = (await res.json()) as UtteranceInfo;
    return data;

    // return {
    //   intents: ["add_expense", "delete_expense", "stat_expense", "none"],
    //   entities: [
    //     { key: "description", text: "sửa xe", intent: "delete_expense" },
    //     { key: "amount", text: "150000", intent: "delete_expense" },
    //     { key: "amount", text: "50000", intent: "add_expense" },
    //     { key: "description", text: "bánh mì", intent: "add_expense" },
    //     { key: "date", text: "2023-10-01", intent: "add_expense" },
    //     { key: "description", text: "đổ xăng", intent: "add_expense" },
    //     { key: "amount", text: "25000", intent: "add_expense" },
    //     { key: "location", text: "quận 1", intent: "add_expense" },
    //   ],
    // } satisfies UtteranceInfo;
  }

  async detectCategories(descriptions: string[]) {
    await new Promise((r) => setTimeout(r, 100));
    return ["Ăn uống"];
  }
}

export type UtteranceInfo = {
  intents: Intent[];
  entities: EntityInfo[];
  confidence?: number;
};

export type EntityInfo = {
  key: string;
  text: string;
  intent: Intent;
};

export type Intent =
  | "none"
  | "add_expense"
  | "update_expense"
  | "delete_expense"
  | "search_expense"
  | "stat_expense";
