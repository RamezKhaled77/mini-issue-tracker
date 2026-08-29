import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { WorkspacePage } from "../../src/pages/WorkspacePage.js";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    bulkUpdate: vi.fn(),
    listSavedViews: vi.fn(),
    createSavedView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
  },
  ApiError: class extends Error {},
}));

import { api } from "../../src/api/client.js";

function issue(overrides: Record<string, unknown> = {}) {
  return {
    id: "iss-1",
    projectId: "proj-1",
    title: "Triage target",
    description: null,
    status: "Open",
    priority: "Medium",
    assigneeId: "u2",
    assignee: { id: "u2", name: "Rami", email: "rami@example.com" },
    dueDate: null,
    labelIds: ["l1"],
    labels: [
      { id: "l1", name: "bug", color: "violet", workspaceId: "ws-1", createdAt: "", updatedAt: "" },
    ],
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

let current = issue();

beforeEach(() => {
  vi.clearAllMocks();
  current = issue();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === "/workspaces/ws-1") {
      return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
    }
    if (path === "/workspaces/ws-1/dashboard") {
      return Promise.resolve({ total: 1, byStatus: { Open: 1, "In Progress": 0, Closed: 0 }, byPriority: { Low: 0, Medium: 1, High: 0, Urgent: 0 } });
    }
    if (path === "/workspaces/ws-1/projects") {
      return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
    }
    if (path === "/projects/proj-1/issues") {
      return Promise.resolve({ items: [current] });
    }
    if (path === "/workspaces/ws-1/labels") {
      return Promise.resolve({ items: [{ id: "l1", name: "bug", color: "violet", workspaceId: "ws-1", createdAt: "", updatedAt: "" }] });
    }
    if (path === "/workspaces/ws-1/members") {
      return Promise.resolve({ items: [{ userId: "u2", name: "Rami", email: "rami@example.com" }] });
    }
    return Promise.resolve({ items: [] });
  });
  vi.mocked(api.listSavedViews).mockResolvedValue({ items: [] } as never);
  vi.mocked(api.patch).mockImplementation(async (_path, body) => {
    current = { ...current, ...(body as Record<string, unknown>) };
    return { issue: current };
  });
});

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
      <Routes>
        <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkspacePage Quick Edit", () => {
  it("keeps the meta run outside the navigation link while title/key still navigate", async () => {
    renderPage();
    const title = await screen.findByText("Triage target");
    const item = title.closest(".ledger-item") as HTMLElement;
    const link = item.querySelector(".ledger-row-link") as HTMLElement;
    expect(link).not.toBeNull();
    expect(link.contains(title)).toBe(true);
    expect(link.querySelector(".ledger-meta")).toBeNull();
    expect(item.querySelector(":scope > .ledger-meta")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Change status, currently Open" })).toBeInTheDocument();
  });

  it("commits a status change through PATCH and reopens with the new value", async () => {
    renderPage();
    await screen.findByText("Triage target");

    fireEvent.click(screen.getByRole("button", { name: "Change status, currently Open" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Change status, currently Open" }), {
      target: { value: "In Progress" },
    });

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/issues/iss-1", { status: "In Progress" });
    });
    await screen.findByRole("button", { name: "Change status, currently In Progress" });
  });

  it("sends assigneeId null when unassigning and a full label set for labels", async () => {
    renderPage();
    await screen.findByText("Triage target");

    fireEvent.click(screen.getByRole("button", { name: "Change assignee, currently Rami" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Change assignee, currently Rami" }), {
      target: { value: "" },
    });
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/issues/iss-1", { assigneeId: null });
    });

    fireEvent.click(screen.getByRole("button", { name: "Change labels, currently bug" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/issues/iss-1", { labelIds: ["l1"] });
    });
  });

  it("shows a row-local Alert and preserves the value when the PATCH fails", async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error("Unprocessable"));
    renderPage();
    await screen.findByText("Triage target");

    fireEvent.click(screen.getByRole("button", { name: "Change status, currently Open" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Change status, currently Open" }), {
      target: { value: "In Progress" },
    });

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Unprocessable");
    // The control stays open with the committed value.
    expect(screen.getByRole("combobox", { name: "Change status, currently Open" })).toBeInTheDocument();
  });

  it("Escape sends no request and the selection checkbox is unaffected", async () => {
    renderPage();
    await screen.findByText("Triage target");

    const checkbox = screen.getByRole("checkbox", { name: "Select Triage target" }) as HTMLInputElement;
    fireEvent.click(screen.getByRole("button", { name: "Change status, currently Open" }));
    fireEvent.keyDown(screen.getByRole("combobox", { name: "Change status, currently Open" }), {
      key: "Escape",
    });

    expect(api.patch).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("combobox", { name: "Change status, currently Open" })
    ).not.toBeInTheDocument();
    expect(checkbox.checked).toBe(false);
    expect(screen.getByRole("button", { name: "Change status, currently Open" })).toBeInTheDocument();
  });

  it("adds a due-date chip with an honest placeholder", async () => {
    renderPage();
    await screen.findByText("Triage target");
    expect(
      screen.getByRole("button", { name: "Change due date, currently none" })
    ).toBeInTheDocument();
  });
});
