import { describe, it, expect } from 'vitest';

import { buildHeader, formatFileBlock, buildOutput } from '../src/formatter.js';
import type { FileBlock } from '../src/formatter.js';

const baseBlock: FileBlock = {
  relativePath: 'src/index.ts',
  content: 'const x = 1;',
  isBinary: false,
  wasTruncated: false,
  totalLines: 1,
};

describe('buildHeader', () => {
  it('contains the required metadata lines', () => {
    const header = buildHeader({
      format: 'plain',
      sourcePath: '/path/to/repo',
      fileCount: 5,
      tokenCount: 1000,
    });

    expect(header).toContain('# repo-to-prompt output');
    expect(header).toContain('# Source: /path/to/repo');
    expect(header).toContain('# Files: 5');
    expect(header).toContain('~1,000');
    expect(header).toContain('# Tool: https://github.com/siavashahmadi/repo-to-prompt');
  });

  it('includes output path in the header when provided', () => {
    const header = buildHeader({
      format: 'plain',
      sourcePath: '/repo',
      fileCount: 1,
      tokenCount: 100,
      outputPath: 'context.txt',
    });
    expect(header).toContain('context.txt');
  });

  it('includes a generated timestamp', () => {
    const header = buildHeader({
      format: 'plain',
      sourcePath: '/repo',
      fileCount: 0,
      tokenCount: 0,
    });
    expect(header).toMatch(/# Generated: \d{4}-\d{2}-\d{2}T/);
  });
});

describe('formatFileBlock — plain format', () => {
  it('wraps content with === delimiters', () => {
    const result = formatFileBlock(baseBlock, 'plain');
    expect(result).toContain('=== src/index.ts ===');
    expect(result).toContain('const x = 1;');
  });

  it('notes binary files', () => {
    const result = formatFileBlock({ ...baseBlock, isBinary: true }, 'plain');
    expect(result).toContain('[binary file skipped: src/index.ts]');
    expect(result).not.toContain('const x');
  });

  it('notes truncated files with total line count', () => {
    const result = formatFileBlock({ ...baseBlock, wasTruncated: true, totalLines: 1000 }, 'plain');
    expect(result).toContain('[...truncated: 1000 lines total]');
  });
});

describe('formatFileBlock — markdown format', () => {
  it('wraps content in a fenced code block with heading', () => {
    const result = formatFileBlock(baseBlock, 'markdown');
    expect(result).toContain('## src/index.ts');
    expect(result).toContain('```typescript');
    expect(result).toContain('const x = 1;');
    expect(result).toContain('```');
  });

  it('notes binary files', () => {
    const result = formatFileBlock({ ...baseBlock, isBinary: true }, 'markdown');
    expect(result).toContain('[binary file skipped: src/index.ts]');
  });

  it('notes truncated files', () => {
    const result = formatFileBlock(
      { ...baseBlock, wasTruncated: true, totalLines: 500 },
      'markdown',
    );
    expect(result).toContain('[...truncated: 500 lines total]');
  });

  it('uses the correct language identifier for known extensions', () => {
    const pyBlock: FileBlock = { ...baseBlock, relativePath: 'script.py' };
    expect(formatFileBlock(pyBlock, 'markdown')).toContain('```python');

    const goBlock: FileBlock = { ...baseBlock, relativePath: 'main.go' };
    expect(formatFileBlock(goBlock, 'markdown')).toContain('```go');

    const jsBlock: FileBlock = { ...baseBlock, relativePath: 'app.js' };
    expect(formatFileBlock(jsBlock, 'markdown')).toContain('```javascript');
  });
});

describe('buildOutput', () => {
  it('concatenates header and blocks', () => {
    const result = buildOutput('HEADER\n', ['BLOCK1\n', 'BLOCK2\n']);
    expect(result).toBe('HEADER\nBLOCK1\nBLOCK2\n');
  });

  it('inserts the directory tree between the header and blocks when provided', () => {
    const result = buildOutput('HEADER\n', ['BLOCK\n'], 'TREE\n');
    const headerIdx = result.indexOf('HEADER');
    const treeIdx = result.indexOf('TREE');
    const blockIdx = result.indexOf('BLOCK\n', treeIdx);

    expect(headerIdx).toBeLessThan(treeIdx);
    expect(treeIdx).toBeLessThan(blockIdx);
  });

  it('produces an empty body when no blocks are given', () => {
    const result = buildOutput('HEADER\n', []);
    expect(result).toBe('HEADER\n');
  });
});
