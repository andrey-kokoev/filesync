import { describe, expect, it } from "vitest";
import { syncMirrors } from "../src/index.js";

describe("syncMirrors", () => {
  it("returns empty array for empty config", async () => {
    const results = await syncMirrors({
      config: { mirrors: [] },
    });
    expect(results).toEqual([]);
  });
});
