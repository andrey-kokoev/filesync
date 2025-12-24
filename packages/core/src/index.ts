import fs from "node:fs/promises";
import path from "node:path";
import type { FindOptions } from "@filesync/types";

const DEFAULT_IGNORE = ["node_modules", ".git"];

export async function findFiles(
  pattern: string,
  options: FindOptions = {},
): Promise<string[]> {
  const cwd = options.cwd ?? process.cwd();
  const ignore = options.ignore ?? DEFAULT_IGNORE;
  const filename = pattern.replace(/^\*\*\//, "");

  async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of entries) {
      if (ignore.includes(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push(...(await walk(fullPath)));
      } else if (entry.isFile() && entry.name === filename) {
        results.push(fullPath);
      }
    }

    return results;
  }

  return walk(cwd);
}

export async function fileEquals(
  filePath: string,
  content: string,
): Promise<boolean> {
  try {
    const existing = await fs.readFile(filePath, "utf8");
    return existing === content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

export interface WriteOptions {
  dryRun?: boolean;
}

export async function writeIfChanged(
  targetPath: string,
  content: string,
  options: WriteOptions = {},
): Promise<boolean> {
  if (await fileEquals(targetPath, content)) {
    return false;
  }

  if (options.dryRun) {
    return true;
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, content);
  return true;
}
