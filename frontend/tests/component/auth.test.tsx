import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "../../src/pages/LoginPage.js";
import { SignupPage } from "../../src/pages/SignupPage.js";
import { AuthProvider, useAuth } from "../../src/context/auth.js";
import type { ReactNode } from "react";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ user: null }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class extends Error {
    status: number;
    code: string;
    fields: Record<string, string>;
    constructor(status: number, code: string, message: string, fields: Record<string, string> = {}) {
      super(message);
      this.status = status;
      this.code = code;
      this.fields = fields;
    }
  },
}));

import { api } from "../../src/api/client.js";

function renderWithAuth(children: ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe("LoginPage", () => {
  it("renders email and password fields", () => {
    renderWithAuth(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("displays an error when sign-in fails", async () => {
    const { ApiError } = await import("../../src/api/client.js");
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "Invalid email or password"));
    renderWithAuth(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid email or password")).toBeInTheDocument();
    });
  });

  it("marks required fields as required", () => {
    renderWithAuth(<LoginPage />);
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Password")).toBeRequired();
  });

  it("focuses the email field on mount for keyboard users", () => {
    renderWithAuth(<LoginPage />);
    expect(screen.getByLabelText("Email")).toHaveFocus();
  });

  it("moves focus to the error alert when sign-in fails", async () => {
    const { ApiError } = await import("../../src/api/client.js");
    vi.mocked(api.post).mockRejectedValueOnce(new ApiError(401, "UNAUTHORIZED", "Invalid email or password"));
    renderWithAuth(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Invalid email or password");
      expect(alert).toHaveFocus();
    });
  });

  it("associates field-level errors with the offending input via aria-describedby", async () => {
    const { ApiError } = await import("../../src/api/client.js");
    vi.mocked(api.post).mockRejectedValueOnce(
      new ApiError(422, "VALIDATION", "Invalid sign-in input", { email: "Please enter a valid email" })
    );
    renderWithAuth(<LoginPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "bad@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Please enter a valid email");
      const email = screen.getByLabelText("Email");
      expect(email).toHaveAttribute("aria-invalid", "true");
      expect(email.getAttribute("aria-describedby")).toBe("auth-error");
    });
  });

  it("signs in via keyboard Enter on the password field", async () => {
    const user = userEvent.setup();
    vi.mocked(api.post).mockResolvedValueOnce({ user: { id: "u1", email: "a@b.com" } });
    renderWithAuth(<LoginPage />);
    await user.type(screen.getByLabelText("Email"), "a@b.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/signin", { email: "a@b.com", password: "secret123" });
    });
  });
});

describe("SignupPage", () => {
  it("focuses the confirm field when passwords do not match", async () => {
    renderWithAuth(<SignupPage />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alice Smith" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "different" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => {
      const alert = screen.getByRole("alert");
      expect(alert).toHaveTextContent("Passwords do not match");
      expect(alert).toHaveFocus();
    });
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("aria-invalid", "true");
  });

  it("submits the full name with the signup payload", async () => {
    vi.mocked(api.post).mockResolvedValueOnce({
      user: { id: "u1", email: "a@b.com", name: "Alice Smith" },
    });
    renderWithAuth(<SignupPage />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Alice Smith" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "a@b.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "secret123" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/signup", {
        name: "Alice Smith",
        email: "a@b.com",
        password: "secret123",
      });
    });
  });

  it("marks the full name field as required", () => {
    renderWithAuth(<SignupPage />);
    expect(screen.getByLabelText("Full name")).toBeRequired();
  });
});

describe("auth context", () => {
  it("provides no user when not signed in", async () => {
    let value: string | null = "unset";
    function Probe() {
      const { user } = useAuth();
      value = user ? user.email : "none";
      return null;
    }
    renderWithAuth(<Probe />);
    await waitFor(() => expect(value).toBe("none"));
  });
});