import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FactRail } from "../../src/components/FactRail.js";

describe("FactRail", () => {
  it("renders a definition list with one row per item", () => {
    render(
      <FactRail
        items={[
          { id: "status", label: "Status", value: "Open" },
          { id: "priority", label: "Priority", value: "High" },
        ]}
      />
    );
    const list = document.querySelector("dl.fact-list");
    expect(list).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("renders a default 'Details' eyebrow when no title is provided", () => {
    render(<FactRail items={[{ id: "x", label: "X", value: "y" }]} />);
    expect(screen.getByRole("heading", { level: 2, name: "Details" })).toBeInTheDocument();
  });

  it("renders a custom title when provided", () => {
    render(
      <FactRail
        title="Issue"
        items={[{ id: "x", label: "X", value: "y" }]}
      />
    );
    expect(screen.getByRole("heading", { level: 2, name: "Issue" })).toBeInTheDocument();
  });

  it("renders interactive controls passed as the value", () => {
    render(
      <FactRail
        items={[
          {
            id: "status",
            label: "Status",
            value: (
              <select aria-label="Status">
                <option>Open</option>
              </select>
            ),
          },
        ]}
      />
    );
    expect(screen.getByRole("combobox", { name: "Status" })).toBeInTheDocument();
  });

  it("renders the empty aside (no dl) when items list is empty", () => {
    render(<FactRail items={[]} />);
    expect(document.querySelector("dl.fact-list")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Details" })).toBeInTheDocument();
  });

  it("uses the labelledBy id on the title when provided", () => {
    render(
      <FactRail
        title="Details"
        labelledBy="fact-rail-title"
        items={[{ id: "x", label: "X", value: "y" }]}
      />
    );
    const title = document.getElementById("fact-rail-title");
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent("Details");
  });
});
