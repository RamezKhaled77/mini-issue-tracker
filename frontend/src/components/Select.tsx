import type { SelectHTMLAttributes } from "react";

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  invalid?: boolean;
  size?: "default" | "compact";
}

export function Select({
  invalid = false,
  size = "default",
  className = "",
  children,
  ...props
}: SelectProps) {
  const classes = ["select", size === "compact" ? "select--compact" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <select className={classes} aria-invalid={invalid || undefined} {...props}>
      {children}
    </select>
  );
}
