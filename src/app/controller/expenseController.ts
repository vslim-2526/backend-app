import { ExpenseModel } from "../model/expenseModel";
import { validateCreateAnExpense } from "../utils";

export class ExpenseController {
  getAnExpense = async (expense_id: string) => {
    console.log("Fetching expense with ID:", expense_id);
    const result = await new ExpenseModel().getAnExpense(expense_id);

    return result;
  };

  getExpenses = async (criteria: any) => {
    console.log("Fetching expenses with criteria:", criteria);
    const result = await new ExpenseModel().getExpenses(criteria);

    console.log("Fetched expenses:", result);
    return result;
  };

  createExpenses = async (expenses: any[]) => {
    console.log("Adding multiple expenses:", expenses);
    const results = [];

    for (const [idx, expense] of expenses.entries()) {
      try {
        validateCreateAnExpense(expense);
      } catch (error) {
        throw new Error(
          `Validation failed for expense at index ${idx}: ${error}`
        );
      }
    }
    const result = await new ExpenseModel().createExpenses(expenses);

    return result;
  };

  updateExpenses = async (expenseUpdates: any) => {
    console.log("Updating multiple expenses:", expenseUpdates);
    for (const [idx, expense] of expenseUpdates.entries()) {
      try {
        validateCreateAnExpense(expense);
      } catch (error) {
        throw new Error(
          `Validation failed for expense at index ${idx}: ${error}`
        );
      }
    }

    const result = await new ExpenseModel().updateExpenses(expenseUpdates);
    return result;
  };

  deleteExpenses = async (expense_ids: string[]) => {
    console.log("Deleting multiple expenses:", expense_ids);
    const result = await new ExpenseModel().deleteExpenses(expense_ids);

    return result;
  };

  getStatistics = async (criteria: any) => {
    console.log("Calculating statistics");
    const result = await new ExpenseModel().getStatistics(criteria);

    return result;
  };
}
