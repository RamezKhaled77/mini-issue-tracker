import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "../../src/components/FilterBar.js";

function mockMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = [];
  const mql = {
    matches,
    media: "(max-width: 700px)",
    addEventListener: (_: string, cb: () => void) => {
      listeners.push(cb);
    },
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation(() => mql)
  );
  return { mql, listeners };
}

const baseProps = () => ({
  query: {
    value: "",
    onChange: vi.fn(),
    placeholder: "Search…",
    label: "Search issues",
  },
  selects: [
    {
      id: "status",
      label: "Status",
      value: "",
      options: [
        { value: "", label: "All" },
        { value: "Open", label: "Open" },
      ],
      onChange: vi.fn(),
    },
  ],
  resultCount: <span className="filter-count">3 results</span>,
  isFiltering: false,
  onClear: vi.fn(),
  clearLabel: "Clear filters",
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FilterBar", () => {
  it("renders the search field, status select, and result count", () => {
    mockMatchMedia(false);
    render(<FilterBar {...baseProps()} />);

    expect(screen.getByLabelText("Search issues")).toBeInTheDocument();
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByText("3 results")).toBeInTheDocument();
  });

  it("calls onChange for the search query (controlled)", () => {
    mockMatchMedia(false);
    const props = baseProps();
    render(<FilterBar {...props} />);

    fireEvent.change(screen.getByLabelText("Search issues"), { target: { value: "bug" } });
    expect(props.query.onChange).toHaveBeenCalledWith("bug");
  });

  it("calls onChange for a select control (controlled)", () => {
    mockMatchMedia(false);
    const props = baseProps();
    render(<FilterBar {...props} />);

    fireEvent.change(screen.getByLabelText("Status"), { target: { value: "Open" } });
    expect(props.selects[0].onChange).toHaveBeenCalledWith("Open");
  });

  it("does not render the mobile disclosure toggle on desktop", () => {
    mockMatchMedia(false);
    render(<FilterBar {...baseProps()} />);

    expect(screen.queryByRole("button", { name: "Filters" })).not.toBeInTheDocument();
  });

  it("renders a 'Filters' disclosure toggle on mobile starting collapsed", () => {
    mockMatchMedia(true);
    render(<FilterBar {...baseProps()} />);

    const toggle = screen.getByRole("button", { name: "Filters" });
    // Mobile: filters start collapsed by default.
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("expands and re-collapses the controls region when the toggle is clicked", () => {
    mockMatchMedia(true);
    render(<FilterBar {...baseProps()} />);

    const toggle = screen.getByRole("button", { name: "Filters" });

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("keeps controls mounted while collapsed (display toggle, not unmount)", () => {
    mockMatchMedia(true);
    render(<FilterBar {...baseProps()} />);

    const toggle = screen.getByRole("button", { name: "Filters" });
    // Pre-click: collapsed but controls still in the DOM (focus + form state survive).
    expect(screen.getByLabelText("Search issues")).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(screen.getByLabelText("Search issues")).toBeInTheDocument();
  });

  it("wires the toggle to the controls region via aria-controls", () => {
    mockMatchMedia(true);
    render(<FilterBar {...baseProps()} />);

    const toggle = screen.getByRole("button", { name: "Filters" });
    const controlsId = toggle.getAttribute("aria-controls");
    expect(controlsId).toBeTruthy();
    expect(document.getElementById(controlsId!)).toBeInTheDocument();
  });

  it("does not show the Clear filters affordance when not filtering", () => {
    mockMatchMedia(false);
    render(<FilterBar {...baseProps()} isFiltering={false} />);
    expect(screen.queryByText("Clear filters")).not.toBeInTheDocument();
  });

  it("shows and triggers the Clear filters affordance when filtering", () => {
    mockMatchMedia(false);
    const props = baseProps();
    render(<FilterBar {...props} isFiltering />);

    expect(screen.getByText("Filtering")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Clear filters"));
    expect(props.onClear).toHaveBeenCalledTimes(1);
  });

  it("uses the supplied clearLabel verbatim", () => {
    mockMatchMedia(false);
    render(<FilterBar {...baseProps()} isFiltering clearLabel="Reset" />);
    expect(screen.getByText("Reset")).toBeInTheDocument();
  });

  it("renders the sort select when provided", () => {
    mockMatchMedia(false);
    const props = baseProps();
    render(
      <FilterBar
        {...props}
        sort={{
          label: "Sort by",
          value: "default",
          options: [
            { value: "default", label: "Default" },
            { value: "title-az", label: "Title A–Z" },
          ],
          onChange: vi.fn(),
        }}
      />
    );
    expect(screen.getByLabelText("Sort by")).toBeInTheDocument();
  });

  it("renders the trailing actions node when provided", () => {
    mockMatchMedia(false);
    render(
      <FilterBar
        {...baseProps()}
        actions={<span className="filter-active">A label is unavailable</span>}
      />
    );
    expect(screen.getByText("A label is unavailable")).toBeInTheDocument();
  });

  it("exposes a search landmark via role=search", () => {
    mockMatchMedia(false);
    render(<FilterBar {...baseProps()} />);
    expect(screen.getByRole("search")).toBeInTheDocument();
  });
});