# @filesync/mirrors

Sync one file to multiple destinations.

## Installation

```bash
npm install @filesync/mirrors
```

## CLI Usage

```bash
# Sync files based on config
npx @filesync/mirrors

# Check if files are in sync (for CI)
npx @filesync/mirrors --check

# Dry run (report changes without writing)
npx @filesync/mirrors --dry-run

# List discovered source files
npx @filesync/mirrors --list

# Quiet mode (only print errors)
npx @filesync/mirrors --quiet

# Use an explicit config path
npx @filesync/mirrors --config path/to/filesync.config.json
```

## Configuration

Create `filesync.config.json` in your project root:

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

### Configuration Options

- **source**: Glob pattern to find source files
- **targets**: Array of relative paths for mirror destinations (relative to each source file's directory)

### Config Resolution

- If `--config` is not provided, the CLI searches for `filesync.config.json` from the invocation directory upward.
- Syncing is always scoped to the invocation directory and below, even if the config file is found higher up.
- If no config is found, the CLI exits with a non-zero status and prints an error.

## Programmatic API

```typescript
import { syncMirrors } from "@filesync/mirrors";

const results = await syncMirrors({
  config: {
    mirrors: [
      {
        source: "**/README.ai.md",
        targets: ["AGENTS.md"],
      },
    ],
  },
  dryRun: false,
});
```

## Exit Codes

- `0`: Success (or no changes in `--check` mode)
- `1`: Files out of sync (in `--check` mode)
