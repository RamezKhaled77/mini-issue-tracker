import type { InputHTMLAttributes } from "react";
import { forwardRef, useId } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label; renders the label wrapper itself. */
  label: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, className = "", id: idProp, ...props }, ref) => {
    const autoId = useId();
    const id = idProp ?? autoId;
    return (
      <label className={["checkbox", className].filter(Boolean).join(" ")}>
        <input type="checkbox" ref={ref} id={id} {...props} />
        <span className="checkbox-label">{label}</span>
      </label>
    );
  }
);
