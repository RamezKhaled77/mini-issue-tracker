import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Input } from "../../src/components/Input.js";
import { Select } from "../../src/components/Select.js";
import { Textarea } from "../../src/components/Textarea.js";
import { Checkbox } from "../../src/components/Checkbox.js";

describe("Input", () => {
  it("forwards props and value changes", async () => {
    const onChange = vi.fn();
    render(<Input value="a" onChange={onChange} aria-label="Name" />);
    await userEvent.type(screen.getByLabelText("Name"), "b");
    expect(onChange).toHaveBeenCalled();
  });

  it("exposes invalid state via aria-invalid", () => {
    render(<Input invalid aria-label="Email" />);
    expect(screen.getByLabelText("Email")).toHaveAttribute("aria-invalid", "true");
  });

  it("is not marked invalid by default", () => {
    render(<Input aria-label="Email" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid");
  });
});

describe("Select", () => {
  it("renders options and reports changes", async () => {
    const onChange = vi.fn();
    render(
      <Select value="open" onChange={onChange} aria-label="Status">
        <option value="open">Open</option>
        <option value="closed">Closed</option>
      </Select>
    );
    await userEvent.selectOptions(screen.getByLabelText("Status"), "closed");
    expect(onChange).toHaveBeenCalled();
  });

  it("exposes invalid state via aria-invalid", () => {
    render(<Select invalid aria-label="Status" />);
    expect(screen.getByLabelText("Status")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Textarea", () => {
  it("exposes invalid state via aria-invalid", () => {
    render(<Textarea invalid aria-label="Body" />);
    expect(screen.getByLabelText("Body")).toHaveAttribute("aria-invalid", "true");
  });
});

describe("Checkbox", () => {
  it("associates its own label with the input", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Include closed" onChange={onChange} />);
    const box = screen.getByLabelText("Include closed");
    expect(box).toHaveAttribute("type", "checkbox");
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalled();
  });
});
