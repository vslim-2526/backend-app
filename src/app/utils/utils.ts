export function sanitizeString(input: string): string {
  if (typeof input !== "string") return "";

  let output = input;

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
