import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { BulkToolbar } from "../../src/components/BulkToolbar.js";

const LABELS = [
  { id: "la-1", workspaceId: "w-1", name: "bug", color: "violet" as const },
  { id: "la-2", workspaceId: "w-1", name: "ui", color: "magenta" as const },
];
const MEMBERS = [{ userId: "u-2", name: "Priya Patel" }];

describe("BulkToolbar", () => {
  function renderToolbar(over: Record<string, unknown> = {}) {
    const onApply = vi.fn();
    const onClear = vi.fn();
    const utils = render(
      <BulkToolbar
        selectedIds={["i-1", "i-2"]}
        selectedCount={2}
        members={MEMBERS}
        labels={LABELS}
        onApply={onApply}
        onClear={onClear}
        {...over}
      />
    );
    return { onApply, onClear, ...utils };
  }

  it("renders the selected count and is axe-clean", async () => {
    const { container } = renderToolbar();
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("applies a setStatus request by default", () => {
    const { onApply } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({
      issueIds: ["i-1", "i-2"],
      action: "setStatus",
      status: "Open",
    });
  });

  it("applies a setPriority request", () => {
    const { onApply } = renderToolbar();
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "setPriority" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Priority" }), {
      target: { value: "Urgent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({
      issueIds: ["i-1", "i-2"],
      action: "setPriority",
      priority: "Urgent",
    });
  });

  it("applies an assign request (Unassigned maps to null)", () => {
    const { onApply } = renderToolbar();
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "assign" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({
      issueIds: ["i-1", "i-2"],
      action: "assign",
      assigneeId: null,
    });
  });

  it("applies adding a label once one is chosen", () => {
    const { onApply } = renderToolbar();
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "addLabels" },
    });
    // Apply is disabled until a label is selected.
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: "bug" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith({
      issueIds: ["i-1", "i-2"],
      action: "addLabels",
      labelIds: ["la-1"],
    });
  });

  it("disables actions and shows a note when a bulk op is not allowed", async () => {
    const { container } = renderToolbar({ disabled: true, disabledNote: "Bulk actions need one workspace." });
    expect(screen.getByText("Bulk actions need one workspace.")).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Action" })).not.toBeInTheDocument();
    expect((screen.getByRole("button", { name: "Apply" }) as HTMLButtonElement).disabled).toBe(true);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("clear selection calls onClear", () => {
    const { onClear } = renderToolbar();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("delete requires confirmation, cancel aborts, confirm sends the delete request", async () => {
    const { onApply } = renderToolbar();
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "delete" },
    });

    // Coral warning + danger-styled trigger; no request yet.
    expect(screen.getByText("Deleting cannot be undone.")).toBeInTheDocument();
    const trigger = screen.getByRole("button", { name: "Delete…" });
    expect(trigger.className).toContain("btn--danger");
    expect(onApply).not.toHaveBeenCalled();

    fireEvent.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Delete 2 issues?");
    expect(dialog).toHaveTextContent("This cannot be undone.");

    // Cancel aborts.
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onApply).not.toHaveBeenCalled();

    // Confirm sends the delete action.
    fireEvent.click(trigger);
    const confirmDialog = await screen.findByRole("dialog");
    fireEvent.click(within(confirmDialog).getByRole("button", { name: "Delete" }));
    expect(onApply).toHaveBeenCalledWith({ issueIds: ["i-1", "i-2"], action: "delete" });
  });
});