import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { IssuePage } from "../../src/pages/IssuePage.js";
import { WorkspacePage } from "../../src/pages/WorkspacePage.js";
import { IssueForm } from "../../src/components/IssueForm.js";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getActivity: vi.fn().mockResolvedValue({ items: [] }),
    getMembers: vi.fn().mockResolvedValue({ items: [] }),
  },
  ApiError: class extends Error {},
}));

import { api } from "../../src/api/client.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("legacy identity fallback (SC-008)", () => {
  it("renders the email local-part fallback for an assigned legacy user on issue detail", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1",
            projectId: "proj-1",
            title: "Legacy assignee",
            description: null,
            status: "Open",
            priority: "Medium",
            assigneeId: "u-legacy",
            assignee: { id: "u-legacy", name: "legacy-assignee" },
            dueDate: null,
            labelIds: [],
          },
          items: [],
        });
      }
      return Promise.resolve({ items: [] });
    });
    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("legacy-assignee")).toBeInTheDocument();
    expect(screen.queryByText("u-legacy")).not.toBeInTheDocument();
    const assigneeValue = document.querySelector(".assignee-name");
    expect(assigneeValue?.textContent).toContain("legacy-assignee");
    expect(assigneeValue?.textContent).toContain("L");
    expect(assigneeValue?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });

  it("renders the fallback assignee name on an issue card in the workspace list", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") {
        return Promise.resolve({
          total: 1,
          byStatus: { Open: 1, "In Progress": 0, Closed: 0 },
          byPriority: { Low: 0, Medium: 1, High: 0, Urgent: 0 },
        });
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
              title: "Legacy assignee",
              description: null,
              status: "Open",
              priority: "Medium",
              assigneeId: "u-legacy",
              assignee: { id: "u-legacy", name: "legacy-card" },
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
    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("Legacy assignee")).toBeInTheDocument();
    expect(screen.getByText("legacy-card")).toBeInTheDocument();
    expect(screen.queryByText("u-legacy")).not.toBeInTheDocument();
  });

  it("lists a legacy member's fallback name in the assignee picker", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({ items: [] });
      }
      if (path === "/workspaces/ws-1/members") {
        return Promise.resolve({
          items: [{ userId: "u-legacy", email: "legacy-member@example.com", name: "legacy-member" }],
        });
      }
      return Promise.resolve({ items: [] });
    });
    render(
      <IssueForm workspaceId="ws-1" projectId="proj-1" onSubmit={vi.fn()} onCancel={vi.fn()} />
    );

    const select = await screen.findByLabelText("Assignee");
    fireEvent.click(select);
    expect(screen.getByRole("option", { name: "legacy-member" })).toBeInTheDocument();
    expect(screen.queryByText("legacy-member@example.com")).not.toBeInTheDocument();
  });

  it("renders an empty placeholder string nowhere when identity fields are present", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1",
            projectId: "proj-1",
            title: "No empty identity",
            description: null,
            status: "Open",
            priority: "Medium",
            assigneeId: "u1",
            assignee: { id: "u1", name: "Alice Smith" },
            dueDate: null,
            labelIds: [],
          },
          items: [],
        });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [
            {
              id: "c1",
              issueId: "iss-1",
              authorId: "u2",
              author: { id: "u2", name: "bob" },
              body: "On it",
              createdAt: "2024-01-01T00:00:00Z",
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("No empty identity")).toBeInTheDocument();
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("bob")).toBeInTheDocument();
    const assigneeValue = document.querySelector(".assignee-name");
    expect(assigneeValue?.textContent).toContain("Alice Smith");
    expect(assigneeValue?.textContent).toContain("AS");
    expect(assigneeValue?.textContent?.trim().length ?? 0).toBeGreaterThan(0);
  });
});