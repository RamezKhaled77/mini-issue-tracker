import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "../../src/components/ConfirmDialog.js";

describe("ConfirmDialog", () => {
  it("renders nothing when closed", () => {
    render(
      <ConfirmDialog
        open={false}
        onClose={() => {}}
        title="Delete"
        confirmLabel="Delete"
        onConfirm={() => {}}
      />
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders title, description, cancel, and confirm when open", () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Delete issue"
        description="This cannot be undone."
        confirmLabel="Delete issue confirmation"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Delete issue" })).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Delete issue confirmation" })
    ).toBeInTheDocument();
  });

  it("uses a custom cancel label when provided", () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Delete"
        cancelLabel="Keep"
        confirmLabel="Delete"
        onConfirm={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "Keep" })).toBeInTheDocument();
  });

  it("invokes onConfirm when the confirm button is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Delete"
        confirmLabel="Delete"
        onConfirm={onConfirm}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the cancel button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Delete"
        confirmLabel="Delete"
        onConfirm={() => {}}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape (inherited from Dialog)", async () => {
    const onClose = vi.fn();
    render(
      <ConfirmDialog
        open
        onClose={onClose}
        title="Delete"
        confirmLabel="Delete"
        onConfirm={() => {}}
      />
    );
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("disables both buttons and shows busy label when busy", () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Delete"
        confirmLabel="Delete"
        busy
        busyLabel="Deleting..."
        onConfirm={() => {}}
      />
    );
    const cancel = screen.getByRole("button", { name: "Cancel" });
    const confirm = screen.getByRole("button", { name: "Deleting..." });
    expect(cancel).toBeDisabled();
    expect(confirm).toBeDisabled();
    expect(confirm).toHaveTextContent("Deleting...");
  });

  it("renders the confirm button with the danger (coral) treatment", () => {
    render(
      <ConfirmDialog
        open
        onClose={() => {}}
        title="Delete"
        confirmLabel="Delete"
        onConfirm={() => {}}
      />
    );
    const confirm = screen.getByRole("button", { name: "Delete" });
    expect(confirm).toHaveClass("btn--danger");
  });
});
