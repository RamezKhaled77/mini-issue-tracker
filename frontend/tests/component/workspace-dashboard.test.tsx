import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { WorkspaceDashboardPage } from "../../src/pages/WorkspaceDashboardPage.js";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    getWorkspaceOverview: vi.fn(),
    post: vi.fn(),
  },
  ApiError: class extends Error {
    status: number;
    code: string;
    fields: Record<string, string>;
    constructor(message: string, status = 500, fields: Record<string, string> = {}) {
      super(message);
      this.status = status;
      this.code = "ERROR";
      this.fields = fields;
    }
  },
}));

import { api } from "../../src/api/client.js";

const MOCK_WORKSPACE_ID = "ws-1";

const MOCK_DASHBOARD_DATA = {
  workspace: { id: "ws-1", name: "Acme Engineering", ownerId: "u-1", isOwner: true },
  stats: {
    byStatus: { Open: 12, "In Progress": 7, Closed: 24 },
    byPriority: { Low: 5, Medium: 8, High: 9, Urgent: 3 },
    total: 43,
    overdue: 3,
  },
  projects: [
    { id: "proj-1", name: "E-Commerce Platform", issueCount: 18, lastActivity: "2024-01-15T10:30:00Z" },
    { id: "proj-2", name: "Marketing Site", issueCount: 12, lastActivity: null },
  ],
  myIssues: [
    {
      id: "issue-1",
      projectId: "proj-1",
      projectName: "E-Commerce Platform",
      title: "Stripe webhook signature verification",
      description: "Signature verification fails under heavy burst traffic...",
      status: "Open" as const,
      priority: "Urgent" as const,
      assigneeId: "u-1",
      assignee: { id: "u-1", name: "Ramez Khaled" },
      dueDate: "2024-02-18",
      labelIds: ["label-1", "label-2"],
      labels: [
        { id: "label-1", workspaceId: "ws-1", name: "backend", color: "indigo" as const },
        { id: "label-2", workspaceId: "ws-1", name: "payment", color: "violet" as const },
      ],
    },
  ],
  overdueIssues: [
    {
      id: "issue-2",
      projectId: "proj-1",
      projectName: "E-Commerce Platform",
      title: "Fix login redirect loop",
      description: null,
      status: "In Progress" as const,
      priority: "High" as const,
      assigneeId: "u-1",
      assignee: { id: "u-1", name: "Ramez Khaled" },
      dueDate: "2024-01-10",
      labelIds: ["label-3"],
      labels: [{ id: "label-3", workspaceId: "ws-1", name: "auth", color: "olive" as const }],
    },
  ],
  recentActivity: [
    {
      id: "act-1",
      issueId: "issue-1",
      actorId: "u-1",
      actorName: "Ramez Khaled",
      type: "issue.updated" as const,
      field: "status" as const,
      fromValue: "Open",
      toValue: "In Progress",
      createdAt: "2024-01-15T10:30:00Z",
    },
  ],
};

const MOCK_PROJECTS = {
  items: [{ id: "proj-1", name: "E-Commerce Platform" }],
};

function renderDashboard(route = `/workspaces/${MOCK_WORKSPACE_ID}/dashboard`) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path="/workspaces/:workspaceId/dashboard" element={<WorkspaceDashboardPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("WorkspaceDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the workspace name as the page title", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("Acme Engineering")).toBeInTheDocument();
  });

  it("renders the issue health overview with counts", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    // Health metrics strip: counts are prominent, labels are uppercase eyebrows.
    expect(await screen.findByText("12")).toBeInTheDocument();
    expect(screen.getAllByText("OPEN").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IN PROGRESS").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CLOSED").length).toBeGreaterThan(0);
    const overdueLabels = screen.getAllByText("OVERDUE");
    expect(overdueLabels.length).toBeGreaterThan(0);
    expect(document.querySelector(".metric-count")).toHaveTextContent("12");
  });

  it("renders my issues using the LedgerRow", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("Stripe webhook signature verification")).toBeInTheDocument();
  });

  it("renders overdue issues", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("Fix login redirect loop")).toBeInTheDocument();
  });

  it("renders the priority distribution", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("URGENT")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
    expect(screen.getByText("LOW")).toBeInTheDocument();
  });

  it("renders projects with issue counts", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("E-Commerce Platform")).toBeInTheDocument();
    expect(screen.getByText("Marketing Site")).toBeInTheDocument();
    expect(screen.getByText("18 issues")).toBeInTheDocument();
    expect(screen.getByText("12 issues")).toBeInTheDocument();
  });

  it("renders recent activity", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("RECENT ACTIVITY")).toBeInTheDocument();
    const actorElements = await screen.findAllByText("Ramez Khaled");
    expect(actorElements.length).toBeGreaterThan(0);
  });

  it("shows error state on fetch failure", async () => {
    vi.mocked(api.getWorkspaceOverview).mockRejectedValue(new Error("Network error"));
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("Network error")).toBeInTheDocument();
  });

  it("shows empty states when no issues are assigned", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue({
      ...MOCK_DASHBOARD_DATA,
      myIssues: [],
      overdueIssues: [],
    });
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("NO ISSUES ASSIGNED")).toBeInTheDocument();
    expect(screen.getByText("NO OVERDUE ISSUES")).toBeInTheDocument();
  });

  it("has a back link to workspaces", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByText("← All workspaces")).toBeInTheDocument();
  });

  it("has a New Issue button", async () => {
    vi.mocked(api.getWorkspaceOverview).mockResolvedValue(MOCK_DASHBOARD_DATA);
    vi.mocked(api.get).mockResolvedValue(MOCK_PROJECTS);

    renderDashboard();

    expect(await screen.findByRole("button", { name: "+ New issue" })).toBeInTheDocument();
  });

  it("renders loading skeleton while fetching", () => {
    vi.mocked(api.getWorkspaceOverview).mockImplementation(() => new Promise(() => {}));
    vi.mocked(api.get).mockImplementation(() => new Promise(() => {}));

    renderDashboard();

    expect(document.querySelector(".skeleton-row")).toBeInTheDocument();
  });
});
