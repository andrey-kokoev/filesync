import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { discoverFragments, syncPortals } from "../src/index.js";

async function createFile(filePath: string, lines: string[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, lines.join("\n"));
}

describe("syncPortals", () => {
  it("syncs fragment content to targets", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");
    await fs.mkdir(docsDir, { recursive: true });

    const sourcePath = path.join(docsDir, "source.md");
    const targetPath = path.join(docsDir, "target.md");

    await createFile(sourcePath, [
      "filesync:portal:portal-intro:start",
      "Hello from source",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await createFile(targetPath, [
      "filesync:portal:portal-intro:start",
      "Old content",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await syncPortals({
      config: {
        portals: [
          {
            source: "docs/source.md",
            targets: ["docs/target.md"],
          },
        ],
      },
      cwd: tempDir,
    });

    const updated = await fs.readFile(targetPath, "utf8");
    expect(updated).toContain("Hello from source");
    expect(updated).not.toContain("Old content");
  });

  it("throws when fragment keys conflict across sources", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");
    await fs.mkdir(docsDir, { recursive: true });

    await createFile(path.join(docsDir, "a.md"), [
      "filesync:portal:portal-intro:start",
      "Alpha",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await createFile(path.join(docsDir, "b.md"), [
      "filesync:portal:portal-intro:start",
      "Beta",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await createFile(path.join(docsDir, "target.md"), [
      "filesync:portal:portal-intro:start",
      "",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await expect(
      syncPortals({
        config: {
          portals: [
            {
              source: "docs/*.md",
              targets: ["docs/target.md"],
            },
          ],
        },
        cwd: tempDir,
      }),
    ).rejects.toThrow("conflicting content");
  });

  it("filters fragments by anchor glob", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");

    await createFile(path.join(docsDir, "source.md"), [
      "filesync:portal:portal-intro:start",
      "Intro",
      "filesync:portal:portal-intro:end",
      "filesync:portal:portal-extra:start",
      "Extra",
      "filesync:portal:portal-extra:end",
      "",
    ]);

    await createFile(path.join(docsDir, "target.md"), [
      "filesync:portal:portal-intro:start",
      "Old intro",
      "filesync:portal:portal-intro:end",
      "filesync:portal:portal-extra:start",
      "Old extra",
      "filesync:portal:portal-extra:end",
      "",
    ]);

    await syncPortals({
      config: {
        portals: [
          {
            source: "docs/source.md",
            anchors: ["portal-intro"],
            targets: ["docs/target.md"],
          },
        ],
      },
      cwd: tempDir,
    });

    const updated = await fs.readFile(path.join(docsDir, "target.md"), "utf8");
    expect(updated).toContain("Intro");
    expect(updated).toContain("Old extra");
  });

  it("errors when target is missing a fragment marker", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");

    await createFile(path.join(docsDir, "source.md"), [
      "filesync:portal:portal-intro:start",
      "Intro",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await createFile(path.join(docsDir, "target.md"), [
      "filesync:portal:portal-other:start",
      "Other",
      "filesync:portal:portal-other:end",
      "",
    ]);

    const results = await syncPortals({
      config: {
        portals: [
          {
            source: "docs/source.md",
            targets: ["docs/target.md"],
          },
        ],
      },
      cwd: tempDir,
    });

    expect(results[0]?.status).toBe("error");
    expect(results[0]?.error?.message).toContain("Missing fragment");
  });

  it("errors on nested fragments", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");

    await createFile(path.join(docsDir, "source.md"), [
      "filesync:portal:outer:start",
      "filesync:portal:inner:start",
      "Inner",
      "filesync:portal:inner:end",
      "filesync:portal:outer:end",
      "",
    ]);

    await createFile(path.join(docsDir, "target.md"), [
      "filesync:portal:outer:start",
      "Old",
      "filesync:portal:outer:end",
      "",
    ]);

    await expect(
      syncPortals({
        config: {
          portals: [
            {
              source: "docs/source.md",
              targets: ["docs/target.md"],
            },
          ],
        },
        cwd: tempDir,
      }),
    ).rejects.toThrow("Nested fragment start");
  });

  it("errors on mismatched fragment end markers", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");

    await createFile(path.join(docsDir, "source.md"), [
      "filesync:portal:portal-intro:start",
      "Intro",
      "filesync:portal:portal-other:end",
      "",
    ]);

    await createFile(path.join(docsDir, "target.md"), [
      "filesync:portal:portal-intro:start",
      "Old",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await expect(
      syncPortals({
        config: {
          portals: [
            {
              source: "docs/source.md",
              targets: ["docs/target.md"],
            },
          ],
        },
        cwd: tempDir,
      }),
    ).rejects.toThrow("does not match start");
  });

  it("errors when a fragment key appears multiple times in a file", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");

    await createFile(path.join(docsDir, "source.md"), [
      "filesync:portal:portal-intro:start",
      "Intro",
      "filesync:portal:portal-intro:end",
      "filesync:portal:portal-intro:start",
      "Intro again",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await createFile(path.join(docsDir, "target.md"), [
      "filesync:portal:portal-intro:start",
      "Old",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    await expect(
      syncPortals({
        config: {
          portals: [
            {
              source: "docs/source.md",
              targets: ["docs/target.md"],
            },
          ],
        },
        cwd: tempDir,
      }),
    ).rejects.toThrow("appears multiple times");
  });

  it("lists discovered fragments with file origin", async () => {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "portals-"));
    const docsDir = path.join(tempDir, "docs");

    await createFile(path.join(docsDir, "source.md"), [
      "filesync:portal:portal-intro:start",
      "Intro",
      "filesync:portal:portal-intro:end",
      "",
    ]);

    const discovered = await discoverFragments({
      config: {
        portals: [
          {
            source: "docs/source.md",
            targets: ["docs/target.md"],
          },
        ],
      },
      cwd: tempDir,
    });

    expect(discovered).toEqual([
      { key: "portal-intro", source: path.join(docsDir, "source.md") },
    ]);
  });
});
