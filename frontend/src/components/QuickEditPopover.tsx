import { useEffect, useRef } from "react";
import type { ReactNode, RefObject } from "react";
import { Button } from "./Button.js";

interface QuickEditPopoverProps {
  /** Accessible name for the surface. */
  label: string;
  open: boolean;
  busy: boolean;
  /** Trigger element; focus is returned to it when the popover closes. */
  triggerRef: RefObject<HTMLElement | null>;
  onApply: () => void;
  onCancel: () => void;
  children: ReactNode;
}

/**
 * Anchored hairline surface for Quick Edit fields that confirm explicitly
 * (Spec 010, D-03/D-07/D-09): hosts the label-picker chips or the native date
 * input. Flat surface, hairline border, no elevation. Escape cancels; focus
 * returns to the trigger.
 */
export function QuickEditPopover({
  label,
  open,
  busy,
  triggerRef,
  onApply,
  onCancel,
  children,
}: QuickEditPopoverProps) {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      surfaceRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={surfaceRef}
      className="qe-popover"
      role="group"
      aria-label={label}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCancel();
        }
      }}
    >
      {children}
      <div className="qe-popover-actions">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button type="button" variant="primary" onClick={onApply} disabled={busy} aria-busy={busy || undefined}>
          Apply
        </Button>
      </div>
    </div>
  );
}
