# @filesync/core

Shared utilities for file synchronization operations.

## Installation

```bash
npm install @filesync/core
```

## API

### `findFiles(pattern, options?)`

Recursively find files matching a pattern.

```typescript
import { findFiles } from "@filesync/core";

const files = await findFiles("**/README.ai.md", { cwd: process.cwd() });
```

### `fileEquals(path, content)`

Check if a file exists and matches the given content.

```typescript
import { fileEquals } from "@filesync/core";

const matches = await fileEquals("./README.md", "# Hello");
```

### `writeIfChanged(path, content, options?)`

Write content to a file only if it differs from existing content.

```typescript
import { writeIfChanged } from "@filesync/core";

const changed = await writeIfChanged("./out.md", content, { dryRun: false });
```
