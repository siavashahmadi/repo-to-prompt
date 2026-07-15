import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile } from 'fs/promises';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { buildIgnoreFilter, DEFAULT_IGNORES } from '../src/filter.js';

describe('buildIgnoreFilter', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'repo2prompt-filter-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('ignores node_modules by default', () => {
    const ig = buildIgnoreFilter({ rootDir: tmpDir, useGitignore: false, excludePatterns: [] });
    expect(ig.ignores('node_modules/lodash/index.js')).toBe(true);
  });

  it('ignores .git by default', () => {
    const ig = buildIgnoreFilter({ rootDir: tmpDir, useGitignore: false, excludePatterns: [] });
    expect(ig.ignores('.git/HEAD')).toBe(true);
  });

  it('does not ignore regular source files by default', () => {
    const ig = buildIgnoreFilter({ rootDir: tmpDir, useGitignore: false, excludePatterns: [] });
    expect(ig.ignores('src/index.ts')).toBe(false);
  });

  it('applies custom exclude patterns', () => {
    const ig = buildIgnoreFilter({
      rootDir: tmpDir,
      useGitignore: false,
      excludePatterns: ['**/*.test.ts'],
    });
    expect(ig.ignores('src/foo.test.ts')).toBe(true);
    expect(ig.ignores('src/foo.ts')).toBe(false);
  });

  it('reads .gitignore when useGitignore is true', async () => {
    await writeFile(join(tmpDir, '.gitignore'), '*.env\nsecrets/\n');

    const ig = buildIgnoreFilter({ rootDir: tmpDir, useGitignore: true, excludePatterns: [] });

    expect(ig.ignores('.env')).toBe(true);
    expect(ig.ignores('secrets/key.pem')).toBe(true);
    expect(ig.ignores('src/app.ts')).toBe(false);
  });

  it('skips .gitignore when useGitignore is false', async () => {
    await writeFile(join(tmpDir, '.gitignore'), 'important.ts\n');

    const ig = buildIgnoreFilter({ rootDir: tmpDir, useGitignore: false, excludePatterns: [] });

    expect(ig.ignores('important.ts')).toBe(false);
  });

  it('handles missing .gitignore gracefully when useGitignore is true', () => {
    // tmpDir has no .gitignore
    expect(() =>
      buildIgnoreFilter({ rootDir: tmpDir, useGitignore: true, excludePatterns: [] }),
    ).not.toThrow();
  });

  it('applies multiple custom exclude patterns', () => {
    const ig = buildIgnoreFilter({
      rootDir: tmpDir,
      useGitignore: false,
      excludePatterns: ['docs/', '**/*.spec.ts'],
    });
    expect(ig.ignores('docs/api.md')).toBe(true);
    expect(ig.ignores('src/auth.spec.ts')).toBe(true);
    expect(ig.ignores('src/auth.ts')).toBe(false);
  });

  it('exports DEFAULT_IGNORES as a non-empty array containing key entries', () => {
    expect(Array.isArray(DEFAULT_IGNORES)).toBe(true);
    expect(DEFAULT_IGNORES.length).toBeGreaterThan(0);
    expect(DEFAULT_IGNORES).toContain('node_modules');
    expect(DEFAULT_IGNORES).toContain('.git');
    expect(DEFAULT_IGNORES).toContain('dist');
  });
});
