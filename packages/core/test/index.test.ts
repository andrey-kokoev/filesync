import { describe, expect, it } from "vitest";
import { fileEquals } from "../src/index.js";

describe("fileEquals", () => {
  it("returns false for non-existent file", async () => {
    const result = await fileEquals("/does/not/exist.txt", "content");
    expect(result).toBe(false);
  });
});
