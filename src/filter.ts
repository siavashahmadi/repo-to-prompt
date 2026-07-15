import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ignore, { type Ignore } from 'ignore';

export const DEFAULT_IGNORES = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  '__pycache__',
  '.DS_Store',
  '*.lock',
  '*.log',
];

export interface FilterConfig {
  rootDir: string;
  useGitignore: boolean;
  excludePatterns: string[];
}

export function buildIgnoreFilter(config: FilterConfig): Ignore {
  const ig = ignore();

  ig.add(DEFAULT_IGNORES);

  if (config.useGitignore) {
    const gitignorePath = join(config.rootDir, '.gitignore');
    if (existsSync(gitignorePath)) {
      const content = readFileSync(gitignorePath, 'utf-8');
      ig.add(content);
    }
  }

  if (config.excludePatterns.length > 0) {
    ig.add(config.excludePatterns);
  }

  return ig;
}
