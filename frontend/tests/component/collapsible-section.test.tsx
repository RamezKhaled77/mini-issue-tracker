import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CollapsibleSection } from "../../src/components/CollapsibleSection.js";

const STORAGE_KEY = "mini-issue-tracker:test-section";

function renderSection() {
  return render(
    <CollapsibleSection id="test-region" label="Comments" count={3} storageKey={STORAGE_KEY}>
      <p>Section content</p>
    </CollapsibleSection>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("CollapsibleSection", () => {
  it("renders expanded by default with label, count and content", () => {
    renderSection();

    const toggle = screen.getByRole("button", { name: /Comments/ });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Section content")).toBeVisible();
    expect(screen.getByRole("region", { name: "Comments" })).toBeInTheDocument();
  });

  it("collapses on click and reports aria-expanded", () => {
    renderSection();

    const toggle = screen.getByRole("button", { name: /Comments/ });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    const section = document.querySelector(".collapsible-section");
    expect(section?.classList.contains("collapsible-section--collapsed")).toBe(true);
  });

  it("expands again after collapsing", () => {
    renderSection();

    const toggle = screen.getByRole("button", { name: /Comments/ });
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("remembers a collapsed choice across remounts", () => {
    const first = renderSection();
    fireEvent.click(screen.getByRole("button", { name: /Comments/ }));
    first.unmount();

    renderSection();

    expect(screen.getByRole("button", { name: /Comments/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("remembers an explicit open choice across remounts", () => {
    localStorage.setItem(STORAGE_KEY, "open");

    renderSection();

    expect(screen.getByRole("button", { name: /Comments/ })).toHaveAttribute("aria-expanded", "true");
  });

  it("omits the count when none is provided", () => {
    render(
      <CollapsibleSection id="test-region" label="Activity" storageKey={STORAGE_KEY}>
        <p>Section content</p>
      </CollapsibleSection>
    );

    expect(document.querySelector(".section-count")).toBeNull();
    expect(screen.getByRole("button", { name: "Activity" })).toBeInTheDocument();
  });
});
