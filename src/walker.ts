import { readdir, lstat } from 'fs/promises';
import { join, relative } from 'path';
import micromatch from 'micromatch';
import type { Ignore } from 'ignore';

export interface WalkOptions {
  rootDir: string;
  ignoreFilter: Ignore;
  includePatterns: string[];
}

export interface FileEntry {
  absolutePath: string;
  relativePath: string;
}

async function walkDir(
  dir: string,
  rootDir: string,
  ignoreFilter: Ignore,
  results: FileEntry[],
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    // Permission error or unreadable directory — skip silently
    return;
  }

  for (const entry of entries) {
    const absolutePath = join(dir, entry);
    // Normalize to forward slashes for cross-platform ignore compatibility
    const relativePath = relative(rootDir, absolutePath).replace(/\\/g, '/');

    let entryStats;
    try {
      entryStats = await lstat(absolutePath);
    } catch {
      continue;
    }

    // Skip symlinks to avoid infinite loops
    if (entryStats.isSymbolicLink()) continue;

    const isDir = entryStats.isDirectory();

    try {
      // Ignore package requires non-empty relative paths
      if (relativePath && ignoreFilter.ignores(relativePath)) continue;
    } catch {
      // ignore() may throw on edge-case paths — skip filter
    }

    if (isDir) {
      await walkDir(absolutePath, rootDir, ignoreFilter, results);
    } else {
      results.push({ absolutePath, relativePath });
    }
  }
}

export async function walkFiles(options: WalkOptions): Promise<FileEntry[]> {
  const results: FileEntry[] = [];
  await walkDir(options.rootDir, options.rootDir, options.ignoreFilter, results);

  if (options.includePatterns.length === 0) return results;

  return results.filter(
    (f) => micromatch([f.relativePath], options.includePatterns, { dot: true }).length > 0,
  );
}
