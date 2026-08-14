import { cloneElement, isValidElement, useId } from "react";
import type { ReactNode } from "react";

interface FieldProps {
  label: string;
  error?: string | null;
  hint?: string;
  srOnlyLabel?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, error, hint, srOnlyLabel = false, children, className = "" }: FieldProps) {
  const errorId = useId();
  const hintId = useId();

  let control = children;
  if (isValidElement<{ "aria-invalid"?: boolean; "aria-describedby"?: string }>(children)) {
    const describedBy = [error ? errorId : null, hint ? hintId : null]
      .filter(Boolean)
      .join(" ");
    const ariaProps: { "aria-invalid"?: boolean; "aria-describedby"?: string } = {};
    if (error) ariaProps["aria-invalid"] = true;
    if (describedBy) ariaProps["aria-describedby"] = describedBy;
    control = cloneElement(children, ariaProps);
  }

  return (
    <label className={["field", className].filter(Boolean).join(" ")}>
      <span className={srOnlyLabel ? "sr-only" : "field-label"}>{label}</span>
      {control}
      {hint && (
        <span className="field-hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId}>
          {error}
        </span>
      )}
    </label>
  );
}