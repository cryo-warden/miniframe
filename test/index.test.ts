import { describe, it, expect } from "bun:test";
import { miniframe } from "../src";

describe("miniframe", () => {
  it("creates a stateful observable", () => {
    const a = miniframe.state(0);
    expect(a.get()).toBe(0);
  });
});
