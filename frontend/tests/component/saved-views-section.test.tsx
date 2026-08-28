import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { SavedViewsSection } from "../../src/components/SavedViewsSection.js";
import type { Label, Project, SavedView } from "@mini-issue-tracker/shared";

vi.mock("../../src/api/client.js", () => ({
  api: {
    listSavedViews: vi.fn(),
    createSavedView: vi.fn(),
    updateSavedView: vi.fn(),
    deleteSavedView: vi.fn(),
  },
}));

import { api } from "../../src/api/client.js";

const projects: Project[] = [{ id: "proj-1", workspaceId: "ws-1", name: "Frontend" }];
const labels: Label[] = [{ id: "lab-1", workspaceId: "ws-1", name: "bug", color: "violet" }];

function view(overrides: Partial<SavedView> = {}): SavedView {
  return {
    id: "view-1",
    workspaceId: "ws-1",
    createdById: "u1",
    name: "My high priority",
    filters: { version: 1, projectId: "proj-1", priority: "High" },
    filtersValid: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function renderSection(views: SavedView[], props: Record<string, unknown> = {}) {
  return render(
    <SavedViewsSection
      workspaceId="ws-1"
      views={views}
      projects={projects}
      labels={labels}
      loading={false}
      activeViewId={null}
      saveSignal={0}
      getFilters={() => ({ version: 1, projectId: "proj-1" })}
      onSelect={vi.fn()}
      onChange={async () => {}}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SavedViewsSection", () => {
  it("renders saved views as rows", () => {
    renderSection([view()]);
    expect(screen.getByRole("button", { name: "My high priority" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows the empty state when there are no views", () => {
    renderSection([]);
    expect(screen.getByText("No saved views yet")).toBeInTheDocument();
  });

  it("marks the active view with aria-current", () => {
    renderSection([view()], { activeViewId: "view-1" });
    expect(screen.getByRole("button", { name: "My high priority" })).toHaveAttribute(
      "aria-current",
      "true"
    );
  });

  it("renders unreadable views as unavailable and not applicable", () => {
    renderSection([view({ filtersValid: false, filters: undefined, name: "Broken" })]);
    expect(screen.getByRole("button", { name: "Broken" })).toBeDisabled();
    expect(screen.getByText("unavailable")).toBeInTheDocument();
  });

  it("marks views with a stale project as unavailable", () => {
    renderSection([view({ filters: { version: 1, projectId: "gone" } })]);
    expect(screen.getByText("project unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My high priority" })).toBeDisabled();
  });

  it("marks views with a stale label but keeps them applicable", () => {
    renderSection([view({ filters: { version: 1, projectId: "proj-1", labelId: "gone" } })]);
    expect(screen.getByText("label unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "My high priority" })).toBeEnabled();
  });

  it("creates a view with the captured filters", async () => {
    vi.mocked(api.createSavedView).mockResolvedValueOnce({
      view: view({ id: "view-2", name: "New view" }),
    });
    const onChange = vi.fn(async () => {});
    renderSection([view()], { onChange, saveSignal: 1 });

    const input = await screen.findByLabelText("View name");
    fireEvent.change(input, { target: { value: "New view" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save view" }));

    await waitFor(() => {
      expect(api.createSavedView).toHaveBeenCalledWith("ws-1", {
        name: "New view",
        filters: { version: 1, projectId: "proj-1" },
      });
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("surfaces a duplicate-name error inside the dialog", async () => {
    vi.mocked(api.createSavedView).mockRejectedValueOnce(
      new Error("A view with this name already exists")
    );
    renderSection([view()], { saveSignal: 1 });

    await screen.findByLabelText("View name");
    fireEvent.change(screen.getByLabelText("View name"), {
      target: { value: "My high priority" },
    });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save view" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("A view with this name already exists");
  });

  it("renames a view", async () => {
    vi.mocked(api.updateSavedView).mockResolvedValueOnce({ view: view({ name: "Renamed" }) });
    const onChange = vi.fn(async () => {});
    renderSection([view()], { onChange });

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const input = await screen.findByLabelText("View name");
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.updateSavedView).toHaveBeenCalledWith("view-1", { name: "Renamed" });
    });
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it("deletes a view after confirmation", async () => {
    vi.mocked(api.deleteSavedView).mockResolvedValueOnce(undefined);
    const onChange = vi.fn(async () => {});
    renderSection([view()], { onChange });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete view" }));

    await waitFor(() => expect(api.deleteSavedView).toHaveBeenCalledWith("view-1"));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });
});

