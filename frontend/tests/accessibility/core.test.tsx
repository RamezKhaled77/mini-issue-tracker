import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { axe } from "vitest-axe";
import { LoginPage } from "../../src/pages/LoginPage.js";
import { SignupPage } from "../../src/pages/SignupPage.js";
import { IssueForm } from "../../src/components/IssueForm.js";
import { AuthProvider } from "../../src/context/auth.js";
import type { ReactNode } from "react";

vi.mock("../../src/api/client.js", () => ({
  api: {
    get: vi.fn().mockResolvedValue({ user: null, items: [] }),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  ApiError: class extends Error {},
}));

function renderAuthed(children: ReactNode) {
  return render(
    <MemoryRouter>
      <AuthProvider>{children}</AuthProvider>
    </MemoryRouter>
  );
}

describe("accessibility", () => {
  it("login page has no axe violations", async () => {
    const { container } = renderAuthed(<LoginPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("signup page has no axe violations", async () => {
    const { container } = renderAuthed(<SignupPage />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("issue form has no axe violations", async () => {
    const { container } = render(
      <IssueForm workspaceId="ws" projectId="proj" onSubmit={vi.fn()} onCancel={vi.fn()} />
    );
    await screen.findAllByRole("option");
    expect(await axe(container)).toHaveNoViolations();
  });
});