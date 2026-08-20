import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { Layout } from "../../src/components/Layout.js";
import { AuthProvider } from "../../src/context/auth.js";

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

function renderLayout() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </MemoryRouter>
  );
}

describe("Layout user identity (US1)", () => {
  it("shows the signed-in user's name in the header", async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: "u1", email: "alice@example.com", name: "Alice Smith" },
    });
    renderLayout();
    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("announces the header avatar with the user's name (standalone identity marker)", async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: "u1", email: "alice@example.com", name: "Alice Smith" },
    });
    renderLayout();
    const avatar = await screen.findByRole("img", { name: "Alice Smith" });
    expect(avatar).toHaveTextContent("AS");
  });

  it("shows a resolved fallback name when the user has no stored name", async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: "u2", email: "bob@example.com", name: "bob" },
    });
    renderLayout();
    const avatar = await screen.findByRole("img", { name: "bob" });
    expect(avatar).toHaveTextContent("B");
  });
});

describe("Layout My Issues navigation (US3)", () => {
  it("renders the My Issues NavLink under a Personal eyebrow", async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: "u1", email: "alice@example.com", name: "Alice Smith" },
    });
    renderLayout();
    const link = await screen.findByRole("link", { name: "My Issues" });
    expect(link).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("marks the My Issues NavLink active on the my-issues route", async () => {
    vi.mocked(api.get).mockResolvedValue({
      user: { id: "u1", email: "alice@example.com", name: "Alice Smith" },
    });
    render(
      <MemoryRouter initialEntries={["/my-issues"]}>
        <AuthProvider>
          <Routes>
            <Route path="/my-issues" element={<Layout />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    );
    const link = await screen.findByRole("link", { name: "My Issues" });
    expect(link).toHaveClass("sidebar-link--active");
  });
});