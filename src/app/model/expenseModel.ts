import { ObjectId } from "mongodb";
import mongo from "../globalDbClient/globalDbClient";
import { createExpenseValidate } from "../utils";
export class ExpenseModel {
  addExpense = async (expense) => {
    const client = await mongo;
    const db = client.db("VSLIM");

    // 1. Check if user exists
    const userExists = await db
      .collection("User")
      .findOne({ _id: new ObjectId(expense.user_id) });

    if (!userExists) {
      throw new Error("User does not exist");
    }

    // 2. Prepare expense record
    const now = new Date().toISOString();
    const expenseRecord: Expense = {
      _id: new ObjectId().toString(),
      user_id: expense.user_id,
      type: expense.type,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      paid_at: expense.paid_at,
      created_at: now,
      modified_at: now,
    };

    // 3. Insert into Expenses collection
    const result = await db
      .collection<Expense>("Expense")
      .insertOne(expenseRecord);

    return {
      success: true,
      insertedId: result.insertedId,
      expense: expenseRecord,
    };
  };
}

export type Expense = {
  _id: string;
  user_id: string; // Reference to the user who created the expense
  type: "expense" | "income";
  description: string;
  amount: number;
  category: string;
  paid_at: string; // ISO date string
  created_at: string; // ISO date string
  modified_at: string; // ISO date string
};

export const ExpenseCategory = {
  FOOD: "FOOD",
  APPLIANCES: "APPLIANCES",
  TRANSPORT: "TRANSPORT",
  HEALTH: "HEALTH",
  BILLS: "BILLS",
};
