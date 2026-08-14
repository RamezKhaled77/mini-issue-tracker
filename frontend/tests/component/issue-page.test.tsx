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
  dueDate: null,
  labelIds: [],
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