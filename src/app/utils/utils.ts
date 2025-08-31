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

export function createExpenseValidate(expense: any): string | null {
  if (!expense.user_id) throw new Error("user_id is required");
  if (!expense.type || !["expense", "income"].includes(expense.type)) {
    throw new Error("type must be either 'expense' or 'income'");
  }
  if (!expense.description?.trim()) throw new Error("description is required");
  if (!expense.amount || parseInt(expense.amount) <= 0) {
    throw new Error("amount must be a positive number");
  }
  if (!expense.category?.trim()) throw new Error("category is required");
  if (!expense.paid_at || isNaN(Date.parse(expense.paid_at))) {
    throw new Error("paid_at must be a valid ISO date string");
  }

  return null;
}
