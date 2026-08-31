import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { PageHeader } from "../../src/components/PageHeader.js";

function renderHeader(props: Parameters<typeof PageHeader>[0]) {
  return render(
    <MemoryRouter>
      <PageHeader {...props} />
    </MemoryRouter>
  );
}

describe("PageHeader", () => {
  it("renders the title as an h1", () => {
    renderHeader({ title: "Workspaces" });
    expect(screen.getByRole("heading", { level: 1, name: "Workspaces" })).toBeInTheDocument();
  });

  it("renders a real back link when backTo is provided", () => {
    renderHeader({ title: "Issue", backTo: { to: "/workspaces/w1", label: "Workspace" } });
    const link = screen.getByRole("link", { name: /workspace/i });
    expect(link).toHaveAttribute("href", "/workspaces/w1");
  });

  it("renders eyebrow, meta and action content", () => {
    renderHeader({
      title: "My Issues",
      eyebrow: "Personal",
      meta: <span>3 open</span>,
      actions: <button type="button">New</button>,
    });
    expect(screen.getByText("Personal")).toBeInTheDocument();
    expect(screen.getByText("3 open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("renders no back link when backTo is omitted", () => {
    renderHeader({ title: "Workspaces" });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
