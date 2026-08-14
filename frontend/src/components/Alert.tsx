import { forwardRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";

export type AlertVariant = "error" | "success" | "info";

interface AlertProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: AlertVariant;
  children: ReactNode;
}

export const Alert = forwardRef<HTMLParagraphElement, AlertProps>(
  ({ variant = "error", className = "", ...props }, ref) => {
    const classes = ["alert", `alert--${variant}`, className].filter(Boolean).join(" ");
    return <p ref={ref} className={classes} {...props} />;
  }
);
Alert.displayName = "Alert";