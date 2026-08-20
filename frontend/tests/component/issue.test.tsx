import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IssueForm } from "../../src/components/IssueForm.js";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { api } from "../../src/api/client.js";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.get).mockImplementation((path: string) => {
    if (path === "/workspaces/ws-1/labels") {
      return Promise.resolve({
        items: [
          { id: "l1", workspaceId: "ws-1", name: "bug", color: "violet" },
          { id: "l2", workspaceId: "ws-1", name: "ui", color: "indigo" },
        ],
      });
    }
    if (path === "/workspaces/ws-1/members") {
      return Promise.resolve({ items: [{ userId: "u1", email: "bob@example.com", name: "Bob" }] });
    }
    return Promise.resolve({ items: [] });
  });
});

function renderForm() {
  return render(
    <IssueForm
      workspaceId="ws-1"
      projectId="proj-1"
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

describe("IssueForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the required title field", async () => {
    renderForm();
    expect(await screen.findByLabelText("Title")).toBeRequired();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Priority")).toBeInTheDocument();
  });

  it("loads and shows workspace labels with color-aware chips", async () => {
    renderForm();
    expect(await screen.findByText("bug")).toBeInTheDocument();
    expect(screen.getByText("ui")).toBeInTheDocument();
    const chip = screen.getByText("bug").closest(".label-chip");
    expect(chip?.classList.contains("label-chip--violet")).toBe(true);
    expect(screen.getByText("ui").closest(".label-chip")?.classList.contains("label-chip--indigo")).toBe(true);
  });

  it("shows member display names in the assignee picker", async () => {
    renderForm();
    expect(await screen.findByLabelText("Assignee")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bob" })).toBeInTheDocument();
  });

  it("posts a new issue on submit", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({});
    renderForm();
    fireEvent.change(await screen.findByLabelText("Title"), { target: { value: "New bug" } });
    fireEvent.click(screen.getByRole("button", { name: "Create issue" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/projects/proj-1/issues", expect.objectContaining({ title: "New bug" }));
    });
  });

  it("requires a title", async () => {
    renderForm();
    fireEvent.click(screen.getByRole("button", { name: "Create issue" }));
    expect(api.post).not.toHaveBeenCalled();
  });
});