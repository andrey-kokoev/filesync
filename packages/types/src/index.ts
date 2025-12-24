export interface MirrorEntry {
  source: string;
  targets: string[];
}

export interface MirrorConfig {
  mirrors: MirrorEntry[];
}

export interface SyncResult {
  source: string;
  target: string;
  status: "created" | "updated" | "unchanged" | "error";
  error?: Error;
}

export interface SyncOptions {
  dryRun?: boolean;
  check?: boolean;
  quiet?: boolean;
  cwd?: string;
}

export interface FindOptions {
  cwd?: string;
  ignore?: string[];
}
