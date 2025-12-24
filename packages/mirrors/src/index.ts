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

export interface LoadedConfig {
  config: MirrorConfig;
  path: string;
}

interface LoadConfigOptions {
  cwd: string;
  configPath?: string | null;
}

async function findConfigPath(cwd: string): Promise<string | null> {
  let current = path.resolve(cwd);

  while (true) {
    const candidate = path.join(current, "filesync.config.json");

    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      const parent = path.dirname(current);
      if (parent === current) {
        return null;
      }
      current = parent;
    }
  }
}

export async function loadConfig(
  options: LoadConfigOptions,
): Promise<LoadedConfig | null> {
  const configPath =
    options.configPath != null
      ? path.resolve(options.cwd, options.configPath)
      : await findConfigPath(options.cwd);

  if (!configPath) {
    return null;
  }

  try {
    const content = await fs.readFile(configPath, "utf8");
    return {
      config: JSON.parse(content) as MirrorConfig,
      path: configPath,
    };
  } catch {
    return null;
  }
}
