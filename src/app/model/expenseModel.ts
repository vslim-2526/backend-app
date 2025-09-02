import { BulkWriteResult, ObjectId } from "mongodb";
import mongo from "../globalDbClient/globalDbClient";

export class ExpenseModel {
  getAnExpense = async (expense_id: string) => {
    const client = await mongo;
    const db = client.db("VSLIM");

    const expense = await db
      .collection("Expense")
      .findOne({ _id: new ObjectId(expense_id) });

    if (!expense) {
      throw new Error(`Expense ${expense_id} not found`);
    }

    return expense;
  };

  getExpenses = async (criteria: any) => {
    const client = await mongo;
    const db = client.db("VSLIM");

    const expenses = await db.collection("Expense").find(criteria).toArray();

    return expenses;
  };

  createAnExpense = async (expense) => {
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
    const now = new Date();
    const expenseRecord: Expense = {
      _id: new ObjectId(),
      user_id: expense.user_id,
      type: expense.type,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      paid_at: new Date(expense.paid_at),
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

  createExpenses = async (expenses: Expense[]) => {
    const client = await mongo;
    const db = client.db("VSLIM");

    // 1. Check if users exist
    const requestedUserIds = [
      ...new Set(expenses.map((expense) => expense.user_id)),
    ];
    const users = await db
      .collection("User")
      .find(
        {
          _id: { $in: requestedUserIds.map((e) => new ObjectId(e as string)) },
        },
        { projection: { name: 1 } }
      )
      .toArray();

    const existingUserIdsSet = new Set(
      users.map((user) => user._id.toString())
    );

    if (existingUserIdsSet.size != requestedUserIds.length) {
      throw new Error(`User(s) do not exist!`);
    }

    // 2. Prepare expense records
    const now = new Date();
    const expenseRecords: Expense[] = expenses.map((expense) => ({
      _id: new ObjectId(),
      user_id: expense.user_id,
      type: expense.type,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      paid_at: new Date(expense.paid_at),
      created_at: now,
      modified_at: now,
    }));

    // 3. Insert into Expenses collection
    const result = await db
      .collection<Expense>("Expense")
      .insertMany(expenseRecords);

    return {
      success: true,
      insertedCount: result.insertedCount,
      insertedIds: result.insertedIds,
    };
  };

  // TO-DO: IF NOT USING BY 16 SEP 2025, DELETE THIS COMMENTED CODE!

  // updateAnExpense = async (expense_id: string, expenseUpdate: any) => {
  //   const client = await mongo;
  //   const db = client.db("VSLIM");

  //   // 1. Check if expense exists
  //   const existingExpense = await db
  //     .collection("Expense")
  //     .findOne({ _id: new ObjectId(expense_id) });

  //   if (!existingExpense) {
  //     throw new Error(`Expense ${expense_id} not found`);
  //   }

  //   // 2. Prepare update document
  //   const updateDoc: any = {
  //     ...expenseUpdate,
  //     created_at: existingExpense.created_at, // preserve original created_at
  //     modified_at: new Date(),
  //   };

  //   delete updateDoc._id; // Ensure _id is not part of the update

  //   updateDoc.paid_at = new Date(expenseUpdate.paid_at);

  //   // Verify new user_id exists
  //   const userExists = await db
  //     .collection("User")
  //     .findOne({ _id: new ObjectId(expenseUpdate.user_id) });
  //   if (!userExists) {
  //     throw new Error("User does not exist");
  //   } else {
  //     updateDoc.user_id = expenseUpdate.user_id;
  //   }

  //   // 3. Update the expense
  //   const result = await db
  //     .collection("Expense")
  //     .updateOne({ _id: new ObjectId(expense_id) }, { $set: updateDoc });

  //   return {
  //     success: result.modifiedCount === 1,
  //     modifiedCount: result.modifiedCount,
  //   };
  // };

  updateExpenses = async (expenseUpdates: any) => {
    const client = await mongo;
    const db = client.db("VSLIM");

    // 1. Check if users exist
    const requestedUserIds = [
      ...new Set(expenseUpdates.map((expense: any) => expense.user_id)),
    ];
    const users = await db
      .collection("User")
      .find(
        {
          _id: { $in: requestedUserIds.map((e) => new ObjectId(e as string)) },
        },
        { projection: { name: 1 } }
      )
      .toArray();

    const existingUserIdsSet = new Set(
      users.map((user) => user._id.toString())
    );

    if (existingUserIdsSet.size != requestedUserIds.length) {
      console.log(existingUserIdsSet, "--", requestedUserIds);
      throw new Error(`User(s) do not exist!`);
    }

    // 2. Prepare expense records
    const now = new Date();
    const expenseRecords: Expense[] = expenseUpdates.map((expense) => ({
      _id: new ObjectId(expense._id),
      user_id: expense.user_id,
      type: expense.type,
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      paid_at: new Date(expense.paid_at),
      created_at: expense.created_at,
      modified_at: now,
    }));

    // 3. Update expenses in the collection
    const result = await db.collection<Expense>("Expense").bulkWrite(
      expenseRecords.map(({ _id, ...rest }) => ({
        updateOne: {
          filter: { _id },
          update: { $set: rest },
        },
      }))
    );

    return {
      success: result.modifiedCount === expenseRecords.length,
      modifiedCount: result.modifiedCount,
    };
  };
}

export type Expense = {
  _id: ObjectId;
  user_id: string; // Reference to the user who created the expense
  type: "expense" | "income";
  description: string;
  amount: number;
  category: string;
  paid_at: Date; // ISO date
  created_at: Date; // ISO date
  modified_at: Date; // ISO date
};

export const ExpenseCategory = {
  FOOD: "FOOD",
  APPLIANCES: "APPLIANCES",
  TRANSPORT: "TRANSPORT",
  HEALTH: "HEALTH",
  BILLS: "BILLS",
};
