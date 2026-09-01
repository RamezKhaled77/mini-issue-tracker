import { useRef, useState } from "react";
import type { Label } from "@mini-issue-tracker/shared";
import { QuickEditPopover } from "./QuickEditPopover.js";
import { labelTone } from "../lib/labelTone.js";

interface QuickEditLabelsProps {
  open: boolean;
  busy: boolean;
  /** Available workspace labels (option data already fetched by the page). */
  labels: Label[];
  /** Committed labels on the issue. */
  selected: Label[];
  onOpen: () => void;
  onApply: (labelIds: string[]) => void;
  onCancel: () => void;
}

/**
 * Labels Quick Edit (Spec 010, D-07): the resting run renders the ordinary
 * label badges (plus "+N more", or a quiet "Add label" affordance when the
 * issue has none); activating any entry point opens the label-picker chips
 * over a working copy that is PATCHed as the full set on Apply.
 */
export function QuickEditLabels({
  open,
  busy,
  labels,
  selected,
  onOpen,
  onApply,
  onCancel,
}: QuickEditLabelsProps) {
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const wasOpenRef = useRef(false);
  const [workingIds, setWorkingIds] = useState<string[]>(selected.map((l) => l.id));

  // Re-seed the working copy from the committed set whenever the editor opens,
  // and discard it on close (cancel semantics, D-07).
  if (open && !wasOpenRef.current) {
    setWorkingIds(selected.map((l) => l.id));
  }
  wasOpenRef.current = open;

  function toggleLabel(id: string) {
    setWorkingIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const summary =
    selected.length > 0 ? selected.map((l) => l.name).join(", ") : "none";
  const accessibleName = `Change labels, currently ${summary}`;
  const visible = selected.slice(0, 2);
  const extra = selected.length - visible.length;

  return (
    <>
      {visible.map((label) => (
        <button
          key={label.id}
          ref={lastTriggerRef}
          type="button"
          className={`badge badge--${labelTone(label.color)} qe-trigger`}
          aria-label={accessibleName}
          aria-expanded={open}
          data-quickedit="labels"
          disabled={busy}
          aria-busy={busy || undefined}
          onClick={(e) => {
            lastTriggerRef.current = e.currentTarget;
            onOpen();
          }}
        >
          {label.name}
        </button>
      ))}
      {extra > 0 && (
        <button
          ref={lastTriggerRef}
          type="button"
          className="ledger-more-labels qe-trigger qe-trigger--quiet"
          aria-label={accessibleName}
          aria-expanded={open}
          data-quickedit="labels"
          disabled={busy}
          onClick={(e) => {
            lastTriggerRef.current = e.currentTarget;
            onOpen();
          }}
        >
          +{extra} more
        </button>
      )}
      {selected.length === 0 && labels.length > 0 && (
        <button
          ref={lastTriggerRef}
          type="button"
          className="badge badge--neutral qe-trigger"
          aria-label={accessibleName}
          aria-expanded={open}
          data-quickedit="labels"
          disabled={busy}
          onClick={(e) => {
            lastTriggerRef.current = e.currentTarget;
            onOpen();
          }}
        >
          Add label
        </button>
      )}
      <QuickEditPopover
        label={accessibleName}
        open={open}
        busy={busy}
        triggerRef={lastTriggerRef}
        onApply={() => onApply(workingIds)}
        onCancel={onCancel}
      >
        <div className="label-picker">
          {labels.map((label) => (
            <label key={label.id} className={`label-chip label-chip--${label.color}`}>
              <input
                type="checkbox"
                checked={workingIds.includes(label.id)}
                onChange={() => toggleLabel(label.id)}
              />
              {label.name}
            </label>
          ))}
        </div>
      </QuickEditPopover>
    </>
  );
}
