/**
 * Quick Edit shared state (Spec 010).
 *
 * One edit at a time (D-06): the page holds a single `QuickEditState | null`;
 * opening a control replaces whatever was open, closing is keyed by
 * issue/field so a stale close cannot dismiss a newer edit.
 */

export type QuickEditField = "status" | "priority" | "assignee" | "labels" | "dueDate";

export interface QuickEditState {
  issueId: string;
  field: QuickEditField;
}

export function openQuickEdit(
  _current: QuickEditState | null,
  issueId: string,
  field: QuickEditField
): QuickEditState {
  // D-06: opening a control closes any other open control.
  void _current;
  return { issueId, field };
}

export function closeQuickEdit(
  current: QuickEditState | null,
  issueId?: string,
  field?: QuickEditField
): QuickEditState | null {
  if (!current) return null;
  if (issueId !== undefined && current.issueId !== issueId) return current;
  if (field !== undefined && current.field !== field) return current;
  return null;
}

export function isQuickEditing(
  current: QuickEditState | null,
  issueId: string,
  field: QuickEditField
): boolean {
  return current !== null && current.issueId === issueId && current.field === field;
}
