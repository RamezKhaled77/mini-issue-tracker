import type { InputHTMLAttributes } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  /** "compact" (32px) for dense contexts; default 36px. */
  size?: "default" | "compact";
}

export function Input({ invalid = false, size = "default", className = "", ...props }: InputProps) {
  const classes = ["input", size === "compact" ? "input--compact" : "", className]
    .filter(Boolean)
    .join(" ");
  return <input className={classes} aria-invalid={invalid || undefined} {...props} />;
}
