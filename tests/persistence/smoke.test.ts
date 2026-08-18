import { describe, expect, it } from "vitest";

describe("persistence smoke", () => {
  it("loads fake-indexeddb so indexedDB is defined", () => {
    expect(indexedDB).toBeDefined();
  });
});
