import fs from "node:fs/promises";
import path from "node:path";
import { writeIfChanged } from "@filesync/core";
import type { PortalConfig, SyncOptions, SyncResult } from "@filesync/types";

const DEFAULT_IGNORE = ["node_modules", ".git"];
const MARKER_REGEX = /^.*filesync:portal:([a-z0-9-]+):(start|end).*$/gm;

export interface SyncPortalsOptions extends SyncOptions {
  config: PortalConfig;
}

export interface DiscoveredFragment {
  key: string;
  source: string;
}

interface FragmentRange {
  key: string;
  startLineStart: number;
  startLineEnd: number;
  endLineStart: number;
  endLineEnd: number;
  contentStart: number;
  contentEnd: number;
}

interface CollectedFragments {
  fragments: Map<string, string>;
  discovered: DiscoveredFragment[];
}

export async function syncPortals(
  options: SyncPortalsOptions,
): Promise<SyncResult[]> {
  const {
    config,
    dryRun = false,
    check = false,
    cwd = process.cwd(),
  } = options;
  const results: SyncResult[] = [];

  for (const portal of config.portals) {
    const collected = await collectFragments(portal, cwd);
    const targets = await findMatchingFiles(portal.targets, { cwd });

    for (const target of targets) {
      try {
        const changed = await updateTarget(target, collected.fragments, {
          dryRun: dryRun || check,
        });

        results.push({
          source: portal.source,
          target,
          status: changed ? "updated" : "unchanged",
        });
      } catch (error) {
        results.push({
          source: portal.source,
          target,
          status: "error",
          error: error as Error,
        });
      }
    }
  }

  return results;
}

export async function discoverFragments(options: {
  config: PortalConfig;
  cwd?: string;
}): Promise<DiscoveredFragment[]> {
  const cwd = options.cwd ?? process.cwd();
  const discovered: DiscoveredFragment[] = [];

  for (const portal of options.config.portals) {
    const collected = await collectFragments(portal, cwd);
    discovered.push(...collected.discovered);
  }

  return discovered;
}

export interface LoadedConfig {
  config: PortalConfig;
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
      config: JSON.parse(content) as PortalConfig,
      path: configPath,
    };
  } catch {
    return null;
  }
}

interface FindOptions {
  cwd: string;
  ignore?: string[];
}

async function findMatchingFiles(
  patterns: string[],
  options: FindOptions,
): Promise<string[]> {
  const cwd = options.cwd;
  const ignore = options.ignore ?? DEFAULT_IGNORE;
  const regexes = patterns.map((pattern) => globToRegExp(pattern));
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (ignore.includes(entry.name)) {
        continue;
      }

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const rel = toPosix(path.relative(cwd, fullPath));
        if (regexes.some((regex) => regex.test(rel))) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(cwd);
  return Array.from(new Set(results));
}

function toPosix(value: string): string {
  return value.split(path.sep).join("/");
}

function globToRegExp(pattern: string): RegExp {
  const normalized = toPosix(pattern).replace(/^\.\//, "");
  let regex = normalized.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  regex = regex.replace(/\*\*/g, ".*");
  regex = regex.replace(/\*/g, "[^/]*");
  regex = regex.replace(/\?/g, "[^/]");
  return new RegExp(`^${regex}$`);
}

function matchAnchors(key: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return true;
  }

  return patterns.some((pattern) => globToRegExp(pattern).test(key));
}

async function collectFragments(
  portal: {
    source: string;
    anchors?: string[];
    targets: string[];
  },
  cwd: string,
): Promise<CollectedFragments> {
  const sources = await findMatchingFiles([portal.source], { cwd });
  const fragments = new Map<string, string>();
  const sourcesByKey = new Map<string, string[]>();
  const discovered: DiscoveredFragment[] = [];

  for (const source of sources) {
    const content = await fs.readFile(source, "utf8");
    const parsed = parseFragments(content, source);

    for (const [key, range] of parsed) {
      if (!matchAnchors(key, portal.anchors)) {
        continue;
      }

      const fragment = content.slice(range.contentStart, range.contentEnd);
      const existing = fragments.get(key);

      if (existing !== undefined && existing !== fragment) {
        const existingSources = sourcesByKey.get(key) ?? [];
        throw new Error(
          `Fragment key "${key}" has conflicting content in ${[
            ...existingSources,
            source,
          ].join(", ")}`,
        );
      }

      fragments.set(key, fragment);
      const list = sourcesByKey.get(key) ?? [];
      list.push(source);
      sourcesByKey.set(key, list);
      discovered.push({ key, source });
    }
  }

  return { fragments, discovered };
}

function parseFragments(
  content: string,
  filePath: string,
): Map<string, FragmentRange> {
  const ranges = new Map<string, FragmentRange>();
  const seen = new Set<string>();
  let active: { key: string; startLineStart: number; startLineEnd: number } | null =
    null;

  MARKER_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MARKER_REGEX.exec(content)) !== null) {
    const key = match[1];
    const type = match[2];
    const lineStart = match.index;
    const lineEnd = findLineEnd(content, lineStart);

    if (type === "start") {
      if (active) {
        throw new Error(`Nested fragment start in ${filePath}`);
      }
      if (seen.has(key)) {
        throw new Error(
          `Fragment key "${key}" appears multiple times in ${filePath}`,
        );
      }
      active = { key, startLineStart: lineStart, startLineEnd: lineEnd };
      seen.add(key);
      continue;
    }

    if (!active) {
      throw new Error(`Fragment end without start in ${filePath}`);
    }
    if (active.key !== key) {
      throw new Error(
        `Fragment end for "${key}" does not match start for "${active.key}" in ${filePath}`,
      );
    }

    ranges.set(key, {
      key,
      startLineStart: active.startLineStart,
      startLineEnd: active.startLineEnd,
      endLineStart: lineStart,
      endLineEnd: lineEnd,
      contentStart: active.startLineEnd,
      contentEnd: lineStart,
    });

    active = null;
  }

  if (active) {
    throw new Error(`Fragment start without end in ${filePath}`);
  }

  return ranges;
}

function findLineEnd(content: string, lineStart: number): number {
  const newlineIndex = content.indexOf("\n", lineStart);
  if (newlineIndex === -1) {
    return content.length;
  }
  return newlineIndex + 1;
}

async function updateTarget(
  targetPath: string,
  fragments: Map<string, string>,
  options: { dryRun: boolean },
): Promise<boolean> {
  const content = await fs.readFile(targetPath, "utf8");
  const ranges = parseFragments(content, targetPath);

  for (const key of fragments.keys()) {
    if (!ranges.has(key)) {
      throw new Error(`Missing fragment "${key}" in ${targetPath}`);
    }
  }

  const sortedRanges = [...ranges.values()].sort(
    (a, b) => a.startLineStart - b.startLineStart,
  );

  let cursor = 0;
  let output = "";

  for (const range of sortedRanges) {
    output += content.slice(cursor, range.contentStart);
    const desired = fragments.get(range.key);
    if (desired !== undefined) {
      output += desired;
    } else {
      output += content.slice(range.contentStart, range.contentEnd);
    }
    cursor = range.contentEnd;
  }

  output += content.slice(cursor);

  return writeIfChanged(targetPath, output, options);
}
