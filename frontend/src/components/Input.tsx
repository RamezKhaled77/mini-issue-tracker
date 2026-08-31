import type { InputHTMLAttributes } from "react";
import { forwardRef } from "react";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  invalid?: boolean;
  /** "compact" (32px) for dense contexts; default 36px. */
  size?: "default" | "compact";
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ invalid = false, size = "default", className = "", ...props }, ref) => {
    const classes = ["input", size === "compact" ? "input--compact" : "", className]
      .filter(Boolean)
      .join(" ");
    return <input ref={ref} className={classes} aria-invalid={invalid || undefined} {...props} />;
  }
);
