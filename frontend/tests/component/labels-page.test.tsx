import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { LabelsPage } from "../../src/pages/LabelsPage.js";

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

beforeEach(() => {
  vi.clearAllMocks();
});

function mockApi() {
  (api.get as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
    if (path === "/workspaces/ws-1") {
      return Promise.resolve({ workspace: { id: "ws-1", name: "Alpha" } });
    }
    if (path === "/workspaces/ws-1/labels") {
      return Promise.resolve({
        items: [{ id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" }],
      });
    }
    return Promise.resolve({ items: [] });
  });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/workspaces/ws-1/labels"]}>
      <Routes>
        <Route path="workspaces/:workspaceId/labels" element={<LabelsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("LabelsPage", () => {
  it("renders the workspace name as the title and lists labels", async () => {
    mockApi();
    renderPage();
    expect(await screen.findByRole("heading", { level: 1, name: "Alpha" })).toBeInTheDocument();
    expect(await screen.findByText("bug")).toBeInTheDocument();
  });

  it("links back to the workspace and exposes the New label action", async () => {
    mockApi();
    renderPage();
    expect(await screen.findByText("bug")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to issues/ })).toHaveAttribute(
      "href",
      "/workspaces/ws-1"
    );
    expect(screen.getByRole("button", { name: "New label" })).toBeInTheDocument();
  });
});