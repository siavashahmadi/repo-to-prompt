import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'fs/promises';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import ignore from 'ignore';

import { walkFiles } from '../src/walker.js';

describe('walkFiles', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'repo2prompt-walker-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns all files in a flat directory', async () => {
    await writeFile(join(tmpDir, 'a.ts'), 'const a = 1;');
    await writeFile(join(tmpDir, 'b.ts'), 'const b = 2;');

    const ig = ignore();
    const files = await walkFiles({ rootDir: tmpDir, ignoreFilter: ig, includePatterns: [] });

    expect(files).toHaveLength(2);
    expect(files.map((f) => f.relativePath).sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('recursively walks nested directories', async () => {
    await mkdir(join(tmpDir, 'src'));
    await writeFile(join(tmpDir, 'src', 'index.ts'), 'export {};');
    await writeFile(join(tmpDir, 'README.md'), '# test');

    const ig = ignore();
    const files = await walkFiles({ rootDir: tmpDir, ignoreFilter: ig, includePatterns: [] });

    expect(files).toHaveLength(2);
    const paths = files.map((f) => f.relativePath).sort();
    expect(paths).toContain('README.md');
    expect(paths).toContain('src/index.ts');
  });

  it('respects the ignore filter', async () => {
    await mkdir(join(tmpDir, 'node_modules'));
    await writeFile(join(tmpDir, 'node_modules', 'pkg.js'), 'module');
    await writeFile(join(tmpDir, 'index.ts'), 'export {};');

    const ig = ignore();
    ig.add('node_modules');

    const files = await walkFiles({ rootDir: tmpDir, ignoreFilter: ig, includePatterns: [] });

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('index.ts');
  });

  it('filters by include patterns', async () => {
    await writeFile(join(tmpDir, 'a.ts'), '');
    await writeFile(join(tmpDir, 'b.md'), '');
    await writeFile(join(tmpDir, 'c.ts'), '');

    const ig = ignore();
    const files = await walkFiles({
      rootDir: tmpDir,
      ignoreFilter: ig,
      includePatterns: ['**/*.ts'],
    });

    expect(files.map((f) => f.relativePath).sort()).toEqual(['a.ts', 'c.ts']);
  });

  it('returns absolute paths alongside relative paths', async () => {
    await writeFile(join(tmpDir, 'hello.js'), '');

    const ig = ignore();
    const files = await walkFiles({ rootDir: tmpDir, ignoreFilter: ig, includePatterns: [] });

    expect(files).toHaveLength(1);
    expect(files[0].absolutePath).toBe(join(tmpDir, 'hello.js'));
    expect(files[0].relativePath).toBe('hello.js');
  });

  it('handles an empty directory gracefully', async () => {
    const ig = ignore();
    const files = await walkFiles({ rootDir: tmpDir, ignoreFilter: ig, includePatterns: [] });
    expect(files).toHaveLength(0);
  });

  it('ignores nested directories matched by the filter', async () => {
    await mkdir(join(tmpDir, 'dist'));
    await writeFile(join(tmpDir, 'dist', 'bundle.js'), '');
    await writeFile(join(tmpDir, 'src.ts'), '');

    const ig = ignore();
    ig.add('dist');

    const files = await walkFiles({ rootDir: tmpDir, ignoreFilter: ig, includePatterns: [] });

    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('src.ts');
  });
});
