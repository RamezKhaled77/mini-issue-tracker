import { useRef, useState } from "react";
import { QuickEditPopover } from "./QuickEditPopover.js";

interface QuickEditDateProps {
  open: boolean;
  busy: boolean;
  /** Committed due date (`YYYY-MM-DD`) or null. */
  dueDate: string | null;
  onOpen: () => void;
  onApply: (dueDate: string | null) => void;
  onCancel: () => void;
}

/**
 * Due-date Quick Edit (Spec 010, D-09): a compact chip showing the real date
 * or a quiet `Due` placeholder (never fabricated), opening a native date
 * input in a popover; empty value applies `dueDate: null`.
 */
export function QuickEditDate({ open, busy, dueDate, onOpen, onApply, onCancel }: QuickEditDateProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [working, setWorking] = useState(dueDate ?? "");
  const wasOpenRef = useRef(false);

  if (open && !wasOpenRef.current) {
    setWorking(dueDate ?? "");
  }
  wasOpenRef.current = open;

  // Pre-validate the client-side format (native input yields "" or YYYY-MM-DD).
  const valid = working === "" || /^\d{4}-\d{2}-\d{2}$/.test(working);

  const accessibleName = `Change due date, currently ${dueDate ?? "none"}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`badge badge--neutral qe-trigger qe-date-trigger${dueDate ? "" : " qe-trigger--quiet"}`}
        aria-label={accessibleName}
        aria-expanded={open}
        data-quickedit="dueDate"
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={onOpen}
      >
        {dueDate ? dueDate : "Due"}
      </button>
      <QuickEditPopover
        label={accessibleName}
        open={open}
        busy={busy}
        triggerRef={triggerRef}
        onApply={() => valid && onApply(working === "" ? null : working)}
        onCancel={onCancel}
      >
        <div className="qe-date-row">
          <label className="qe-date-label" htmlFor="qe-date-input">
            Due date
          </label>
          <input
            id="qe-date-input"
            type="date"
            value={working}
            aria-invalid={!valid || undefined}
            onChange={(e) => setWorking(e.target.value)}
          />
        </div>
        <div className="qe-date-row">
          <button
            type="button"
            className="qe-clear"
            onClick={() => setWorking("")}
            disabled={busy}
          >
            Clear due date
          </button>
        </div>
      </QuickEditPopover>
    </>
  );
}
