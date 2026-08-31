import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { WorkspaceSwitcher } from "../../src/components/WorkspaceSwitcher.js";
import type { Workspace } from "@mini-issue-tracker/shared";

function ws(id: string, name: string, isOwner: boolean): Workspace {
  return { id, name, isOwner } as Workspace;
}

function renderSwitcher(overrides: Partial<Parameters<typeof WorkspaceSwitcher>[0]> = {}) {
  return render(
    <MemoryRouter>
      <WorkspaceSwitcher
        currentId="w1"
        workspaces={[ws("w1", "Alpha", true), ws("w2", "Beta", false)]}
        loading={false}
        {...overrides}
      />
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WorkspaceSwitcher", () => {
  it("shows the current workspace name and marks it active", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    expect(screen.getByRole("button", { name: /Switch workspace, currently Alpha/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /currently Alpha/ }));
    const active = screen.getByRole("link", { name: "All workspaces" });
    expect(active).toHaveAttribute("href", "/");
    // Current workspace anchor carries aria-current.
    expect(screen.getByRole("link", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("exposes aria-expanded on the trigger and renders the workspace list", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    const trigger = screen.getByRole("button", { name: /Switch workspace/ });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByText("Alpha").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: /Beta/ })).toBeInTheDocument();
  });

  it("links each workspace to its route", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    await user.click(screen.getByRole("button", { name: /Switch workspace/ }));
    const beta = screen.getByRole("link", { name: /Beta/ });
    expect(beta).toHaveAttribute("href", "/workspaces/w2");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderSwitcher();
    const trigger = screen.getByRole("button", { name: /Switch workspace/ });
    await user.click(trigger);
    expect(screen.getByRole("link", { name: /Beta/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("link", { name: /Beta/ })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows 'All workspaces' when not inside a workspace", () => {
    renderSwitcher({ currentId: undefined });
    expect(screen.getByRole("button", { name: /Switch workspace/ })).toBeInTheDocument();
  });
});