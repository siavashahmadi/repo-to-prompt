import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface Config {
  exclude?: string[];
  include?: string[];
  maxTokens?: number;
  format?: 'plain' | 'markdown';
  maxFileLines?: number;
  noGitignore?: boolean;
}

export function loadConfig(rootDir: string): Config {
  const configPath = join(rootDir, '.repo2prompt.json');
  if (!existsSync(configPath)) return {};

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as Config;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Warning: Could not parse .repo2prompt.json: ${message}\n`);
    return {};
  }
}
