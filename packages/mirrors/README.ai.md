# @filesync/mirrors (AI Notes)

AI-focused guide to the package behavior, code layout, and review notes. This is an adaptation of `README.md` with extra context for agents.

## What it does

Mirrors a single source file to multiple target paths (relative to each source file's directory). This is a simple content copy, not a diff/merge tool.

## Primary entry points

- CLI: `filesync/packages/mirrors/src/cli.ts`
- Programmatic API: `filesync/packages/mirrors/src/index.ts` (`syncMirrors`, `loadConfig`)

## CLI behavior

- Commands (via `npx @filesync/mirrors`):
  - `--config path` (or `--config=path`)
  - `--dry-run` (report changes without writing)
  - `--check` (exit non-zero if changes would be made)
  - `--list` (list discovered sources)
  - `--quiet` (suppress normal output)
- Config discovery: if `--config` is omitted, `filesync.config.json` is searched upward from the current working directory.
- Sync scope: even if config is found above, syncing is limited to the invocation directory and below.

## Config shape

```json
{
  "mirrors": [
    {
      "source": "**/README.ai.md",
      "targets": ["AGENTS.md", ".github/copilot-instructions.md"]
    }
  ]
}
```

- `source`: glob pattern for source files (relative to cwd)
- `targets`: list of paths relative to each source file's directory

## How sync works (code map)

- `syncMirrors` (in `src/index.ts`)
  - `findFiles` (from `@filesync/core`) resolves source paths.
  - Reads each source file, then writes to each target using `writeIfChanged`.
  - In `dryRun` or `check` mode, `writeIfChanged` is called with `dryRun: true`.
  - Returns a list of `{ source, target, status, error? }`.
- `loadConfig` (in `src/index.ts`)
  - Resolves config path either explicitly or by searching upward.
  - Reads and `JSON.parse`s the file; returns `null` on errors.

## Review notes (codebase)

- `syncMirrors` does not validate config schema; malformed configs may fail at runtime. Consider validating `MirrorConfig` upfront.
- `loadConfig` returns `null` for any parse/read error without surfacing the reason; CLI prints a generic "No filesync.config.json found". This can obscure JSON syntax errors.
- `status` for `dryRun`/`check` currently still returns "updated"; there is no distinct "would-update" status. If callers care, consider a dedicated status.
- Tests are minimal (`test/index.test.ts`) and only cover empty config; add cases for list/dry-run/check and error handling.

## Quick commands

```bash
# Run CLI from package root
npx @filesync/mirrors --list

# Unit tests
npm run test
```
