export function issueKey(id: string): string {
  const compact = id.replace(/[-_]/g, "");
  return `#${compact.slice(0, 6).toUpperCase()}`;
}