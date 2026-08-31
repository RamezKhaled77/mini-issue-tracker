import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SearchDialog } from "../../src/components/SearchDialog.js";
import type { SearchIssue } from "@mini-issue-tracker/shared";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
    bulkUpdate: vi.fn(),
  },
  ApiError: class extends Error {},
}));

import { api } from "../../src/api/client.js";

const result: SearchIssue = {
  id: "a1b2c3d4-0000-4000-8000-000000000001",
  projectId: "proj-1",
  workspaceId: "ws-1",
  title: "Fix login flow",
  status: "Open",
  priority: "High",
  dueDate: null,
  labelIds: [],
  labels: [],
  assignee: null,
  projectName: "Web",
  workspaceName: "Alpha",
};

function renderDialog(open = true) {
  return render(
    <MemoryRouter>
      <SearchDialog open={open} onClose={() => {}} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("SearchDialog", () => {
  it("shows the initial guidance and makes no request below the minimum length", async () => {
    renderDialog();
    expect(screen.getByText("Find issues across your workspaces.")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox", { name: "Search issues" }), { target: { value: "a" } });
    vi.advanceTimersByTime(500);
    expect(api.search).not.toHaveBeenCalled();
  });

  it("debounces input and renders ledger-style results with context and count", async () => {
    vi.mocked(api.search).mockResolvedValue({ total: 2, items: [result] });
    renderDialog();

    const input = screen.getByRole("textbox", { name: "Search issues" });
    fireEvent.change(input, { target: { value: "lo" } });
    expect(api.search).not.toHaveBeenCalled(); // not yet debounced
    fireEvent.change(input, { target: { value: "login" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText("#A1B2C3")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 results · showing first 1");
    expect(screen.getByText("Fix login flow")).toBeInTheDocument();
    // Spec 012 drift resolution: search rows use the caption slot for the
    // project name (the "Workspace / Project" context run was removed).
    expect(screen.getByText("Web")).toBeInTheDocument();
    const row = screen.getByRole("link", { name: /Fix login flow/ });
    expect(row.getAttribute("href")).toBe("/workspaces/ws-1/issues/a1b2c3d4-0000-4000-8000-000000000001");
    expect(row.className).toContain("ledger-row--search");
    expect(row.getAttribute("data-priority")).toBe("high");

    // Only one request for the final query (debounce coalesced).
    expect(api.search).toHaveBeenCalledTimes(1);
    expect(api.search).toHaveBeenCalledWith("login", { limit: 20, signal: expect.any(AbortSignal) });
  });

  it("shows an honest no-results message without fabricating suggestions", async () => {
    vi.mocked(api.search).mockResolvedValue({ total: 0, items: [] });
    renderDialog();

    fireEvent.change(screen.getByRole("textbox", { name: "Search issues" }), { target: { value: "zzz" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText(/No issues match “zzz”/)).toBeInTheDocument();
  });

  it("surfaces errors via the alert styling", async () => {
    vi.mocked(api.search).mockRejectedValue(new Error("Search exploded"));
    renderDialog();

    fireEvent.change(screen.getByRole("textbox", { name: "Search issues" }), { target: { value: "boom" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByText("Search exploded")).toBeInTheDocument();
  });

  it("discards stale responses so older requests never overwrite newer results", async () => {
    let resolveFirst: (v: { total: number; items: SearchIssue[] }) => void = () => {};
    vi.mocked(api.search)
      .mockImplementationOnce(() => new Promise((res) => { resolveFirst = res; }))
      .mockResolvedValueOnce({ total: 0, items: [] });

    renderDialog();
    const input = screen.getByRole("textbox", { name: "Search issues" });
    fireEvent.change(input, { target: { value: "first query" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    fireEvent.change(input, { target: { value: "second query" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // Second (newer) request resolved already; the first one resolves late.
    resolveFirst({ total: 99, items: [result] });
    await vi.advanceTimersByTimeAsync(0);
    expect(screen.queryByText("Fix login flow")).not.toBeInTheDocument();
    expect(screen.getByText(/No issues match “second query”/)).toBeInTheDocument();
  });

  it("supports arrow-key navigation and Enter activation", async () => {
    const second: SearchIssue = { ...result, id: "b2c3d4e5-0000-4000-8000-000000000002", title: "Second issue", workspaceId: "ws-2" };
    vi.mocked(api.search).mockResolvedValue({ total: 2, items: [result, second] });
    renderDialog();

    fireEvent.change(screen.getByRole("textbox", { name: "Search issues" }), { target: { value: "iss" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByText("Fix login flow")).toBeInTheDocument();

    const rows = screen.getAllByRole("link");
    expect(rows[0].className).toContain("ledger-row--active");

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search issues" }), { key: "ArrowDown" });
    expect(rows[1].className).toContain("ledger-row--active");

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search issues" }), { key: "Enter" });
    // Navigation is handled by react-router; the row remains a valid link target.
    expect(rows[1].getAttribute("href")).toBe("/workspaces/ws-2/issues/b2c3d4e5-0000-4000-8000-000000000002");
  });
});
