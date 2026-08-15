export function resolveDisplayName(name: string | null, email: string): string {
  if (name !== null && name.length > 0) {
    return name;
  }
  const at = email.indexOf("@");
  return at === -1 ? email : email.slice(0, at);
}