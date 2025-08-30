type Expense = {
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

export const addExpense = (expense: Partial<Expense>): Expense => {
  return;
};
