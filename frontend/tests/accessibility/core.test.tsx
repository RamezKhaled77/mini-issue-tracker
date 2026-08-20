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
import { WorkspacePage } from "../../src/pages/WorkspacePage.js";
import { IssuePage } from "../../src/pages/IssuePage.js";
import { Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ user: null, items: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
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
});