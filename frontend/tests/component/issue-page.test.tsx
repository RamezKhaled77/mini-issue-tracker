import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { IssuePage } from "../../src/pages/IssuePage.js";

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

const issue = {
  id: "iss-1",
  projectId: "proj-1",
  title: "Fix login bug",
  description: "Login button does nothing",
  status: "Open",
  priority: "High",
  assigneeId: null,
  assignee: null,
  dueDate: null,
  labelIds: [],
  labels: [],
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        <Route path="/workspaces/:workspaceId" element={<p>workspace landing</p>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("IssuePage delete flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ issue, items: [] });
  });

  it("shows a delete button with confirmation", async () => {
    renderPage();
    const button = await screen.findByRole("button", { name: "Delete issue" });
    expect(button).toBeInTheDocument();
  });

  it("deletes the issue after confirming in the dialog and navigates back", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce(undefined);
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    fireEvent.click(screen.getByRole("button", { name: "Delete issue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete issue confirmation" }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/issues/iss-1");
      expect(screen.getByText("workspace landing")).toBeInTheDocument();
    });
  });

  it("does not delete when the dialog is cancelled", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    fireEvent.click(screen.getByRole("button", { name: "Delete issue" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(api.delete).not.toHaveBeenCalled();
  });

  it("surfaces delete errors without navigating", async () => {
    vi.mocked(api.delete).mockRejectedValueOnce(new Error("Not a member of this workspace"));
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    fireEvent.click(screen.getByRole("button", { name: "Delete issue" }));
    fireEvent.click(await screen.findByRole("button", { name: "Delete issue confirmation" }));

    await waitFor(() => {
      expect(screen.getByText("Not a member of this workspace")).toBeInTheDocument();
    });
    expect(screen.queryByText("workspace landing")).not.toBeInTheDocument();
  });
});

describe("IssuePage assignee (US2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the assignee display name when assigned", async () => {
    vi.mocked(api.get).mockResolvedValue({
      issue: { ...issue, assigneeId: "u-2", assignee: { id: "u-2", name: "Priya Patel" } },
      items: [],
    });
    renderPage();
    expect(await screen.findByText("Priya Patel")).toBeInTheDocument();
  });

  it("renders Unassigned when no assignee is set", async () => {
    vi.mocked(api.get).mockResolvedValue({ issue, items: [] });
    renderPage();
    expect(await screen.findByText("Unassigned")).toBeInTheDocument();
    expect(screen.queryByText("u-2")).not.toBeInTheDocument();
  });
});

describe("IssuePage labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders embedded labels with their color tone in the fact rail", async () => {
    vi.mocked(api.get).mockResolvedValue({
      issue: {
        ...issue,
        labelIds: ["l1", "l2"],
        labels: [
          { id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" },
          { id: "l2", workspaceId: "ws-1", name: "backend", color: "olive" },
        ],
      },
      items: [],
    });
    renderPage();
    expect(await screen.findByText("bug")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
    const rail = document.querySelector(".fact-list");
    const violetBadge = rail?.querySelector(".badge--label-violet");
    expect(violetBadge?.textContent).toContain("bug");
  });

  it("omits the labels row when the issue has no labels", async () => {
    vi.mocked(api.get).mockResolvedValue({ issue, items: [] });
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    const rows = Array.from(document.querySelectorAll(".fact-list .fact-label"));
    expect(rows.some((r) => r.textContent === "Labels")).toBe(false);
  });
});

describe("IssuePage comment author (US3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function mockCommentsWithAuthor(author: { id: string; name: string } | null) {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({ issue, items: [] });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [
            {
              id: "c1",
              issueId: "iss-1",
              authorId: author?.id ?? "u-1",
              author,
              body: "On it",
              createdAt: "2024-01-01T00:00:00Z",
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
  }

  it("renders each comment author's display name", async () => {
    mockCommentsWithAuthor({ id: "u-1", name: "Priya Patel" });
    renderPage();
    expect(await screen.findByText("On it")).toBeInTheDocument();
    expect(screen.getByText("Priya Patel")).toBeInTheDocument();
    expect(screen.queryByText("u-1")).not.toBeInTheDocument();
  });

  it("renders the email local-part fallback for a legacy author", async () => {
    mockCommentsWithAuthor({ id: "u-legacy", name: "legacy-commenter" });
    renderPage();
    expect(await screen.findByText("On it")).toBeInTheDocument();
    expect(screen.getByText("legacy-commenter")).toBeInTheDocument();
    expect(screen.queryByText("u-legacy")).not.toBeInTheDocument();
  });
});

describe("IssuePage keyboard shortcuts (Spec 009)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.get).mockResolvedValue({ issue, items: [] });
  });

  function press(key: string, init: KeyboardEventInit = {}) {
    fireEvent.keyDown(document.body, { key, ...init });
  }

  it("opens the edit dialog with E", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    press("e");
    expect(await screen.findByText("Update the details of this issue.")).toBeInTheDocument();
  });

  it("opens the delete confirmation with D and never deletes directly", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    press("d");
    expect(
      await screen.findByRole("button", { name: "Delete issue confirmation" })
    ).toBeInTheDocument();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it("focuses the comment composer with C", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    press("c");
    const composer = screen.getByPlaceholderText("Add a comment");
    await waitFor(() => expect(document.activeElement).toBe(composer));
  });

  it("does not fire E while typing in the composer", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    const composer = screen.getByPlaceholderText("Add a comment");
    composer.focus();
    press("e");
    expect(screen.queryByText("Update the details of this issue.")).not.toBeInTheDocument();
  });

  it("does not fire issue shortcuts while a dialog is open (FR-06)", async () => {
    renderPage();
    await screen.findByRole("button", { name: "Delete issue" });
    // Open the delete-confirmation dialog via its button; its panel (not an input) holds focus.
    fireEvent.click(screen.getByRole("button", { name: "Delete issue" }));
    await screen.findByRole("button", { name: "Delete issue confirmation" });
    press("e");
    expect(screen.queryByText("Update the details of this issue.")).not.toBeInTheDocument();
  });
});