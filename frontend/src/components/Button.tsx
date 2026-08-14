import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  block?: boolean;
}

export function Button({
  variant = "primary",
  block = false,
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  const classes = ["btn", `btn--${variant}`, block ? "btn--block" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button type={type} className={classes} {...props} />;
}