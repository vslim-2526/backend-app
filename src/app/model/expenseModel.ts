import { BulkWriteResult, ObjectId } from "mongodb";
import { mongo } from "../globalClient";

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
      price: expense.price,
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
    const userObjectIds = requestedUserIds
      .map((e) => {
        try {
          return new ObjectId(e as string);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as ObjectId[];

    const users = await db
      .collection("User")
      .find(
        {
          _id: { $in: userObjectIds },
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
      price: expense.price,
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
      price: expense.price,
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

    const updatedExpenseIds = expenseRecords.map((expense) => expense._id);
    const updatedExpenses = await db
      .collection<Expense>("Expense")
      .find({ _id: { $in: updatedExpenseIds } })
      .toArray();

    return {
      success: result.modifiedCount === expenseRecords.length,
      modifiedCount: result.modifiedCount,
      expenses: updatedExpenses,
    };
  };

  deleteExpenses = async (expense_ids: string[]) => {
    const client = await mongo;
    const db = client.db("VSLIM");

    const objectIds = expense_ids.map((id) => new ObjectId(id));
    const expensesToDelete = await db
      .collection<Expense>("Expense")
      .find({ _id: { $in: objectIds } })
      .toArray();

    const result = await db
      .collection("Expense")
      .deleteMany({ _id: { $in: objectIds } });

    return {
      success: result.deletedCount === expense_ids.length,
      deletedCount: result.deletedCount,
      expenses: expensesToDelete,
    };
  };

  getStatistics = async (criteria) => {
    const client = await mongo;
    const db = client.db("VSLIM");

    const stats = await db
      .collection("Expense")
      .aggregate([
        {
          $match: {
            paid_at: {
              $gte: criteria.paid_at.$gte, // start date
              $lte: criteria.paid_at.$lte, // end date
            },
          },
        },
        {
          $group: {
            _id: "$category",
            totalPrice: { $sum: { $toInt: "$price" } },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const formattedStats: any = {};
    stats.forEach((stat) => {
      formattedStats[stat._id] = {
        totalPrice: stat.totalPrice,
        count: stat.count,
      };
    });
    return formattedStats;
  };
}

export type Expense = {
  _id?: ObjectId;
  user_id: string; // Reference to the user who created the expense
  type: "expense" | "income";
  description: string;
  price: number;
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
