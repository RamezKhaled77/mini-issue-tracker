import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LedgerRow } from "../../src/components/LedgerRow.js";

function row(overrides: Parameters<typeof LedgerRow>[0]) {
  render(
    <MemoryRouter>
      <LedgerRow {...overrides} />
    </MemoryRouter>
  );
  return screen.getByRole("link", { name: new RegExp(String(overrides.title)) });
}

describe("LedgerRow", () => {
  it("renders key, title, caption, badges, assignee and due date", () => {
    row({
      to: "/workspaces/w1/issues/i1",
      issueKey: "#A1B2C3",
      title: "Fix login",
      caption: "Auth flow",
      statusBadge: { tone: "status-open", label: "Open" },
      priority: { tone: "priority-high", label: "High" },
      labels: [
        { id: "l1", tone: "label-sand", name: "bug" },
        { id: "l2", tone: "label-plum", name: "ux" },
        { id: "l3", tone: "label-olive", name: "chore" },
      ],
      assignee: { name: "Rami" },
      dueDate: "2026-09-01",
    });
    expect(screen.getByText("#A1B2C3")).toBeInTheDocument();
    expect(screen.getByText("Fix login")).toBeInTheDocument();
    expect(screen.getByText("Auth flow")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
    expect(screen.getByText("Rami")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
  });

  it("caps label badges at 2", () => {
    row({
      to: "/",
      issueKey: "#A",
      title: "Capped",
      labels: [
        { id: "1", tone: "label-sand", name: "a" },
        { id: "2", tone: "label-plum", name: "b" },
        { id: "3", tone: "label-olive", name: "c" },
      ],
    });
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
    expect(screen.queryByText("c")).not.toBeInTheDocument();
  });

  it("hides the due date in the compact variant", () => {
    row({ to: "/", issueKey: "#A", title: "Compact", variant: "compact", dueDate: "2026-09-01" });
    expect(screen.queryByText("2026-09-01")).not.toBeInTheDocument();
  });

  it("marks the row overdue on the li", () => {
    render(
      <MemoryRouter>
        <LedgerRow to="/" issueKey="#A" title="Late" overdue />
      </MemoryRouter>
    );
    const li = screen.getByText("Late").closest("li");
    expect(li).toBeInTheDocument();
    expect(li).not.toBeNull();
    expect(li && li.getAttribute("data-overdue")).toBe("true");
  });

  it("renders a selection checkbox and toggles it", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <LedgerRow
          to="/"
          issueKey="#A"
          title="Selectable"
          selectable={{ checked: false, onChange, label: "Select Selectable" }}
        />
      </MemoryRouter>
    );
    await user.click(screen.getByLabelText("Select Selectable"));
    expect(onChange).toHaveBeenCalled();
  });

  it("renders quick-edit meta outside the navigation link for page rows", () => {
    render(
      <MemoryRouter>
        <ul>
          <LedgerRow
            to="/w/i"
            issueKey="#A"
            title="QE"
            meta={<button type="button">Change status</button>}
          />
        </ul>
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /QE/ });
    expect(link.contains(screen.getByRole("button", { name: "Change status" }))).toBe(false);
  });

  it("renders row metadata inside the link for the compact variant", () => {
    render(
      <MemoryRouter>
        <ul>
          <LedgerRow
            to="/w/i"
            issueKey="#A"
            title="CompactQ"
            variant="compact"
            meta={<button type="button">Change status</button>}
          />
        </ul>
      </MemoryRouter>
    );
    const link = screen.getByRole("link", { name: /CompactQ/ });
    expect(link.contains(screen.getByRole("button", { name: "Change status" }))).toBe(true);
  });
});