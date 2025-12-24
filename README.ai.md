# Filesync Notes

## Mirrors CLI behavior

- Config lookup: when `--config` is not provided, `filesync.config.json` is searched from the invocation directory upward to the filesystem root.
- Sync scope: files are discovered and synced only from the invocation directory downward, regardless of where the config file lives.
- Explicit config: `--config path/to/filesync.config.json` selects the config file but does not widen the sync scope.
- Missing config: if no config file is found, the CLI exits with a non-zero status and an error message.
