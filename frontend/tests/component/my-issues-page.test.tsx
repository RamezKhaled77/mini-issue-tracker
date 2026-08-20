import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import type { MyIssue, MyIssuesResponse } from "@mini-issue-tracker/shared";
import { MyIssuesPage } from "../../src/pages/MyIssuesPage.js";
import { issueKey } from "../../src/lib/issueKey.js";

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

function makeIssue(over: Partial<MyIssue>): MyIssue {
  return {
    id: "iss-1",
    projectId: "proj-1",
    title: "Fix login",
    description: null,
    status: "Open",
    priority: "High",
    assigneeId: null,
    assignee: null,
    dueDate: null,
    labelIds: [],
    labels: [],
    workspaceId: "ws-1",
    projectName: "Frontend",
    workspaceName: "Alpha",
    ...over,
  };
}

function makeResponse(items: MyIssue[], over: Partial<MyIssuesResponse["overview"]> = {}): MyIssuesResponse {
  const byStatus = { Open: 0, "In Progress": 0, Closed: 0 };
  for (const item of items) byStatus[item.status] += 1;
  return {
    overview: {
      total: items.length,
      byStatus,
      overdue: items.filter(
        (i) => i.dueDate !== null && i.dueDate < "2000-01-01" && i.status !== "Closed"
      ).length,
      ...over,
    },
    items,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/my-issues"]}>
      <Routes>
        <Route path="/my-issues" element={<MyIssuesPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("MyIssuesPage summary (US1)", () => {
  it("renders the title, total, and stat values from the response", async () => {
    vi.mocked(api.get).mockResolvedValue(
      makeResponse(
        [
          makeIssue({ id: "iss-1", status: "Open" }),
          makeIssue({ id: "iss-2", title: "Ship nav", status: "In Progress", dueDate: "2000-01-01" }),
        ],
        { overdue: 1 }
      )
    );
    const { container } = renderPage();

    expect(await screen.findByText("My Issues")).toBeInTheDocument();
    expect(screen.getByText("2 assigned to you")).toBeInTheDocument();

    const values = container.querySelectorAll(".stat-cell .stat-value");
    expect(values).toHaveLength(3);
    expect(values[0]).toHaveTextContent("1");
    expect(values[1]).toHaveTextContent("1");
    expect(values[2]).toHaveTextContent("1");
    expect(screen.getByText("Overdue", { selector: ".stat-label" })).toBeInTheDocument();
  });

  it("zero-data renders 0 assigned to you and the empty state", async () => {
    vi.mocked(api.get).mockResolvedValue(makeResponse([]));
    renderPage();

    expect(await screen.findByText("0 assigned to you")).toBeInTheDocument();
    expect(await screen.findByText("No issues assigned to you")).toBeInTheDocument();
  });

  it("error response renders the alert with retry", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Failed to load"));
    renderPage();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Failed to load");
  });
});

describe("MyIssuesPage ledger (US2)", () => {
  it("renders ticket key, title, badges, assignee, and workspace/project context", async () => {
    vi.mocked(api.get).mockResolvedValue(
      makeResponse([
        makeIssue({
          id: "iss-1",
          title: "Fix login",
          status: "Open",
          priority: "High",
          assignee: { id: "u2", name: "Priya Patel" },
          labels: [{ id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" }],
        }),
      ])
    );
    renderPage();

    expect(await screen.findByText("Fix login")).toBeInTheDocument();
    expect(screen.getByText(issueKey("iss-1"))).toBeInTheDocument();
    expect(screen.getByText("Alpha / Frontend")).toBeInTheDocument();
    const row = screen.getByText("Fix login").closest(".ledger-row") as HTMLElement;
    expect(within(row).getByText("Open")).toBeInTheDocument();
    expect(within(row).getByText("High")).toBeInTheDocument();
    expect(within(row).getByText("bug")).toBeInTheDocument();
    expect(within(row).getByText("Priya Patel")).toBeInTheDocument();
  });

  it("activating a row navigates to the issue detail URL", async () => {
    vi.mocked(api.get).mockResolvedValue(
      makeResponse([makeIssue({ id: "iss-9", title: "Open it", workspaceId: "ws-7" })])
    );
    render(
      <MemoryRouter initialEntries={["/my-issues"]}>
        <Routes>
          <Route path="/my-issues" element={<MyIssuesPage />} />
          <Route path="/workspaces/:workspaceId/issues/:issueId" element={<div>Issue detail page</div>} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByText("Open it"));
    expect(await screen.findByText("Issue detail page")).toBeInTheDocument();
  });

  it("marks overdue rows with the Overdue badge and data-overdue attribute", async () => {
    vi.mocked(api.get).mockResolvedValue(
      makeResponse([
        makeIssue({ id: "iss-1", title: "Late task", dueDate: "2000-01-01", status: "Open" }),
        makeIssue({ id: "iss-2", title: "On time", dueDate: "2099-01-01", status: "Open" }),
        makeIssue({ id: "iss-3", title: "Closed late", dueDate: "2000-01-01", status: "Closed" }),
      ])
    );
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

describe("MyIssuesPage include closed (US4)", () => {
  it("toggles Include closed to refetch with the flag, adds Closed issues, keeps stats", async () => {
    const active = makeResponse([
      makeIssue({ id: "iss-1", title: "Open A", status: "Open" }),
      makeIssue({ id: "iss-2", title: "In Progress B", status: "In Progress" }),
    ]);
    const all = makeResponse([
      makeIssue({ id: "iss-1", title: "Open A", status: "Open" }),
      makeIssue({ id: "iss-2", title: "In Progress B", status: "In Progress" }),
      makeIssue({ id: "iss-3", title: "Closed C", status: "Closed" }),
    ]);
    vi.mocked(api.get).mockImplementation((path: string) => {
      if (path === "/my-issues?includeClosed=true") return Promise.resolve(all);
      return Promise.resolve(active);
    });

    renderPage();

    expect(await screen.findByText("Open A")).toBeInTheDocument();
    expect(screen.queryByText("Closed C")).not.toBeInTheDocument();
    expect(screen.getByText("2 assigned to you")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Include closed" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/my-issues?includeClosed=true");
    });
    expect(await screen.findByText("Closed C")).toBeInTheDocument();
    expect(screen.getByText("3 assigned to you")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Include closed" }));

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/my-issues");
    });
    await waitFor(() => {
      expect(screen.queryByText("Closed C")).not.toBeInTheDocument();
    });
  });
});

describe("MyIssuesPage search, filter, and sort", () => {
  async function renderWith(issues: MyIssue[]) {
    vi.mocked(api.get).mockResolvedValue(makeResponse(issues));
    renderPage();
    await screen.findByText("My Issues");
    await screen.findByRole("search");
  }

  it("filters the ledger by search text in title and description", async () => {
    await renderWith([
      makeIssue({ id: "iss-1", title: "Fix login", description: "OAuth handshake broken" }),
      makeIssue({ id: "iss-2", title: "Ship nav", description: null }),
    ]);

    const input = screen.getByRole("textbox", { name: "Search your issues" });
    fireEvent.change(input, { target: { value: "oauth" } });

    await waitFor(() => expect(screen.queryByText("Ship nav")).not.toBeInTheDocument());
    expect(screen.getByText("Fix login")).toBeInTheDocument();
    expect(screen.getByText("1 result")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "ship" } });
    await waitFor(() => expect(screen.queryByText("Fix login")).not.toBeInTheDocument());
    expect(screen.getByText("Ship nav")).toBeInTheDocument();
  });

  it("filters by status and priority selects", async () => {
    await renderWith([
      makeIssue({ id: "iss-1", title: "Open high", status: "Open", priority: "High" }),
      makeIssue({ id: "iss-2", title: "Progress low", status: "In Progress", priority: "Low" }),
    ]);

    fireEvent.change(screen.getByRole("combobox", { name: "Filter by status" }), {
      target: { value: "In Progress" },
    });
    await waitFor(() => expect(screen.queryByText("Open high")).not.toBeInTheDocument());
    expect(screen.getByText("Progress low")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Filter by priority" }), {
      target: { value: "Low" },
    });
    await waitFor(() => expect(screen.queryByText("Progress low")).toBeInTheDocument());
    expect(screen.getByText("1 result")).toBeInTheDocument();
  });

  it("sorts by title A-Z and Z-A", async () => {
    await renderWith([
      makeIssue({ id: "iss-1", title: "Zulu", priority: "Low" }),
      makeIssue({ id: "iss-2", title: "Alpha", priority: "High" }),
    ]);

    const sort = screen.getByRole("combobox", { name: "Sort by" });
    const titles = () => Array.from(document.querySelectorAll(".ledger-title")).map((n) => n.textContent);

    fireEvent.change(sort, { target: { value: "title-az" } });
    await waitFor(() => expect(titles()).toEqual(["Alpha", "Zulu"]));

    fireEvent.change(sort, { target: { value: "title-za" } });
    await waitFor(() => expect(titles()).toEqual(["Zulu", "Alpha"]));
  });

  it("sorts by due date earliest first with undated issues last", async () => {
    await renderWith([
      makeIssue({ id: "iss-1", title: "No date", dueDate: null }),
      makeIssue({ id: "iss-2", title: "Later", dueDate: "2026-01-01" }),
      makeIssue({ id: "iss-3", title: "Earlier", dueDate: "2025-01-01" }),
    ]);

    fireEvent.change(screen.getByRole("combobox", { name: "Sort by" }), {
      target: { value: "due-asc" },
    });
    await waitFor(() => {
      const titles = Array.from(document.querySelectorAll(".ledger-title")).map((n) => n.textContent);
      expect(titles).toEqual(["Earlier", "Later", "No date"]);
    });
  });

  it("shows the filtered empty state and clears filters restores the ledger", async () => {
    await renderWith([
      makeIssue({ id: "iss-1", title: "Open A", status: "Open", priority: "High" }),
      makeIssue({ id: "iss-2", title: "Open B", status: "Open", priority: "Low" }),
    ]);

    fireEvent.change(screen.getByRole("textbox", { name: "Search your issues" }), {
      target: { value: "nothing matches" },
    });
    expect(await screen.findByText("No matching issues")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Clear filters/ }));
    await waitFor(() => expect(screen.queryByText("No matching issues")).not.toBeInTheDocument());
    expect(screen.getByText("Open A")).toBeInTheDocument();
    expect(screen.getByText("Open B")).toBeInTheDocument();
    expect(screen.getByText("2 results")).toBeInTheDocument();
  });

  it("clearing filters and sort resets the sort select to default", async () => {
    await renderWith([
      makeIssue({ id: "iss-1", title: "Zulu", priority: "Low" }),
      makeIssue({ id: "iss-2", title: "Alpha", priority: "High" }),
    ]);

    const sort = screen.getByRole("combobox", { name: "Sort by" });
    fireEvent.change(sort, { target: { value: "title-za" } });
    await waitFor(() => {
      const titles = Array.from(document.querySelectorAll(".ledger-title")).map((n) => n.textContent);
      expect(titles).toEqual(["Zulu", "Alpha"]);
    });

    const button = await screen.findByRole("button", { name: /Clear filters/ });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);

    await waitFor(() => expect(sort).toHaveValue("default"));
    const titles = Array.from(document.querySelectorAll(".ledger-title")).map((n) => n.textContent);
    expect(titles).toEqual(["Alpha", "Zulu"]);
  });

  it("does not show the filter bar while loading or on error", async () => {
    vi.mocked(api.get).mockRejectedValue(new Error("Failed to load"));
    renderPage();
    await screen.findByRole("alert");
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });
});