import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

function dashboardStats(open: number) {
  return {
    total: open,
    byStatus: { Open: open, "In Progress": 0, Closed: 0 },
    byPriority: { Low: 0, Medium: open, High: 0, Urgent: 0 },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === "/workspaces/ws-1") {
      return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
    }
    if (path === "/workspaces/ws-1/dashboard") {
      return Promise.resolve(dashboardStats(0));
    }
    if (path === "/workspaces/ws-1/projects") {
      return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
    }
    if (path === "/projects/proj-1/issues") {
      return Promise.resolve({ items: [] });
    }
    if (path === "/workspaces/ws-1/labels") {
      return Promise.resolve({ items: [] });
    }
    if (path === "/workspaces/ws-1/members") {
      return Promise.resolve({ items: [] });
    }
    if (path === "/workspaces/ws-1/views") {
      return Promise.resolve({ items: [] });
    }
    return Promise.resolve({ items: [] });
  });
});

function savedView(overrides: Record<string, unknown> = {}) {
  return {
    id: "view-1",
    workspaceId: "ws-1",
    createdById: "u1",
    name: "Open frontend bugs",
    filters: { version: 1, projectId: "proj-1", status: "Open" },
    filtersValid: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
      <Routes>
        <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkspacePage dashboard freshness", () => {
  it("reloads dashboard stats after creating an issue", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      issue: {
        id: "iss-1",
        projectId: "proj-1",
        title: "New bug",
        description: null,
        status: "Open",
        priority: "Medium",
        assigneeId: null,
        dueDate: null,
        labelIds: [],
      },
    });
    renderPage();

    await screen.findByText("Alpha");
    fireEvent.click(screen.getByRole("button", { name: "New issue" }));
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "New bug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create issue" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        "/projects/proj-1/issues",
        expect.objectContaining({ title: "New bug" })
      );
    });
    const dashboardCalls = vi.mocked(api.get).mock.calls.filter(([p]) => p === "/workspaces/ws-1/dashboard");
    expect(dashboardCalls.length).toBe(2);
  });
});

describe("WorkspacePage label filter", () => {
  it("filters issues by label via labelId query param", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") {
        return Promise.resolve(dashboardStats(0));
      }
      if (path === "/workspaces/ws-1/projects") {
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({
          items: [
            { id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" },
            { id: "l2", workspaceId: "ws-1", name: "ui", color: "indigo" },
          ],
        });
      }
      if (path === "/workspaces/ws-1/members") {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({ items: [] });
    });
    renderPage();

    const select = await screen.findByLabelText("Filter by label");
    fireEvent.change(select, { target: { value: "l1" } });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        expect.stringContaining("/projects/proj-1/issues?labelId=l1")
      );
    });
  });

  it("clears the label filter via Clear filters", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") {
        return Promise.resolve(dashboardStats(1));
      }
      if (path === "/workspaces/ws-1/projects") {
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({ items: [{ id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" }] });
      }
      if (path === "/workspaces/ws-1/members") {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({ items: [] });
    });
    renderPage();

    const select = await screen.findByLabelText("Filter by label");
    fireEvent.change(select, { target: { value: "l1" } });
    await screen.findByRole("button", { name: "Clear filters" });
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    await waitFor(() => {
      expect((screen.getByLabelText("Filter by label") as HTMLSelectElement).value).toBe("");
    });
  });
});

describe("WorkspacePage assignee (US2)", () => {
  it("shows the assignee display name on an issue card", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") {
        return Promise.resolve(dashboardStats(1));
      }
      if (path === "/workspaces/ws-1/projects") {
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({
          items: [
            {
              id: "iss-1",
              projectId: "proj-1",
              title: "Fix login",
              description: null,
              status: "Open",
              priority: "High",
              assigneeId: "u-2",
              assignee: { id: "u-2", name: "Priya Patel" },
              dueDate: null,
              labelIds: [],
            },
          ],
        });
      }
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/workspaces/ws-1/members") {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({ items: [] });
    });
    renderPage();

    expect(await screen.findByText("Fix login")).toBeInTheDocument();
    expect(screen.getByText("Priya Patel")).toBeInTheDocument();
    expect(screen.queryByText("u-2")).not.toBeInTheDocument();
  });
});

describe("WorkspacePage overdue ledger rows", () => {
  it("marks overdue rows with the Overdue badge and data-overdue attribute", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") {
        return Promise.resolve(dashboardStats(2));
      }
      if (path === "/workspaces/ws-1/projects") {
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({
          items: [
            { id: "iss-1", projectId: "proj-1", title: "Late task", description: null, status: "Open", priority: "High", assigneeId: null, assignee: null, dueDate: "2000-01-01", labelIds: [] },
            { id: "iss-2", projectId: "proj-1", title: "On time", description: null, status: "Open", priority: "Medium", assigneeId: null, assignee: null, dueDate: "2099-01-01", labelIds: [] },
            { id: "iss-3", projectId: "proj-1", title: "Closed late", description: null, status: "Closed", priority: "Low", assigneeId: null, assignee: null, dueDate: "2000-01-01", labelIds: [] },
          ],
        });
      }
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/workspaces/ws-1/members") {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({ items: [] });
    });
    renderPage();

    const lateRow = (await screen.findByText("Late task")).closest(".ledger-row") as HTMLElement;
    expect(within(lateRow).getByText("Overdue")).toBeInTheDocument();
    expect(lateRow).toHaveAttribute("data-overdue", "true");

    const onTimeRow = screen.getByText("On time").closest(".ledger-row") as HTMLElement;
    expect(within(onTimeRow).queryByText("Overdue")).not.toBeInTheDocument();
    expect(onTimeRow).not.toHaveAttribute("data-overdue");

    const closedLateRow = screen.getByText("Closed late").closest(".ledger-row") as HTMLElement;
    expect(within(closedLateRow).queryByText("Overdue")).not.toBeInTheDocument();
    expect(closedLateRow).not.toHaveAttribute("data-overdue");
  });
});

describe("WorkspacePage bulk actions", () => {
  function mockTwoIssues() {
    vi.mocked(api.listSavedViews).mockResolvedValue({ items: [] } as never);
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") {
        return Promise.resolve(dashboardStats(2));
      }
      if (path === "/workspaces/ws-1/projects") {
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({
          items: [
            { id: "iss-1", projectId: "proj-1", title: "Fix login", description: null, status: "Open", priority: "High", assigneeId: null, assignee: null, dueDate: null, labelIds: [] },
            { id: "iss-2", projectId: "proj-1", title: "Ship nav", description: null, status: "Open", priority: "Medium", assigneeId: null, assignee: null, dueDate: null, labelIds: [] },
          ],
        });
      }
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/workspaces/ws-1/members") {
        return Promise.resolve({ items: [] });
      }
      return Promise.resolve({ items: [] });
    });
  }

  it("toggles a row checkbox without navigating and shows the toolbar", async () => {
    mockTwoIssues();
    renderPage();

    await screen.findByText("Fix login");
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Action" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Fix login" }));

    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Bulk actions" })).toBeInTheDocument();

    // Toggle off — toolbar disappears.
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Fix login" }));
    expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Action" })).not.toBeInTheDocument();
  });

  it("select all visible selects every currently visible issue", async () => {
    mockTwoIssues();
    renderPage();

    await screen.findByText("Fix login");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all visible" }));

    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Select Fix login" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Select Ship nav" })).toBeChecked();

    // Toggling again clears the visible selection.
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all visible" }));
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("applies one bulk request and clears the selection", async () => {
    mockTwoIssues();
    vi.mocked(api.bulkUpdate).mockResolvedValueOnce({ issueIds: ["iss-1"], count: 1 });
    renderPage();

    await screen.findByText("Fix login");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Fix login" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(api.bulkUpdate).toHaveBeenCalledTimes(1);
    });
    expect(api.bulkUpdate).toHaveBeenCalledWith({
      issueIds: ["iss-1"],
      action: "setStatus",
      status: "Open",
    });

    await waitFor(() => {
      expect(screen.queryByText("1 selected")).not.toBeInTheDocument();
    });
    expect(screen.queryByRole("combobox", { name: "Action" })).not.toBeInTheDocument();
  });

  it("surfaces a bulk error in an alert and keeps the selection", async () => {
    mockTwoIssues();
    vi.mocked(api.bulkUpdate).mockRejectedValueOnce(new Error("Bulk failed"));
    renderPage();

    await screen.findByText("Fix login");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Fix login" }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Bulk failed");
    expect(screen.getByText("1 selected")).toBeInTheDocument();
  });

  it("bulk delete goes through the confirmation dialog and clears the selection", async () => {
    mockTwoIssues();
    vi.mocked(api.bulkUpdate).mockResolvedValueOnce({ issueIds: ["iss-1", "iss-2"], count: 2 });
    renderPage();

    await screen.findByText("Fix login");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select all visible" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Action" }), {
      target: { value: "delete" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete…" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.bulkUpdate).toHaveBeenCalledWith({ issueIds: ["iss-1", "iss-2"], action: "delete" });
    });
    await waitFor(() => {
      expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
    });
  });
});
describe("WorkspacePage saved views", () => {
  function mockViews(views: unknown[]) {
    vi.mocked(api.listSavedViews).mockResolvedValue({ items: views } as never);
  }

  it("loads and renders saved views", async () => {
    mockViews([savedView()]);
    renderPage();
    expect(await screen.findByRole("button", { name: "Open frontend bugs" })).toBeInTheDocument();
  });

  it("saves the current filters as a named view", async () => {
    mockViews([]);
    vi.mocked(api.createSavedView).mockResolvedValueOnce({ view: savedView() } as never);
    renderPage();

    await screen.findByText("Frontend");
    fireEvent.change(screen.getByPlaceholderText("Search title or description"), {
      target: { value: "login bug" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save view" }));
    fireEvent.change(await screen.findByLabelText("View name"), {
      target: { value: "Login bugs" },
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save view" }));

    await waitFor(() => {
      expect(api.createSavedView).toHaveBeenCalledWith("ws-1", {
        name: "Login bugs",
        filters: { version: 1, projectId: "proj-1", search: "login bug" },
      });
    });
  });

  it("applying a view restores its filters and switches the project", async () => {
    mockViews([
      savedView({
        id: "view-2",
        name: "Urgent web",
        filters: { version: 1, projectId: "proj-2", priority: "Urgent" },
      }),
    ]);
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") return Promise.resolve(dashboardStats(0));
      if (path === "/workspaces/ws-1/projects") {
        return Promise.resolve({
          items: [
            { id: "proj-1", workspaceId: "ws-1", name: "Frontend" },
            { id: "proj-2", workspaceId: "ws-1", name: "Website" },
          ],
        });
      }
      if (path === "/projects/proj-2/issues?priority=Urgent") {
        return Promise.resolve({ items: [] });
      }
      if (path.startsWith("/projects/")) return Promise.resolve({ items: [] });
      return Promise.resolve({ items: [] });
    });
    renderPage();

    const viewButton = await screen.findByRole("button", { name: "Urgent web" });
    fireEvent.click(viewButton);

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/projects/proj-2/issues?priority=Urgent");
    });
    expect(viewButton).toHaveAttribute("aria-current", "true");
  });

  it("manual filter changes deactivate the active view", async () => {
    mockViews([savedView()]);
    renderPage();

    const viewButton = await screen.findByRole("button", { name: "Open frontend bugs" });
    fireEvent.click(viewButton);
    await waitFor(() => expect(viewButton).toHaveAttribute("aria-current", "true"));

    fireEvent.change(screen.getByPlaceholderText("Search title or description"), {
      target: { value: "something else" },
    });
    await waitFor(() => expect(viewButton).not.toHaveAttribute("aria-current"));
  });

  it("defers applying a view whose project is gone and shows a note", async () => {
    mockViews([savedView({ filters: { version: 1, projectId: "gone" } })]);
    renderPage();

    const viewButton = await screen.findByRole("button", { name: "Open frontend bugs" });
    expect(viewButton).toBeDisabled();
    expect(screen.getByText("project unavailable")).toBeInTheDocument();
  });
});
