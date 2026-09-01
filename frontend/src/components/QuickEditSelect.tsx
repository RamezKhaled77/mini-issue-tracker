import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

export interface QuickEditOption {
  value: string;
  label: string;
}

interface QuickEditSelectProps {
  /** Human field name used in the accessible name: "Change <field>, currently <value>". */
  field: string;
  open: boolean;
  busy: boolean;
  /** Committed raw value (what the select reports on change). */
  value: string;
  /** Committed display text (what the trigger announces and renders). */
  displayValue: string;
  options: QuickEditOption[];
  /** Badge tone suffix, e.g. "status-open" or "neutral". */
  tone: string;
  /** Trigger content; defaults to displayValue. */
  triggerContent?: ReactNode;
  className?: string;
  onOpen: () => void;
  onCommit: (value: string) => void;
  onCancel: () => void;
}

/**
 * Badge-styled inline select (Spec 010, D-03/D-05/D-12): in the resting state
 * the control reads as the ordinary row badge; activation swaps in a native
 * `<select>` that commits on change. Escape restores the trigger and focus.
 */
export function QuickEditSelect({
  field,
  open,
  busy,
  value,
  displayValue,
  options,
  tone,
  triggerContent,
  className = "",
  onOpen,
  onCommit,
  onCancel,
}: QuickEditSelectProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      selectRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  const accessibleName = `Change ${field}, currently ${displayValue}`;

  if (!open) {
    return (
      <button
        ref={triggerRef}
        type="button"
        className={`badge badge--${tone} qe-trigger${className ? ` ${className}` : ""}`}
        aria-label={accessibleName}
        aria-expanded={open}
        data-quickedit={field}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={onOpen}
      >
        {triggerContent ?? displayValue}
      </button>
    );
  }

  return (
    <select
      ref={selectRef}
      className={`qe-select${className ? ` ${className}` : ""}`}
      aria-label={accessibleName}
      data-quickedit={field}
      value={value}
      disabled={busy}
      aria-busy={busy || undefined}
      autoFocus
      onChange={(e) => onCommit(e.currentTarget.value)}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
