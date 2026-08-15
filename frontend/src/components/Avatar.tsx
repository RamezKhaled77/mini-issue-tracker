import { initialsFromName } from "../lib/initials.js";

interface AvatarProps {
  name: string;
  decorative?: boolean;
  small?: boolean;
}

export function Avatar({ name, decorative = false, small = false }: AvatarProps) {
  const initials = initialsFromName(name);
  const className = small ? "avatar avatar--sm" : "avatar";
  if (decorative) {
    return <span className={className} aria-hidden="true">{initials}</span>;
  }
  return (
    <span className={className} role="img" aria-label={name}>
      {initials}
    </span>
  );
}