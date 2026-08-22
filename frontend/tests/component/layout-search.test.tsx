import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ total: 0, items: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
    bulkUpdate: vi.fn(),
  },
  ApiError: class extends Error {},
}));

vi.mock("../../src/context/auth.js", () => ({
  useAuth: () => ({ user: { id: "u1", name: "Test", email: "t@example.com" }, signout: vi.fn() }),
}));

import { api } from "../../src/api/client.js";
import { Layout } from "../../src/components/Layout.js";

function renderShell() {
  return render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Layout global search trigger", () => {
  it("renders the Search trigger and opens the overlay on click", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Search issues" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Find issues across your workspaces.")).toBeInTheDocument();
  });

  it("opens search with / on the page body but not while typing in an input", async () => {
    renderShell();
    // Body context: shortcut fires.
    fireEvent.keyDown(document.body, { key: "/" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();

    // Escape closes (Dialog contract).
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape", bubbles: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    // Typing "/" inside an input must not open search.
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: "/", bubbles: true });
    expect(api.search).not.toHaveBeenCalled();
    // Re-open via click still works afterwards.
    fireEvent.click(screen.getByRole("button", { name: "Search issues" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("opens with Ctrl+K as the secondary shortcut", async () => {
    renderShell();
    fireEvent.keyDown(document.body, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
