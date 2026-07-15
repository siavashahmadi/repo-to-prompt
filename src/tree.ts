import { readdir, lstat } from 'fs/promises';
import { join, relative } from 'path';
import type { Ignore } from 'ignore';

async function buildTreeLines(
  dir: string,
  rootDir: string,
  ignoreFilter: Ignore,
  prefix: string,
  lines: string[],
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  // Filter out ignored entries
  const visible = entries.filter((entry) => {
    const rel = relative(rootDir, join(dir, entry)).replace(/\\/g, '/');
    try {
      return rel && !ignoreFilter.ignores(rel);
    } catch {
      return true;
    }
  });

  for (let i = 0; i < visible.length; i++) {
    const entry = visible[i];
    const isLast = i === visible.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = isLast ? '    ' : '│   ';

    const absolutePath = join(dir, entry);
    let entryStats;
    try {
      entryStats = await lstat(absolutePath);
    } catch {
      continue;
    }

    if (entryStats.isSymbolicLink()) {
      lines.push(`${prefix}${connector}${entry} -> (symlink)`);
      continue;
    }

    const isDir = entryStats.isDirectory();
    lines.push(`${prefix}${connector}${entry}${isDir ? '/' : ''}`);

    if (isDir) {
      await buildTreeLines(absolutePath, rootDir, ignoreFilter, prefix + childPrefix, lines);
    }
  }
}

export async function generateTree(rootDir: string, ignoreFilter: Ignore): Promise<string> {
  const lines: string[] = ['./'];
  await buildTreeLines(rootDir, rootDir, ignoreFilter, '', lines);
  return '```\n' + lines.join('\n') + '\n```\n';
}
