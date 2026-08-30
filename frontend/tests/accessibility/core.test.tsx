import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import { LoginPage } from "../../src/pages/LoginPage.js";
import { SignupPage } from "../../src/pages/SignupPage.js";
import { IssueForm } from "../../src/components/IssueForm.js";
import { Button } from "../../src/components/Button.js";
import { Badge } from "../../src/components/Badge.js";
import { Field } from "../../src/components/Field.js";
import { Dialog } from "../../src/components/Dialog.js";
import { AuthProvider } from "../../src/context/auth.js";
import { Layout } from "../../src/components/Layout.js";
import { DashboardPage } from "../../src/pages/DashboardPage.js";
import { ProjectDialog } from "../../src/components/ProjectDialog.js";
import { LabelsSection } from "../../src/components/LabelsSection.js";
import { SavedViewsSection } from "../../src/components/SavedViewsSection.js";
import type { SavedView } from "@mini-issue-tracker/shared";
import { CollapsibleSection } from "../../src/components/CollapsibleSection.js";
import { WorkspacePage } from "../../src/pages/WorkspacePage.js";
import { IssuePage } from "../../src/pages/IssuePage.js";
import { MyIssuesPage } from "../../src/pages/MyIssuesPage.js";
import { Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { KeyboardShortcutsDialog } from "../../src/components/KeyboardShortcutsDialog.js";
import { registerBindings } from "../../src/lib/shortcuts.js";
import { MentionAutocomplete } from "../../src/components/MentionAutocomplete.js";
import { resetModalLayer } from "../../src/lib/modalLayer.js";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ user: null, items: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    getActivity: vi.fn().mockResolvedValue({ items: [] }),
    getMembers: vi.fn().mockResolvedValue({ items: [] }),
    search: vi.fn(),
    listSavedViews: vi.fn().mockResolvedValue({ items: [] }),
    createSavedView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
  },
  ApiError: class extends Error {},
}));

import { api } from "../../src/api/client.js";

function renderAuthed(children: ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe("accessibility", () => {
  it("global search overlay is axe-clean when opened and with results", async () => {
    const { container } = renderAuthed(<Layout />);
    fireEvent.click(screen.getByRole("button", { name: "Search issues" }));
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();

    vi.mocked(api.search).mockResolvedValueOnce({
      total: 1,
      items: [
        {
          id: "a1b2c3d4-0000-4000-8000-000000000001",
          projectId: "proj-1",
          workspaceId: "ws-1",
          title: "Result issue",
          status: "Open",
          priority: "High",
          dueDate: null,
          labelIds: [],
          labels: [],
          assignee: null,
          projectName: "Web",
          workspaceName: "Alpha",
        },
      ],
    });
    const input = screen.getByRole("textbox", { name: "Search issues" });
    fireEvent.change(input, { target: { value: "res" } });
    await screen.findByText("Result issue");
    expect(await axe(container)).toHaveNoViolations();
  });

it("login page has no axe violations", async () => {
    const { container } = renderAuthed(<LoginPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("signup page has no axe violations", async () => {
    const { container } = renderAuthed(<SignupPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("full name field is labelled and axe-clean", async () => {
    const { container } = renderAuthed(<SignupPage />);
    const nameField = screen.getByLabelText("Full name");
    expect(nameField).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("standalone header avatar announces the user's name via role=img", async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: "u1", email: "alice@example.com", name: "Alice Smith" },
      items: [],
    });
    const { container } = renderAuthed(<Layout />);
    const avatar = await screen.findByRole("img", { name: "Alice Smith" });
    expect(avatar).toHaveAttribute("aria-label", "Alice Smith");
    expect(avatar).not.toHaveAttribute("aria-hidden");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("issue form has no axe violations", async () => {
    const { container } = render(
      <IssueForm workspaceId="ws" projectId="proj" onSubmit={vi.fn()} onCancel={vi.fn()} />
    );
    await screen.findAllByRole("option");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Button variants have no axe violations", async () => {
    const { container } = render(
      <>
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
        <Button disabled>Disabled</Button>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Badge variants have no axe violations", async () => {
    const { container } = render(
      <>
        <Badge tone="status-open">Open</Badge>
        <Badge tone="status-in-progress">In Progress</Badge>
        <Badge tone="status-closed">Closed</Badge>
        <Badge tone="priority-low">Low</Badge>
        <Badge tone="priority-medium">Medium</Badge>
        <Badge tone="priority-high">High</Badge>
        <Badge tone="priority-urgent">Urgent</Badge>
        <Badge tone="label-violet">Violet</Badge>
        <Badge tone="label-magenta">Magenta</Badge>
        <Badge tone="label-indigo">Indigo</Badge>
        <Badge tone="label-olive">Olive</Badge>
        <Badge tone="label-sand">Sand</Badge>
        <Badge tone="label-plum">Plum</Badge>
        <Badge tone="neutral">Owner</Badge>
      </>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("CollapsibleSection has no axe violations expanded and collapsed", async () => {
    const { container } = render(
      <CollapsibleSection id="axe-region" label="Comments" count={2} storageKey="mini-issue-tracker:axe">
        <p>Section content</p>
      </CollapsibleSection>
    );
    expect(await axe(container)).toHaveNoViolations();

    fireEvent.click(screen.getByRole("button", { name: /Comments/ }));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Field with error has no axe violations", async () => {
    const { container } = render(
      <Field label="Email" error="Email is required">
        <input type="email" />
      </Field>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Dialog has no axe violations", async () => {
    const { container } = render(
      <Dialog open onClose={vi.fn()} title="Delete project" description="This removes the project and all its issues.">
        <Button variant="secondary">Cancel</Button>
        <Button variant="danger">Delete</Button>
      </Dialog>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Dialog traps focus, closes on Escape, and returns focus on close", async () => {
    const onClose = vi.fn();
    const { container } = render(
      <>
        <Button>Open trigger</Button>
        <Dialog open onClose={onClose} title="Test dialog">
          <Button variant="secondary">Cancel</Button>
          <Button variant="danger">Confirm</Button>
        </Dialog>
      </>
    );

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Confirm" });

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");

    cancel.focus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(confirm);

    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(cancel);

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("skip link is the first focusable element in the shell", () => {
    const { container } = renderAuthed(
      <Layout />
    );
    const skip = screen.getByRole("link", { name: "Skip to content" });
    expect(container.querySelector(".skip-link")).toBe(skip);
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
    );
    expect(focusables[0]).toBe(skip);
  });

  it("app shell has no axe violations", async () => {
    const { container } = renderAuthed(<Layout />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("dashboard has no axe violations", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    const { container } = renderAuthed(<DashboardPage />);
    await screen.findByText(/No workspaces yet/);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("project dialog has no axe violations", async () => {
    const { container } = render(
      <ProjectDialog
        workspaceId="ws-1"
        projects={[
          { id: "p1", workspaceId: "ws-1", name: "Frontend" },
          { id: "p2", workspaceId: "ws-1", name: "Backend" },
        ]}
        selectedProject="p1"
        loading={false}
        onSelectProject={vi.fn()}
        onProjectsChanged={async () => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("project dialog create form has no axe violations", async () => {
    const { container } = render(
      <ProjectDialog
        workspaceId="ws-1"
        projects={[]}
        selectedProject=""
        loading={false}
        onSelectProject={vi.fn()}
        onProjectsChanged={async () => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "New project" }));
    await screen.findByLabelText("Project name");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("workspace page with issues has no axe violations", async () => {
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
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend" }] });
      }
      if (path === "/workspaces/ws-1/views") {
        return Promise.resolve({
          items: [
            {
              id: "view-1",
              workspaceId: "ws-1",
              createdById: "u1",
              name: "Open frontend",
              filters: { version: 1, projectId: "proj-1", status: "Open" },
              filtersValid: true,
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:00.000Z",
            },
          ],
        });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({
          items: [
            {
              id: "iss-1",
              projectId: "proj-1",
              title: "Logout bug",
              description: null,
              status: "Open",
              priority: "Medium",
              assigneeId: "u2",
              assignee: { id: "u2", name: "Sam Rivera" },
              dueDate: null,
              labelIds: [],
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Logout bug");
    const cardAvatar = container.querySelector(".card-assignee .avatar");
    expect(cardAvatar).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".card-assignee")).toHaveTextContent("Sam Rivera");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("issue page with delete confirmation dialog has no axe violations", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1",
            projectId: "proj-1",
            title: "Fix login bug",
            description: "Login button does nothing",
            status: "Open",
            priority: "High",
            assigneeId: "u2",
            assignee: { id: "u2", name: "Sam Rivera" },
            dueDate: null,
            labelIds: [],
          },
        });
      }
      if (path === "/issues/iss-1/comments") {
        return Promise.resolve({
          items: [{ id: "c1", issueId: "iss-1", authorId: "u1", author: { id: "u1", name: "Priya Patel" }, body: "On it", createdAt: "2024-01-01T00:00:00Z" }],
        });
      }
      return Promise.resolve({ items: [] });
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Fix login bug");
    const assigneeAvatar = container.querySelector(".assignee-name .avatar");
    expect(assigneeAvatar).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".assignee-name")).toHaveTextContent("Sam Rivera");
    const authorAvatar = container.querySelector(".comment-author .avatar");
    expect(authorAvatar).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector(".comment-author")).toHaveTextContent("Priya Patel");
    fireEvent.click(screen.getByRole("button", { name: "Delete issue" }));
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("delete confirmation dialog closes on Escape and returns focus", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/issues/iss-1") {
        return Promise.resolve({
          issue: {
            id: "iss-1",
            projectId: "proj-1",
            title: "Fix login bug",
            description: null,
            status: "Open",
            priority: "High",
            assigneeId: null,
            dueDate: null,
            labelIds: [],
          },
        });
      }
      return Promise.resolve({ items: [] });
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );
    const deleteButton = await screen.findByRole("button", { name: "Delete issue" });
    fireEvent.click(deleteButton);
    const dialog = await screen.findByRole("dialog");

    deleteButton.focus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(deleteButton);
  });

  it("keyboard-only flow reaches every interactive element in the shell", () => {
    const { container } = renderAuthed(<Layout />);
    const focusables = Array.from(
      container.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")
    );
    expect(focusables.length).toBeGreaterThan(0);
    focusables.forEach((el) => {
      el.focus();
      expect(document.activeElement).toBe(el);
    });
  });

  it("labels section with create dialog has no axe violations", async () => {
    const { container } = render(
      <LabelsSection
        workspaceId="ws-1"
        labels={[
          { id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" },
          { id: "l2", workspaceId: "ws-1", name: "backend", color: "olive" },
        ]}
        loading={false}
        onChange={async () => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "New label" }));
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("labels section edit dialog has no axe violations", async () => {
    const { container } = render(
      <LabelsSection
        workspaceId="ws-1"
        labels={[{ id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" }]}
        loading={false}
        onChange={async () => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("workspace page with label chips has no axe violations", async () => {
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
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend" }] });
      }
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({
          items: [
            { id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" },
            { id: "l2", workspaceId: "ws-1", name: "backend", color: "olive" },
          ],
        });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({
          items: [
            {
              id: "iss-1",
              projectId: "proj-1",
              title: "Logout bug",
              description: null,
              status: "Open",
              priority: "Medium",
              assigneeId: null,
              dueDate: null,
              labelIds: ["l1", "l2"],
              labels: [
                { id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" },
                { id: "l2", workspaceId: "ws-1", name: "backend", color: "olive" },
              ],
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Logout bug");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("ledger with Quick Edit open and busy states is axe-clean", async () => {
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
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend" }] });
      }
      if (path === "/workspaces/ws-1/labels") {
        return Promise.resolve({
          items: [{ id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" }],
        });
      }
      if (path === "/workspaces/ws-1/members") {
        return Promise.resolve({ items: [{ userId: "u2", name: "Sam Rivera", email: "s@e.com" }] });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({
          items: [
            {
              id: "iss-1",
              projectId: "proj-1",
              title: "Logout bug",
              description: null,
              status: "Open",
              priority: "Medium",
              assigneeId: "u2",
              assignee: { id: "u2", name: "Sam Rivera", email: "s@e.com" },
              dueDate: null,
              labelIds: ["l1"],
              labels: [{ id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" }],
            },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    vi.mocked(api.patch).mockImplementation(() => new Promise(() => {}));

    const { container } = render(
      <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Logout bug");

    // Open state: the status trigger swapped to its select.
    fireEvent.click(screen.getByRole("button", { name: "Change status, currently Open" }));
    const select = screen.getByRole("combobox", { name: "Change status, currently Open" });
    expect(await axe(container)).toHaveNoViolations();

    // Busy state: the PATCH never resolves; the control is disabled + aria-busy.
    fireEvent.change(select, { target: { value: "In Progress" } });
    const busySelect = await screen.findByRole("combobox", {
      name: "Change status, currently Open",
    });
    expect(busySelect).toBeDisabled();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("project dialog delete confirmation has a safe cancel path", async () => {
    const { container } = render(
      <ProjectDialog
        workspaceId="ws-1"
        projects={[{ id: "p1", workspaceId: "ws-1", name: "Frontend" }]}
        selectedProject="p1"
        loading={false}
        onSelectProject={vi.fn()}
        onProjectsChanged={async () => {}}
      />
    );
    const row = container.querySelector("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(await axe(container)).toHaveNoViolations();
  });

  it("my issues page with populated ledger has no axe violations", async () => {
    vi.mocked(api.get).mockResolvedValue({
      overview: {
        total: 2,
        byStatus: { Open: 1, "In Progress": 1, Closed: 0 },
        overdue: 1,
      },
      items: [
        {
          id: "iss-1",
          projectId: "proj-1",
          title: "Logout bug",
          description: null,
          status: "Open",
          priority: "High",
          assigneeId: "u2",
          assignee: { id: "u2", name: "Sam Rivera" },
          dueDate: "2000-01-01",
          labelIds: [],
          labels: [],
          workspaceId: "ws-1",
          projectName: "Frontend",
          workspaceName: "Alpha",
        },
        {
          id: "iss-2",
          projectId: "proj-2",
          title: "Ship nav",
          description: null,
          status: "In Progress",
          priority: "Medium",
          assigneeId: "u1",
          assignee: { id: "u1", name: "Priya Patel" },
          dueDate: null,
          labelIds: [],
          labels: [],
          workspaceId: "ws-2",
          projectName: "Backend",
          workspaceName: "Beta",
        },
      ],
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/my-issues"]}>
        <Routes>
          <Route path="/my-issues" element={<MyIssuesPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("Logout bug");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("my issues page empty state has no axe violations", async () => {
    vi.mocked(api.get).mockResolvedValue({
      overview: {
        total: 0,
        byStatus: { Open: 0, "In Progress": 0, Closed: 0 },
        overdue: 0,
      },
      items: [],
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/my-issues"]}>
        <Routes>
          <Route path="/my-issues" element={<MyIssuesPage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText("No issues assigned to you");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("sidebar My Issues link is keyboard-reachable and axe-clean", async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: "u1", email: "alice@example.com", name: "Alice Smith" },
      items: [],
    });
    const { container } = renderAuthed(<Layout />);
    const link = await screen.findByRole("link", { name: /My Issues/ });
    link.focus();
    expect(document.activeElement).toBe(link);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("workspace ledger with an active bulk selection has no axe violations", async () => {
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/workspaces/ws-1") {
        return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha", ownerId: "u1", isOwner: true } });
      }
      if (path === "/workspaces/ws-1/dashboard") {
        return Promise.resolve({ total: 2, byStatus: { Open: 2, "In Progress": 0, Closed: 0 }, byPriority: { Low: 0, Medium: 2, High: 0, Urgent: 0 } });
      }
      if (path === "/workspaces/ws-1/projects") {
        return Promise.resolve({ items: [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" }] });
      }
      if (path === "/projects/proj-1/issues") {
        return Promise.resolve({
          items: [
            { id: "iss-1", projectId: "proj-1", title: "Fix login", description: null, status: "Open", priority: "High", assigneeId: null, assignee: null, dueDate: null, labelIds: [], labels: [] },
            { id: "iss-2", projectId: "proj-1", title: "Ship nav", description: null, status: "Open", priority: "Medium", assigneeId: null, assignee: null, dueDate: null, labelIds: [], labels: [] },
          ],
        });
      }
      return Promise.resolve({ items: [] });
    });
    const { container } = render(
      <MemoryRouter initialEntries={["/workspaces/ws-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId" element={<WorkspacePage />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText("Fix login");
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Fix login" }));
    expect(await screen.findByRole("group", { name: "Bulk actions" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1 selected");
    expect(await axe(container)).toHaveNoViolations();
  });
});
describe("saved views accessibility", () => {
  const savedViewRow: SavedView = {
    id: "view-1",
    workspaceId: "ws-1",
    createdById: "u1",
    name: "Open frontend",
    filters: { version: 1, projectId: "proj-1", status: "Open" },
    filtersValid: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };

  it("saved views shelf has no axe violations with active and unavailable views", async () => {
    const { container } = render(
      <SavedViewsSection
        workspaceId="ws-1"
        views={[
          savedViewRow,
          {
            ...savedViewRow,
            id: "view-2",
            name: "Broken",
            filtersValid: false,
            filters: undefined,
          },
        ]}
        projects={[{ id: "proj-1", workspaceId: "ws-1", name: "Frontend" }]}
        labels={[]}
        loading={false}
        activeViewId="view-1"
        saveSignal={0}
        getFilters={() => ({ version: 1, projectId: "proj-1" })}
        onSelect={() => {}}
        onChange={async () => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Open frontend" })).toHaveAttribute(
      "aria-current",
      "true"
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("save view dialog has no axe violations", async () => {
    const { container } = render(
      <SavedViewsSection
        workspaceId="ws-1"
        views={[savedViewRow]}
        projects={[{ id: "proj-1", workspaceId: "ws-1", name: "Frontend" }]}
        labels={[]}
        loading={false}
        activeViewId={null}
        saveSignal={1}
        getFilters={() => ({ version: 1, projectId: "proj-1" })}
        onSelect={() => {}}
        onChange={async () => {}}
      />
    );
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("keyboard shortcuts dialog accessibility", () => {
  it("is axe-clean with populated groups and closes via Escape (Spec 009)", async () => {
    const dispose = registerBindings([
      {
        id: "search.slash",
        keys: ["/"],
        context: "global",
        group: "Global",
        description: "Search issues",
        action: () => {},
      },
      {
        id: "nav.dashboard",
        keys: ["g", "d"],
        context: "global",
        group: "Global",
        description: "Go to Dashboard",
        action: () => {},
      },
      {
        id: "issue.edit",
        keys: ["e"],
        context: "issue",
        group: "Issue",
        description: "Edit this issue",
        action: () => {},
      },
    ]);

    const onClose = vi.fn();
    const { container } = render(
      <MemoryRouter>
        <KeyboardShortcutsDialog open onClose={onClose} />
      </MemoryRouter>
    );
    await screen.findByRole("dialog");
    expect(await axe(container)).toHaveNoViolations();

    // Keyboard-only close path.
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    dispose();
    resetModalLayer();
  });
});

describe("mention autocomplete a11y", () => {
  it("MentionAutocomplete listbox has no axe violations", async () => {
    const { container } = render(
      <MentionAutocomplete
        open={true}
        members={[{ userId: "u-1", name: "Alice Smith" }]}
        query="@ali"
        activeIndex={0}
        onSelect={vi.fn()}
        onDismiss={vi.fn()}
        onActiveChange={vi.fn()}
        listBoxId="test-listbox"
      />
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("issue page mention rendering a11y", () => {
  it("issue page with mentions has no axe violations", async () => {
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

    const { container } = render(
      <MemoryRouter initialEntries={["/workspaces/ws-1/issues/iss-1"]}>
        <Routes>
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<IssuePage />} />
        </Routes>
      </MemoryRouter>
    );
    await screen.findByText(/Hey/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
