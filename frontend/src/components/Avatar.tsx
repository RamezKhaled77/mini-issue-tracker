import { initialsFromName } from "../lib/initials.js";

interface AvatarProps {
  name: string;
  decorative?: boolean;
  small?: boolean;
}

const TONE_COUNT = 6;

function toneFor(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % TONE_COUNT;
}

export function Avatar({ name, decorative = false, small = false }: AvatarProps) {
  const initials = initialsFromName(name);
  const tone = toneFor(name);
  const toneClass = tone === 0 ? "" : ` avatar--tone-${tone}`;
  const className = small ? `avatar avatar--sm${toneClass}` : `avatar${toneClass}`;
  if (decorative) {
    return <span className={className} aria-hidden="true">{initials}</span>;
  }
  return (
    <span className={className} role="img" aria-label={name}>
      {initials}
    </span>
  );
}