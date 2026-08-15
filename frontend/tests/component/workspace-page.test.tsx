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
    return Promise.resolve({ items: [] });
  });
});

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