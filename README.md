# filesync

Tools for keeping files synchronized across locations.

## Packages

| Package | Description |
|---------|-------------|
| [@filesync/mirrors](./packages/mirrors) | Sync one file to multiple destinations |
| [@filesync/core](./packages/core) | Shared utilities for file operations |
| [@filesync/types](./packages/types) | TypeScript type definitions |

## Quick Start
```bash
npm install @filesync/mirrors
```
```bash
# Sync all README.ai.md files to their mirror locations
npx @filesync/mirrors

# Check if files are in sync (for CI)
npx @filesync/mirrors --check
```

## Configuration

Create a `filesync.config.json` in your project root:
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

## License

MIT
