import type { AxeResults } from "vitest-axe";
import type { Assertion } from "vitest";

declare module "vitest" {
  interface Assertion<T = any> {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}

export type { AxeResults, Assertion };