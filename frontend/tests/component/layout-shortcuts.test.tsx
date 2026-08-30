import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "../../src/components/Layout.js";
import { resetModalLayer } from "../../src/lib/modalLayer.js";

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

function renderShell(initialEntries: string[] = ["/"]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<p>dashboard</p>} />
          <Route path="/my-issues" element={<p>my issues page</p>} />
          <Route path="/workspaces/:workspaceId" element={<p>workspace page</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  document.body.innerHTML = "";
  resetModalLayer();
});

function press(key: string, init: KeyboardEventInit = {}) {
  fireEvent.keyDown(document.body, { key, ...init });
}

describe("Layout global shortcuts", () => {
  it("opens search with / (regression)", async () => {
    renderShell();
    press("/");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("opens search with Ctrl+K (regression)", async () => {
    renderShell();
    press("k", { ctrlKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("navigates to Dashboard with G then D", async () => {
    renderShell(["/workspaces/w1"]);
    await screen.findByText("workspace page");
    press("g");
    press("d");
    expect(await screen.findByText("dashboard")).toBeInTheDocument();
  });

  it("navigates to My Issues with G then M", async () => {
    renderShell(["/workspaces/w1"]);
    await screen.findByText("workspace page");
    press("g");
    press("m");
    expect(await screen.findByText("my issues page")).toBeInTheDocument();
  });

  it("opens the help dialog with ?", async () => {
    renderShell();
    press("?", { shiftKey: true });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(
      await screen.findByRole("heading", { name: "Keyboard shortcuts" })
    ).toBeInTheDocument();
  });

  it("opens the help dialog from the footer affordance", async () => {
    renderShell();
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("does not fire while typing in an input", async () => {
    renderShell();
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.focus();
    press("/");
    press("g");
    press("d");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not navigate while a modal is open (FR-06)", async () => {
    renderShell(["/workspaces/w1"]);
    await screen.findByText("workspace page");
    // Open help via the footer affordance — its focus is on the non-input panel, so the
    // typing guard passes; only the modal guard can suppress the sequence.
    fireEvent.click(screen.getByRole("button", { name: "Keyboard shortcuts" }));
    await screen.findByRole("dialog");
    press("g");
    press("d");
    await waitFor(() => expect(screen.queryByText("dashboard")).not.toBeInTheDocument());
    expect(screen.getByText("workspace page")).toBeInTheDocument();
  });
});