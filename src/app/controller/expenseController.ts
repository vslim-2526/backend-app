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

  createAnExpense = async (expense) => {
    console.log("Adding expense:", expense);
    // 1. Basic validation
    validateCreateAnExpense(expense);

    // 2. Add expense to db
    const result = await new ExpenseModel().createAnExpense(expense);

    return result;
  };
}
