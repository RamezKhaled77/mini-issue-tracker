import type { ReactNode } from "react";
import { Button } from "./Button.js";
import { Dialog } from "./Dialog.js";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onConfirm: () => void;
  children?: ReactNode;
}

/**
 * Thin semantic layer over the existing Dialog for destructive confirms.
 * Inherits Dialog's full accessibility contract (focus trap, Escape, focus
 * return, modalLayer registration) and uses the existing `.dialog-actions`
 * row + `Button` danger variant. The destructive action is always coral;
 * Cancel is the existing secondary button.
 *
 * ConfirmDialog is NOT a generic modal framework. It only models the
 * "confirm a destructive action" pattern reused across the application.
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  busy = false,
  busyLabel,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const renderedDescription =
    typeof description === "string" ? description : undefined;
  const extraDescription =
    typeof description === "string" ? null : description;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={renderedDescription}
    >
      {extraDescription}
      {children}
      <div className="dialog-actions">
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy && busyLabel ? busyLabel : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
