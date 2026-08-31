import type { InputHTMLAttributes } from "react";
import { useId } from "react";

interface CheckboxProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Visible label; renders the label wrapper itself. */
  label: string;
}

export function Checkbox({ label, className = "", id: idProp, ...props }: CheckboxProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  return (
    <label className={["checkbox", className].filter(Boolean).join(" ")}>
      <input type="checkbox" id={id} {...props} />
      <span className="checkbox-label">{label}</span>
    </label>
  );
}
