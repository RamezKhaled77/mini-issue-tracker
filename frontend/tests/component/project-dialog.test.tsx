import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { ProjectDialog } from "../../src/components/ProjectDialog.js";

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

const projects = [
  { id: "p1", workspaceId: "ws-1", name: "Frontend", createdAt: "", updatedAt: "" },
  { id: "p2", workspaceId: "ws-1", name: "Backend", createdAt: "", updatedAt: "" },
];

function renderDialog(overrides: Partial<Parameters<typeof ProjectDialog>[0]> = {}) {
  const props = {
    workspaceId: "ws-1",
    projects,
    selectedProject: "p1",
    loading: false,
    onSelectProject: vi.fn(),
    onProjectsChanged: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
  return render(<ProjectDialog {...props} />);
}

describe("ProjectDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a project and selects it", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ project: { ...projects[0], id: "p3", name: "New" } });
    const onProjectsChanged = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onProjectsChanged });
    fireEvent.change(screen.getByPlaceholderText("New project name"), { target: { value: "New" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/workspaces/ws-1/projects", { name: "New" });
      expect(onProjectsChanged).toHaveBeenCalledWith("p3");
    });
  });

  it("renames a project", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({});
    const onProjectsChanged = vi.fn().mockResolvedValue(undefined);
    renderDialog({ onProjectsChanged });
    const row = screen.getByText("Frontend").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Rename" }));
    const input = screen.getByDisplayValue("Frontend");
    fireEvent.change(input, { target: { value: "Frontend App" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/projects/p1", { name: "Frontend App" });
      expect(onProjectsChanged).toHaveBeenCalled();
    });
  });

  it("deletes a project after confirmation", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce(undefined);
    const onSelectProject = vi.fn();
    const onProjectsChanged = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderDialog({ selectedProject: "p1", onSelectProject, onProjectsChanged });
    const row = screen.getByText("Frontend").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/projects/p1");
      expect(onSelectProject).toHaveBeenCalledWith("");
      expect(onProjectsChanged).toHaveBeenCalled();
    });
  });

  it("does not delete when confirmation is cancelled", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderDialog();
    const row = screen.getByText("Frontend").closest("li") as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Delete" }));

    expect(api.delete).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no projects", () => {
    renderDialog({ projects: [] });
    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
  });
});