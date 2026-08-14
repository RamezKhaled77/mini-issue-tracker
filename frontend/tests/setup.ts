import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import { toHaveNoViolations } from "vitest-axe/dist/matchers.js";
import "vitest-axe/extend-expect";

expect.extend({ toHaveNoViolations });

afterEach(() => {
  cleanup();
});