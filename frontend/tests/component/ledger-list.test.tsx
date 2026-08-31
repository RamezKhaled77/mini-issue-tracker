import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LedgerList } from "../../src/components/LedgerList.js";

describe("LedgerList", () => {
  it("renders rows inside a list", () => {
    render(
      <LedgerList ariaLabel="Issues" rows={[<li key="a">Row A</li>, <li key="b">Row B</li>]} />
    );
    const list = screen.getByRole("list", { name: "Issues" });
    expect(list.children.length).toBe(2);
  });

  it("shows skeleton rows with aria-busy while loading", () => {
    const { container } = render(<LedgerList ariaLabel="Issues" rows={[]} loading />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll(".skeleton-row").length).toBeGreaterThan(0);
  });

  it("shows the empty state when there are no rows and an empty config is given", () => {
    render(
      <LedgerList
        ariaLabel="Issues"
        rows={[]}
        empty={{ title: "No issues", description: "Nothing here." }}
      />
    );
    expect(screen.getByText("No issues")).toBeInTheDocument();
    expect(screen.getByText("Nothing here.")).toBeInTheDocument();
  });

  it("renders the mono count caption", () => {
    render(<LedgerList ariaLabel="Issues" rows={[<li key="a">Row</li>]} caption="3 rows" />);
    expect(screen.getByText("3 rows")).toBeInTheDocument();
  });
});