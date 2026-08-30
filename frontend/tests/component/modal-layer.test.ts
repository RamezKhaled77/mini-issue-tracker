import { afterEach, describe, expect, it } from "vitest";
import {
  isModalOpen,
  registerModal,
  resetModalLayer,
  unregisterModal,
} from "../../src/lib/modalLayer.js";

afterEach(() => {
  resetModalLayer();
});

describe("modalLayer", () => {
  it("starts closed", () => {
    expect(isModalOpen()).toBe(false);
  });

  it("toggles with register/unregister", () => {
    registerModal();
    expect(isModalOpen()).toBe(true);
    unregisterModal();
    expect(isModalOpen()).toBe(false);
  });

  it("brackets nested open states (counter)", () => {
    registerModal();
    registerModal();
    expect(isModalOpen()).toBe(true);
    unregisterModal();
    expect(isModalOpen()).toBe(true);
    unregisterModal();
    expect(isModalOpen()).toBe(false);
  });

  it("never goes below zero", () => {
    unregisterModal();
    unregisterModal();
    expect(isModalOpen()).toBe(false);
  });
});