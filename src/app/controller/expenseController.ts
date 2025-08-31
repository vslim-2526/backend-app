import { ExpenseModel } from "../model/expenseModel";
import { createAnExpenseValidate } from "../utils";

export class ExpenseController {
  getAnExpense = async (expense_id: string) => {
    console.log("Fetching expense with ID:", expense_id);
    const result = await new ExpenseModel().getAnExpense(expense_id);

    return result;
  };

  createAnExpense = async (expense) => {
    console.log("Adding expense:", expense);
    // 1. Basic validation
    createAnExpenseValidate(expense);

    // 2. Add expense to db
    const result = await new ExpenseModel().createAnExpense(expense);

    return result;
  };
}
