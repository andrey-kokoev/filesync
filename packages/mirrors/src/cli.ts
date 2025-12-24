#!/usr/bin/env node
import path from "node:path";
import { loadConfig, syncMirrors } from "./index.js";

const args = new Set(process.argv.slice(2));

if (args.has("--help") || args.has("-h")) {
  console.log(`
@filesync/mirrors

Sync one file to multiple destinations.

Usage:
  filesync-mirrors [options]

Options:
  --dry-run   Report changes without writing files
  --check     Exit non-zero if changes would be made
  --list      Print each source file discovered
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
const config = await loadConfig(cwd);

if (!config) {
  console.error("No filesync.config.json found");
  process.exit(1);
}

const results = await syncMirrors({
  config,
  dryRun,
  check,
  cwd,
});

if (list) {
  const sources = [...new Set(results.map((r) => r.source))];
  for (const source of sources) {
    log(source);
  }
}

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
  console.error(`filesync-mirrors: ${changedCount} file(s) out of sync`);
  process.exit(1);
}
