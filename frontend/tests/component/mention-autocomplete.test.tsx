import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MentionAutocomplete } from "../../src/components/MentionAutocomplete.js";
import type { MentionMember } from "../../src/components/MentionAutocomplete.js";

const members: MentionMember[] = [
  { userId: "u-1", name: "Alice Smith" },
  { userId: "u-2", name: "Bob Jones" },
  { userId: "u-3", name: "Alice Johnson" },
];

function renderAutocomplete(query: string, activeIndex: number = 0) {
  const onSelect = vi.fn();
  const onDismiss = vi.fn();
  const onActiveChange = vi.fn();
  return {
    onSelect,
    onDismiss,
    onActiveChange,
    ...render(
      <MentionAutocomplete
        open={true}
        members={members}
        query={query}
        activeIndex={activeIndex}
        onSelect={onSelect}
        onDismiss={onDismiss}
        onActiveChange={onActiveChange}
        listBoxId="test-listbox"
      />
    ),
  };
}

describe("MentionAutocomplete", () => {
  it("returns null when query does not start with @", () => {
    const { container } = renderAutocomplete("hello");
    expect(container.firstChild).toBeNull();
  });

  it("filters members by name", () => {
    const { onSelect } = renderAutocomplete("@ali");
    const options = screen.getAllByRole("option", {
      hidden: true,
    });
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Alice Smith");
    expect(options[1]).toHaveTextContent("Alice Johnson");
    expect(screen.queryByRole("option", { hidden: true, name: "Bob Jones" })).not.toBeInTheDocument();
  });

  it("renders empty state when no members match", () => {
    const { onDismiss } = renderAutocomplete("@zzz");
    expect(screen.getByText("No matching members")).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("limits results to 10", () => {
    const manyMembers = Array.from({ length: 15 }, (_, i) => ({
      userId: `u-${i}`,
      name: `Member ${i}`,
    }));
    const onSelect = vi.fn();
    const onDismiss = vi.fn();
    const onActiveChange = vi.fn();
    render(
      <MentionAutocomplete
        open={true}
        members={manyMembers}
        query="@m"
        activeIndex={0}
        onSelect={onSelect}
        onDismiss={onDismiss}
        onActiveChange={onActiveChange}
        listBoxId="test-listbox"
      />
    );
    const options = screen.getAllByRole("option", { hidden: true });
    expect(options).toHaveLength(10);
  });

  it("marks the active option with aria-selected", () => {
    const { onActiveChange } = renderAutocomplete("@", 1);
    const options = screen.getAllByRole("option", { hidden: true });
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
  });

  it("has correct listbox aria attributes", () => {
    renderAutocomplete("@");
    const listbox = screen.getByRole("listbox");
    expect(listbox).toHaveAttribute("id", "test-listbox");
    expect(listbox).toHaveAttribute("aria-expanded", "true");
  });

  it("calls onSelect when an item is clicked", () => {
    const { onSelect } = renderAutocomplete("@");
    fireEvent.click(
      screen.getByRole("option", { hidden: true, name: "@ Alice Smith" })
    );
    expect(onSelect).toHaveBeenCalledWith(members[0]);
  });

  it("calls onActiveChange on mouse enter", () => {
    const { onActiveChange } = renderAutocomplete("@");
    const options = screen.getAllByRole("option", { hidden: true });
    fireEvent.mouseEnter(options[2]);
    expect(onActiveChange).toHaveBeenCalledWith(2);
  });

  it("calls onDismiss when Escape is pressed", () => {
    const { onDismiss } = renderAutocomplete("@");
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalled();
  });

  it("calls onActiveChange with correct index on ArrowDown", () => {
    const { onActiveChange } = renderAutocomplete("@");
    fireEvent.keyDown(document.body, { key: "ArrowDown" });
    expect(onActiveChange).toHaveBeenCalledWith(1);
  });

  it("calls onActiveChange with correct index on ArrowUp", () => {
    const { onActiveChange } = renderAutocomplete("@", 1);
    fireEvent.keyDown(document.body, { key: "ArrowUp" });
    expect(onActiveChange).toHaveBeenCalledWith(0);
  });

  it("calls onSelect on Enter", () => {
    const { onSelect } = renderAutocomplete("@");
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith(members[0]);
  });

  it("calls onSelect on Tab", () => {
    const { onSelect } = renderAutocomplete("@");
    fireEvent.keyDown(document.body, { key: "Tab" });
    expect(onSelect).toHaveBeenCalledWith(members[0]);
  });

  it("has a live status region announcing result count", () => {
    renderAutocomplete("@");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("3 results");
  });

  it("announces singular result count", () => {
    renderAutocomplete("@bob");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("1 result");
  });

  it("announces zero result count", () => {
    renderAutocomplete("@xzy");
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("0 results");
  });
});