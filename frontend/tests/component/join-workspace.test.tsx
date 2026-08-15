import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JoinWorkspace } from "../../src/components/JoinWorkspace.js";

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

describe("JoinWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redeems an invitation token on submit", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({});
    render(<JoinWorkspace />);
    fireEvent.change(screen.getByPlaceholderText("Paste an invitation token to join"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join workspace" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/workspaces/join", { token: "token-abc" });
    });
  });

  it("calls onJoined after a successful redeem", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({});
    const onJoined = vi.fn();
    render(<JoinWorkspace onJoined={onJoined} />);
    fireEvent.change(screen.getByPlaceholderText("Paste an invitation token to join"), {
      target: { value: "token-abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Join workspace" }));

    await waitFor(() => {
      expect(onJoined).toHaveBeenCalled();
    });
  });
});