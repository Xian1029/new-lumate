import { describe, expect, it } from "vitest";
import { BLOCK_REGISTRY, USER_ADDABLE_BLOCKS } from "./registry";

describe("manual block palette", () => {
  it("keeps core learning blocks available without offering duplicate manual entries", () => {
    for (const type of ["notes", "quiz", "flashcards", "forecast", "plan"] as const) {
      expect(USER_ADDABLE_BLOCKS).not.toContain(type);
      expect(BLOCK_REGISTRY[type]).toBeDefined();
    }
    expect(USER_ADDABLE_BLOCKS).toContain("review");
    expect(USER_ADDABLE_BLOCKS).toContain("progress");
  });
});
