#!/usr/bin/env node
import path from "node:path";
import { discoverFragments, loadConfig, syncPortals } from "./index.js";

const argv = process.argv.slice(2);
const args = new Set<string>();
let configPath: string | null = null;

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];

  if (arg === "--config") {
    const value = argv[i + 1];
    if (!value || value.startsWith("-")) {
      console.error("filesync-portals: --config requires a path");
      process.exit(1);
    }
    configPath = value;
    i++;
    continue;
  }

  if (arg.startsWith("--config=")) {
    const value = arg.slice("--config=".length);
    if (!value) {
      console.error("filesync-portals: --config requires a path");
      process.exit(1);
    }
    configPath = value;
    continue;
  }

  args.add(arg);
}

if (args.has("--help") || args.has("-h")) {
  console.log(`
@filesync/portals

Sync named fragments across files.

Usage:
  filesync-portals [options]

Options:
  --config    Path to filesync.config.json
  --dry-run   Report changes without writing files
  --check     Exit non-zero if changes would be made
  --list      Print each discovered fragment anchor
  --quiet     Only print errors
  --help, -h  Show this help
`);
  process.exit(0);
}

const dryRun = args.has("--dry-run");
const check = args.has("--check");
const list = args.has("--list");
const quiet = args.has("--quiet");

function log(message: string): void {
  if (!quiet) {
    console.log(message);
  }
}

const cwd = process.cwd();
const loadedConfig = await loadConfig({ cwd, configPath });

if (!loadedConfig) {
  console.error("No filesync.config.json found");
  process.exit(1);
}

const config = loadedConfig.config;

if (list) {
  const discovered = await discoverFragments({ config, cwd });
  for (const fragment of discovered) {
    log(`${path.relative(cwd, fragment.source)}:${fragment.key}`);
  }
  process.exit(0);
}

const results = await syncPortals({
  config,
  dryRun,
  check,
  cwd,
});

let changedCount = 0;

for (const result of results) {
  if (result.status === "error") {
    console.error(`error: ${result.target}: ${result.error?.message}`);
  } else if (result.status === "updated") {
    changedCount++;
    log(`synced ${path.relative(cwd, result.target)}`);
  }
}

if (check && changedCount > 0) {
  console.error(`filesync-portals: ${changedCount} fragment(s) out of sync`);
  process.exit(1);
}
