export function initialsFromName(name: string): string {
  const tokens = name.trim().split(/\s+/).filter((t) => t.length > 0);
  if (tokens.length === 0) {
    return "?";
  }
  const first = tokens[0][0];
  const last = tokens.length > 1 ? tokens[tokens.length - 1][0] : "";
  return (first + last).toUpperCase();
}