import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, expect } from "vitest";
import { toHaveNoViolations } from "vitest-axe/dist/matchers.js";
import "vitest-axe/extend-expect";

expect.extend({ toHaveNoViolations });

// jsdom in this environment does not expose localStorage (Node experimental
// warning). Provide a minimal in-memory implementation so components and
// tests that touch it exercise their real code paths instead of silently
// falling back to the try/catch guards.
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

afterEach(() => {
  cleanup();
  globalThis.localStorage.clear();
});