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

export function validateCreateAnExpense(expense: any): string | null {
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

export function extractCriteriaForSearch(query: any): any {
  const criteria: any = {};
  if (query.user_id) criteria.user_id = String(query.user_id);
  if (query.type) criteria.type = String(query.type);
  if (query.description)
    criteria.description = { $regex: String(query.description), $options: "i" };
  if (query.amount) criteria.amount = Number(query.amount);
  if (query.category) criteria.category = String(query.category);

  if (query.paid_after || query.paid_before) {
    criteria.paid_at = {};
    if (query.paid_after)
      criteria.paid_at.$gte = new Date(String(query.paid_after));
    if (query.paid_before)
      criteria.paid_at.$lte = new Date(
        String(`${query.paid_before} 23:59:59Z`)
      );
  }

  return criteria;
}
