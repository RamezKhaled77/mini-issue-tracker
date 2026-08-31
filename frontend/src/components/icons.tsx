import type { ReactNode, SVGProps } from "react";

/**
 * Custom 16×16 / stroke-1.5 / currentColor icon set. No icon library.
 * Glyphs are aria-hidden by default — interactive hosts carry aria-label.
 */
interface IconProps extends SVGProps<SVGSVGElement> {
  size?: 14 | 16;
}

function Base({ size = 16, children, ...props }: IconProps & { children?: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconBrand(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 5h8M4 8h8M4 11h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Base>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Base>
  );
}

export function IconIssue(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M3 2.5h10v11H3zM3 6h10M6.5 9.5h3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconWorkspaces(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M4 4h8M4 7h8M4 10h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconHelp(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6.2 6a1.8 1.8 0 1 1 2.6 1.6c-.8.5-.8 1-.8 1.9M8 11h.01"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Base>
  );
}

export function IconSignout(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M6 3H3.5v10H6M10.5 5.5 13 8l-2.5 2.5M13 8H7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconChevron(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="m6 3.5 4.5 4.5L6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Base>
  );
}

export function IconLabels(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M2.5 3.5h5L13 8.5l-4.5 4.5-6-6v-3.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M5.5 5.5h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </Base>
  );
}

export function IconInvite(props: IconProps) {
  return (
    <Base {...props}>
      <path
        d="M6 4.5a2.5 2.5 0 1 1 5 0 2.5 2.5 0 0 1-5 0zM3 13.5c0-2.2 2.2-4 5-4M13.5 10v4M11.5 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </Base>
  );
}
