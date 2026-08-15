import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { Invitations } from "../../src/components/Invitations.js";

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

describe("Invitations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not show the generate button for non-owners", () => {
    render(<Invitations workspaceId="ws-1" isOwner={false} />);
    expect(screen.queryByRole("button", { name: "Generate invitation" })).not.toBeInTheDocument();
  });

  it("shows the generated token for owners", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ invitation: { token: "invite-xyz" } });
    render(<Invitations workspaceId="ws-1" isOwner={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate invitation" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/workspaces/ws-1/invitations");
      expect(screen.getByDisplayValue("invite-xyz")).toBeInTheDocument();
    });
  });

  it("surfaces generation errors", async () => {
    vi.mocked(api.post).mockRejectedValueOnce(new Error("Only the owner can invite"));
    render(<Invitations workspaceId="ws-1" isOwner={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Generate invitation" }));

    await waitFor(() => {
      expect(screen.getByText("Only the owner can invite")).toBeInTheDocument();
    });
  });
});