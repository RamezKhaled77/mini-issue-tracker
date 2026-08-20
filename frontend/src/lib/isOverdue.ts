export function isOverdue(dueDate: string | null, status: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return dueDate !== null && dueDate < today && status !== "Closed";
}