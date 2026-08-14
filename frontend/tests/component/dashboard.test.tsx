import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardPage } from "../../src/pages/DashboardPage.js";

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

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>
  );
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers the join flow when the user has no workspaces", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    renderDashboard();

    expect(await screen.findByText(/No workspaces yet/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Join a workspace" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste an invitation token to join")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join workspace" })).toBeInTheDocument();
  });

  it("redeems a token and refreshes the workspace list", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ items: [] });
    vi.mocked(api.post).mockResolvedValueOnce({});
    vi.mocked(api.get).mockResolvedValueOnce({
      items: [{ id: "ws-1", name: "Team Alpha", ownerId: "u1", isOwner: false }],
    });
    renderDashboard();

    await screen.findByText(/No workspaces yet/);
    fireEvent.change(screen.getByPlaceholderText("Paste an invitation token to join"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join workspace" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/workspaces/join", { token: "token-abc" });
    });
    expect(await screen.findByText("Team Alpha")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Join a workspace" })).not.toBeInTheDocument();
  });

  it("shows the join error inline", async () => {
    vi.mocked(api.get).mockResolvedValue({ items: [] });
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Invalid or expired invitation"));
    renderDashboard();

    await screen.findByText(/No workspaces yet/);
    fireEvent.change(screen.getByPlaceholderText("Paste an invitation token to join"), {
      target: { value: "bad-token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join workspace" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid or expired invitation")).toBeInTheDocument();
    });
  });
});