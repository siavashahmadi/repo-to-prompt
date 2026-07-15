import { extname } from 'path';

export type OutputFormat = 'plain' | 'markdown';

export interface FormatOptions {
  format: OutputFormat;
  sourcePath: string;
  fileCount: number;
  tokenCount: number;
  outputPath?: string;
}

export interface FileBlock {
  relativePath: string;
  content: string;
  isBinary: boolean;
  wasTruncated: boolean;
  totalLines: number;
}

const LANGUAGE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  cs: 'csharp',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  c: 'c',
  h: 'c',
  hpp: 'cpp',
  sh: 'bash',
  zsh: 'bash',
  bash: 'bash',
  fish: 'fish',
  json: 'json',
  jsonc: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  md: 'markdown',
  mdx: 'markdown',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  sql: 'sql',
  xml: 'xml',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  kts: 'kotlin',
  r: 'r',
  lua: 'lua',
  vim: 'vim',
  tf: 'hcl',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
};

function getLanguage(filePath: string): string {
  const basename = filePath.split('/').pop() ?? '';
  const lowerBasename = basename.toLowerCase();

  // Handle special filenames without extensions
  if (lowerBasename === 'dockerfile') return 'dockerfile';
  if (lowerBasename === 'makefile') return 'makefile';
  if (lowerBasename === 'gemfile') return 'ruby';

  const ext = extname(filePath).toLowerCase().slice(1);
  return LANGUAGE_MAP[ext] ?? ext;
}

export function buildHeader(options: FormatOptions): string {
  const now = new Date().toISOString();
  const tokenStr = options.tokenCount.toLocaleString('en-US');
  const lines = [
    '# repo-to-prompt output',
    `# Generated: ${now}`,
    `# Source: ${options.sourcePath}`,
    `# Files: ${options.fileCount} | Estimated tokens: ~${tokenStr}`,
    ...(options.outputPath ? [`# Output: ${options.outputPath}`] : []),
    '# Tool: https://github.com/siavashahmadi/repo-to-prompt',
    '# ---',
    '',
  ];
  return lines.join('\n');
}

export function formatFileBlock(block: FileBlock, format: OutputFormat): string {
  if (block.isBinary) {
    if (format === 'markdown') {
      return `## ${block.relativePath}\n\n[binary file skipped: ${block.relativePath}]\n\n`;
    }
    return `=== ${block.relativePath} ===\n[binary file skipped: ${block.relativePath}]\n\n`;
  }

  const truncationNote = block.wasTruncated
    ? `\n[...truncated: ${block.totalLines} lines total]`
    : '';

  if (format === 'markdown') {
    const lang = getLanguage(block.relativePath);
    return `## ${block.relativePath}\n\n\`\`\`${lang}\n${block.content}${truncationNote}\n\`\`\`\n\n`;
  }

  return `=== ${block.relativePath} ===\n${block.content}${truncationNote}\n\n`;
}

export function buildOutput(header: string, blocks: string[], dirTree?: string): string {
  const parts: string[] = [header];
  if (dirTree) {
    parts.push(dirTree);
    parts.push('');
  }
  parts.push(...blocks);
  return parts.join('');
}
