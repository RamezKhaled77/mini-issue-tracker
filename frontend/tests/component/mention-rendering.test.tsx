import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { IssuePage } from "../../src/pages/IssuePage.js";
import { MemoryRouter, Routes, Route } from "react-router-dom";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getMembers: vi.fn().mockResolvedValue({ items: [] }),
    getActivity: vi.fn().mockResolvedValue({ items: [] }),
  },
  ApiError: class extends Error {},
}));

import { api } from "../../src/api/client.js";

describe("IssuePage mention rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function getCommentBody() {
    return document.querySelector(".comment-body") as HTMLElement;
  }

  it("renders plain comment body when no mentions exist", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1", projectId: "proj-1", title: "Test", description: null,
            status: "Open", priority: "High", assigneeId: null, assignee: null,
            dueDate: null, labelIds: [], labels: [],
          },
          items: [] as never[],
        });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [{
            id: "c1", issueId: "iss-1", authorId: "u-1",
            author: { id: "u-1", name: "Alice" },
            body: "On it",
            createdAt: "2024-01-01T00:00:00Z",
          }],
        });
      }
      return Promise.resolve({ items: [] });
    });
    vi.mocked(api.getMembers).mockResolvedValue({ items: [] });

    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByText("On it")).toBeInTheDocument();
    expect(document.querySelector(".mention")).not.toBeInTheDocument();
  });

  it("renders mention names with the mention class", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1", projectId: "proj-1", title: "Test", description: null,
            status: "Open", priority: "High", assigneeId: null, assignee: null,
            dueDate: null, labelIds: [], labels: [],
          },
          items: [] as never[],
        });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [{
            id: "c1", issueId: "iss-1", authorId: "u-1",
            author: { id: "u-1", name: "Alice" },
            body: "Hey @Bob Jones, check this",
            createdAt: "2024-01-01T00:00:00Z",
            mentions: [{ userId: "u-2", name: "Bob Jones" }],
          }],
        });
      }
      return Promise.resolve({ items: [] });
    });
    vi.mocked(api.getMembers).mockResolvedValue({ items: [{ userId: "u-2", name: "Bob Jones" }] });

    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );

    const body = await screen.findByText(/check this/);
    expect(body.closest(".comment-body")).toBeInTheDocument();
    const mention = screen.getByText("@Bob Jones");
    expect(mention).toBeInTheDocument();
    expect(mention.closest(".mention")).toBeInTheDocument();
  });

  it("highlights multiple distinct mentions in the same comment", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1", projectId: "proj-1", title: "Test", description: null,
            status: "Open", priority: "High", assigneeId: null, assignee: null,
            dueDate: null, labelIds: [], labels: [],
          },
          items: [] as never[],
        });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [{
            id: "c1", issueId: "iss-1", authorId: "u-1",
            author: { id: "u-1", name: "Alice" },
            body: "@Bob Jones and @Alice Smith",
            createdAt: "2024-01-01T00:00:00Z",
            mentions: [
              { userId: "u-2", name: "Bob Jones" },
              { userId: "u-3", name: "Alice Smith" },
            ],
          }],
        });
      }
      return Promise.resolve({ items: [] });
    });
    vi.mocked(api.getMembers).mockResolvedValue({ items: [] });

    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );

    const mentions = await screen.findAllByText(/^@/);
    expect(mentions).toHaveLength(2);
    mentions.forEach((m) => {
      expect(m.closest(".mention")).toBeInTheDocument();
    });
  });

  it("preserves plain text alongside mentions", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1", projectId: "proj-1", title: "Test", description: null,
            status: "Open", priority: "High", assigneeId: null, assignee: null,
            dueDate: null, labelIds: [], labels: [],
          },
          items: [] as never[],
        });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [{
            id: "c1", issueId: "iss-1", authorId: "u-1",
            author: { id: "u-1", name: "Alice" },
            body: "Hey @Bob Jones, thanks!",
            createdAt: "2024-01-01T00:00:00Z",
            mentions: [{ userId: "u-2", name: "Bob Jones" }],
          }],
        });
      }
      return Promise.resolve({ items: [] });
    });
    vi.mocked(api.getMembers).mockResolvedValue({ items: [] });

    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );

    const body = await screen.findByText(/thanks!/);
    expect(body.closest(".comment-body")).toBeInTheDocument();
    expect(screen.getByText("@Bob Jones")).toBeInTheDocument();
  });

  it("does NOT duplicate the mention name when rendering a posted comment", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1", projectId: "proj-1", title: "Test", description: null,
            status: "Open", priority: "High", assigneeId: null, assignee: null,
            dueDate: null, labelIds: [], labels: [],
          },
          items: [] as never[],
        });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [{
            id: "c1", issueId: "iss-1", authorId: "u-1",
            author: { id: "u-1", name: "Alice" },
            body: "@ramez.elzoz.74 ",
            createdAt: "2024-01-01T00:00:00Z",
            mentions: [{ userId: "u-2", name: "ramez.elzoz.74" }],
          }],
        });
      }
      return Promise.resolve({ items: [] });
    });
    vi.mocked(api.getMembers).mockResolvedValue({ items: [] });

    render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );

    // The name must appear exactly once in the rendered comment.
    const body = await screen.findByText(/ramez\.elzoz\.74/);
    const commentBody = body.closest(".comment-body") as HTMLElement;
    expect(commentBody).toBeInTheDocument();
    // One mention span, and the bare name must not leak as plain text.
    expect(commentBody!.querySelectorAll(".mention")).toHaveLength(1);
    expect(commentBody!.textContent).toBe("@ramez.elzoz.74 ");
  });
});