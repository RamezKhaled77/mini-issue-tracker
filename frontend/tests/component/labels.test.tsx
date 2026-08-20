import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Label } from "@mini-issue-tracker/shared";
import { LabelsSection } from "../../src/components/LabelsSection.js";

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

function label(id: string, name: string, color: Label["color"]): Label {
  return { id, workspaceId: "ws-1", name, color };
}

function renderSection({ labels, loading = false }: { labels: Label[]; loading?: boolean }) {
  return render(
    <LabelsSection workspaceId="ws-1" labels={labels} loading={loading} onChange={vi.fn()} />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("LabelsSection listing", () => {
  it("shows an empty state when there are no labels", () => {
    renderSection({ labels: [] });
    expect(screen.getByText("No labels yet")).toBeInTheDocument();
  });

  it("renders each label with its name and color swatch", () => {
    renderSection({ labels: [label("l1", "bug", "violet"), label("l2", "backend", "olive")] });
    expect(screen.getByText("bug")).toBeInTheDocument();
    expect(screen.getByText("backend")).toBeInTheDocument();
    expect(screen.getByText("bug").closest(".label-row")?.querySelector(".label-swatch--violet")).toBeTruthy();
    expect(screen.getByText("backend").closest(".label-row")?.querySelector(".label-swatch--olive")).toBeTruthy();
  });
});

describe("LabelsSection create", () => {
  it("creates a label with a chosen color and reloads", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ label: label("l3", "design", "magenta") });
    const onChange = vi.fn();
    render(
      <LabelsSection workspaceId="ws-1" labels={[]} loading={false} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "New label" }));
    fireEvent.change(await screen.findByLabelText("Label name"), { target: { value: "design" } });
    fireEvent.click(screen.getByLabelText("magenta"));
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/workspaces/ws-1/labels", {
        name: "design",
        color: "magenta",
      });
    });
    expect(onChange).toHaveBeenCalled();
  });
});

describe("LabelsSection edit", () => {
  it("renames and recolors a label via PATCH", async () => {
    vi.mocked(api.patch).mockResolvedValueOnce({ label: label("l1", "bug-fix", "plum") });
    const onChange = vi.fn();
    render(
      <LabelsSection
        workspaceId="ws-1"
        labels={[label("l1", "bug", "violet")]}
        loading={false}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const nameInput = await screen.findByLabelText("Label name");
    fireEvent.change(nameInput, { target: { value: "bug-fix" } });
    fireEvent.click(screen.getByLabelText("plum"));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith("/labels/l1", {
        name: "bug-fix",
        color: "plum",
      });
    });
    expect(onChange).toHaveBeenCalled();
  });
});

describe("LabelsSection delete", () => {
  it("deletes a label after confirmation", async () => {
    vi.mocked(api.delete).mockResolvedValueOnce(undefined);
    const onChange = vi.fn();
    render(
      <LabelsSection
        workspaceId="ws-1"
        labels={[label("l1", "bug", "violet")]}
        loading={false}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByText(/Delete "bug"\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Delete label" }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith("/labels/l1");
    });
    expect(onChange).toHaveBeenCalled();
  });
});