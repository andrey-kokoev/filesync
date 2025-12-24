import fs from "node:fs/promises";
import path from "node:path";
import { findFiles, writeIfChanged } from "@filesync/core";
import type { MirrorConfig, SyncOptions, SyncResult } from "@filesync/types";

export interface SyncMirrorsOptions extends SyncOptions {
  config: MirrorConfig;
}

export async function syncMirrors(
  options: SyncMirrorsOptions,
): Promise<SyncResult[]> {
  const {
    config,
    dryRun = false,
    check = false,
    cwd = process.cwd(),
  } = options;
  const results: SyncResult[] = [];

  for (const mirror of config.mirrors) {
    const sources = await findFiles(mirror.source, { cwd });

    for (const source of sources) {
      const content = await fs.readFile(source, "utf8");
      const dir = path.dirname(source);

      for (const target of mirror.targets) {
        const targetPath = path.join(dir, target);

        try {
          const changed = await writeIfChanged(targetPath, content, {
            dryRun: dryRun || check,
          });

          results.push({
            source,
            target: targetPath,
            status: changed
              ? dryRun || check
                ? "updated"
                : "updated"
              : "unchanged",
          });
        } catch (error) {
          results.push({
            source,
            target: targetPath,
            status: "error",
            error: error as Error,
          });
        }
      }
    }
  }

  return results;
}

export async function loadConfig(cwd: string): Promise<MirrorConfig | null> {
  const configPath = path.join(cwd, "filesync.config.json");

  try {
    const content = await fs.readFile(configPath, "utf8");
    return JSON.parse(content) as MirrorConfig;
  } catch {
    return null;
  }
}
