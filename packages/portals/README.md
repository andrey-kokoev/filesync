# @filesync/portals

Sync named fragments across files.

Unlike `@filesync/mirrors` (which mirrors whole files), this package syncs **fragments** identified by a kebab-case key. Fragments are delimited inside files by `filesync:portal:<key>:start` and `filesync:portal:<key>:end` markers.

## Installation

```bash
npm install @filesync/portals
```

## CLI Usage

```bash
# Sync fragments based on config
npx @filesync/portals

# Check if fragments are in sync (for CI)
npx @filesync/portals --check

# Dry run (report changes without writing)
npx @filesync/portals --dry-run

# List discovered fragment anchors
npx @filesync/portals --list

# Quiet mode (only print errors)
npx @filesync/portals --quiet

# Use an explicit config path
npx @filesync/portals --config path/to/filesync.config.json
```

## Fragment Markers

Fragments are identified by a kebab-case key and delimited in files by `:start` and `:end` markers with a `filesync:portal:` prefix. The tool scans for these markers and copies only the fragment contents (excluding the marker lines).

Example:

```text
# some file
filesync:portal:portal-intro:start
This content is the fragment.
filesync:portal:portal-intro:end
```

Rules:

- Keys are kebab-case (e.g. `portal-intro`).
- Fragments must not overlap or nest.
- Marker lines can be embedded in comments appropriate for the file type.

## Fragment Model

These rules define fragment identity and sync semantics:

- Fragment content is the exact text between the start/end marker lines; markers are not included and no trimming is performed.
- A fragment key may appear at most once per file.
- Markers must be properly paired; missing or mismatched markers are errors.
- Fragment identity is the key; if multiple source files define the same key, they must have identical content or the run fails.
- Targets are updated only where the corresponding start/end markers already exist; missing markers are errors.
- Targets are resolved by glob patterns relative to the invocation directory, and only files under the invocation directory are considered.

## Design Principles

This package separates fragment identity from storage so new adapters can evolve without changing the core model:

- A fragment is a value identified by its key; file paths are storage details, not identity.
- The sync engine works on fragments; adapters discover fragments and apply them to targets.
- Marker-based file scanning is one adapter; future adapters (AST blocks, JSON pointers, etc.) can be added without changing fragment identity.
- Conflict policy is explicit: duplicate keys across sources are errors unless a future precedence policy is configured.

## Configuration

Create `filesync.config.json` in your project root:

```json
{
  "portals": [
    {
      "source": "docs/**/*.md",
      "anchors": ["portal-*"],
      "targets": ["README.md", "docs/guide.md"]
    }
  ]
}
```

Sync all fragments in a folder (omit `anchors`):

```json
{
  "portals": [
    {
      "source": "docs/**/*.md",
      "targets": ["README.md"]
    }
  ]
}
```

### Configuration Options

- **source**: Glob pattern for files to scan for fragments
- **anchors**: Optional array of fragment keys or glob patterns (wildcards allowed). If omitted, all fragments found in `source` are synced.
- **targets**: Array of file path glob patterns to receive fragments (applies to all matched anchors in the rule).

### Wildcards

- File paths accept glob patterns (e.g. `docs/**/*.md`).
- Fragment keys accept glob patterns (e.g. `portal-*`).

### Config Resolution

- If `--config` is not provided, the CLI searches for `filesync.config.json` from the invocation directory upward.
- Syncing is always scoped to the invocation directory and below, even if the config file is found higher up.
- If no config is found, the CLI exits with a non-zero status and prints an error.

## Programmatic API

```typescript
import { syncPortals } from "@filesync/portals";

const results = await syncPortals({
  config: {
    portals: [
      {
        source: "docs/**/*.md",
        anchors: ["portal-*"],
        targets: ["README.md"],
      },
    ],
  },
  dryRun: false,
});
```

## Exit Codes

- `0`: Success (or no changes in `--check` mode)
- `1`: Fragments out of sync (in `--check` mode)
