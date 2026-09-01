import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { QuickEditSelect } from "../../src/components/QuickEditSelect.js";
import { QuickEditLabels } from "../../src/components/QuickEditLabels.js";
import { QuickEditDate } from "../../src/components/QuickEditDate.js";
import {
  closeQuickEdit,
  isQuickEditing,
  openQuickEdit,
} from "../../src/components/quickEdit.js";
import type { Label } from "@mini-issue-tracker/shared";

function SelectHarness({ onCommit }: { onCommit: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("Open");
  return (
    <QuickEditSelect
      field="status"
      open={open}
      busy={false}
      value={value}
      displayValue={value}
      tone="status-open"
      options={[
        { value: "Open", label: "Open" },
        { value: "In Progress", label: "In Progress" },
      ]}
      onOpen={() => setOpen(true)}
      onCommit={(v) => {
        onCommit(v);
        setValue(v);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

function LabelsHarness({
  onApply,
}: {
  onApply: (labelIds: string[]) => void;
}) {
  const labels: Label[] = [
    { id: "l1", name: "bug", color: "violet", workspaceId: "ws-1" },
    { id: "l2", name: "ui", color: "magenta", workspaceId: "ws-1" },
  ];
  const [open, setOpen] = useState(false);
  return (
    <QuickEditLabels
      open={open}
      busy={false}
      labels={labels}
      selected={[labels[0]]}
      onOpen={() => setOpen(true)}
      onApply={(ids) => {
        onApply(ids);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

function DateHarness({ onApply }: { onApply: (d: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <QuickEditDate
      open={open}
      busy={false}
      dueDate={null}
      onOpen={() => setOpen(true)}
      onApply={(d) => {
        onApply(d);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
    />
  );
}

describe("quickEdit state helper", () => {
  it("enforces one-edit-at-a-time semantics", () => {
    const first = openQuickEdit(null, "iss-1", "status");
    expect(first).toEqual({ issueId: "iss-1", field: "status" });

    const second = openQuickEdit(first, "iss-2", "priority");
    expect(second).toEqual({ issueId: "iss-2", field: "priority" });

    expect(isQuickEditing(second, "iss-2", "priority")).toBe(true);
    expect(isQuickEditing(second, "iss-1", "status")).toBe(false);

    expect(closeQuickEdit(second, "iss-1", "status")).toEqual(second);
    expect(closeQuickEdit(second, "iss-2", "status")).toEqual(second);
    expect(closeQuickEdit(second, "iss-2", "priority")).toBeNull();
    expect(closeQuickEdit(null)).toBeNull();
  });
});

describe("QuickEditSelect", () => {
  it("renders a badge-styled trigger with field + current value in its accessible name", () => {
    render(<SelectHarness onCommit={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Change status, currently Open" })
    ).toBeInTheDocument();
  });

  it("commits on change and returns to the trigger", () => {
    const onCommit = vi.fn();
    render(<SelectHarness onCommit={onCommit} />);
    fireEvent.click(screen.getByRole("button", { name: "Change status, currently Open" }));

    const select = screen.getByRole("combobox", { name: "Change status, currently Open" });
    fireEvent.change(select, { target: { value: "In Progress" } });

    expect(onCommit).toHaveBeenCalledWith("In Progress");
    const trigger = screen.getByRole("button", { name: "Change status, currently In Progress" });
    expect(document.activeElement).toBe(trigger);
  });

  it("Escape cancels with no commit and restores focus to the trigger", () => {
    const onCommit = vi.fn();
    render(<SelectHarness onCommit={onCommit} />);
    const trigger = screen.getByRole("button", { name: "Change status, currently Open" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("combobox"), { key: "Escape" });

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "Change status, currently Open"
    );
  });

  it("exposes aria-expanded on the trigger", () => {
    render(<SelectHarness onCommit={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Change status, currently Open" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    // QuickEditSelect swaps the trigger for a native <select> when open, so the
    // open state is verified by the combobox appearing (not by aria-expanded="true"
    // on a still-mounted trigger, as Select/Date popovers do).
    expect(screen.getByRole("combobox", { name: "Change status, currently Open" })).toBeInTheDocument();
  });
});

describe("QuickEditLabels", () => {
  it("renders label badges as triggers with an accessible summary", () => {
    render(<LabelsHarness onApply={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Change labels, currently bug" })
    ).toBeInTheDocument();
  });

  it("applies the full working set", () => {
    const onApply = vi.fn();
    render(<LabelsHarness onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Change labels, currently bug" }));

    fireEvent.click(screen.getByLabelText("ui"));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(["l1", "l2"]);
  });

  it("discards the working copy on cancel", () => {
    const onApply = vi.fn();
    render(<LabelsHarness onApply={onApply} />);
    const trigger = screen.getByRole("button", { name: "Change labels, currently bug" });

    fireEvent.click(trigger);
    fireEvent.click(screen.getByLabelText("ui"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Reopen: the working copy is re-seeded from the committed set.
    fireEvent.click(trigger);
    expect(screen.getByLabelText("bug")).toBeChecked();
    expect(screen.getByLabelText("ui")).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenCalledWith(["l1"]);
  });

  it("exposes aria-expanded on the trigger", () => {
    render(<LabelsHarness onApply={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Change labels, currently bug" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("Escape cancels and returns focus to the trigger", () => {
    const onApply = vi.fn();
    render(<LabelsHarness onApply={onApply} />);
    const trigger = screen.getByRole("button", { name: "Change labels, currently bug" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("group", { name: "Change labels, currently bug" }), {
      key: "Escape",
    });
    expect(onApply).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });
});

describe("QuickEditDate", () => {
  it("renders a quiet Due placeholder with an honest accessible name", () => {
    render(<DateHarness onApply={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Change due date, currently none" })
    ).toBeInTheDocument();
  });

  it("applies a picked date and clears to null", () => {
    const onApply = vi.fn();
    render(<DateHarness onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: "Change due date, currently none" }));

    fireEvent.change(screen.getByLabelText("Due date"), { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenLastCalledWith("2026-03-01");

    fireEvent.click(screen.getByRole("button", { name: "Change due date, currently none" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear due date" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(onApply).toHaveBeenLastCalledWith(null);
  });

  it("Escape cancels with no apply and restores focus", () => {
    const onApply = vi.fn();
    render(<DateHarness onApply={onApply} />);
    const trigger = screen.getByRole("button", { name: "Change due date, currently none" });
    fireEvent.click(trigger);
    fireEvent.keyDown(screen.getByRole("group", { name: "Change due date, currently none" }), {
      key: "Escape",
    });
    expect(onApply).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });

  it("exposes aria-expanded on the trigger", () => {
    render(<DateHarness onApply={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: "Change due date, currently none" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });
});
