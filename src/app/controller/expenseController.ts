import { ExpenseModel } from "../model/expenseModel";
import { createExpenseValidate } from "../utils";

export class ExpenseController {
  addExpense = async (expense) => {
    console.log("Adding expense:", expense);
    // 1. Basic validation
    createExpenseValidate(expense);

    // 2. Add expense to db
    const result = await new ExpenseModel().addExpense(expense);

    return result;
  };
}
