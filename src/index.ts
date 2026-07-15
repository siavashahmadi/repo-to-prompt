import { Command } from 'commander';
import { resolve, isAbsolute } from 'path';
import { writeFile } from 'fs/promises';
import { execSync } from 'child_process';

import { loadConfig } from './config.js';
import { buildIgnoreFilter } from './filter.js';
import { walkFiles } from './walker.js';
import { readFileContent } from './summarizer.js';
import { estimateTokens } from './tokenEstimator.js';
import {
  buildHeader,
  formatFileBlock,
  buildOutput,
  type OutputFormat,
  type FileBlock,
} from './formatter.js';
import { generateTree } from './tree.js';

const program = new Command();

program
  .name('repo-to-prompt')
  .description(
    'Pack a local code repository into a single, token-optimized text file for LLM context',
  )
  .version('1.0.0')
  .argument('[directory]', 'Directory to pack', '.')
  .option('-o, --output <file>', 'Save output to a file instead of stdout')
  .option(
    '-f, --format <format>',
    'Output format: "plain" (default) or "markdown"',
    'plain',
  )
  .option('--include <patterns...>', 'Only include files matching these glob patterns')
  .option('--exclude <patterns...>', 'Exclude files matching these glob patterns')
  .option('--no-gitignore', 'Skip .gitignore parsing')
  .option('--max-tokens <number>', 'Trim largest files first if token budget is exceeded', parseInt)
  .option(
    '--max-file-lines <number>',
    'Truncate files longer than this many lines (default: 500)',
    parseInt,
  )
  .option('--copy', 'Copy output to clipboard')
  .option('--tree', 'Prepend a directory tree visualization to the output')
  .option('--diff [ref]', 'Only include files changed since a git ref (default: HEAD~1)')
  .action(async (directory: string, opts) => {
    try {
      const rootDir = isAbsolute(directory) ? directory : resolve(process.cwd(), directory);

      // Load .repo2prompt.json if present
      const fileConfig = loadConfig(rootDir);

      // Resolve options: CLI flags override config file values
      const format: OutputFormat =
        (opts.format as OutputFormat) ?? fileConfig.format ?? 'plain';
      const maxFileLines: number = opts.maxFileLines ?? fileConfig.maxFileLines ?? 500;
      const maxTokens: number | undefined = opts.maxTokens ?? fileConfig.maxTokens;
      const useGitignore: boolean =
        opts.gitignore !== false && fileConfig.noGitignore !== true;
      const excludePatterns: string[] = [
        ...(fileConfig.exclude ?? []),
        ...(opts.exclude ?? []),
      ];
      let includePatterns: string[] = [
        ...(fileConfig.include ?? []),
        ...(opts.include ?? []),
      ];

      // --diff: resolve changed files from git
      if (opts.diff !== undefined) {
        const ref = typeof opts.diff === 'string' ? opts.diff : 'HEAD~1';
        try {
          const changed = execSync(`git -C "${rootDir}" diff --name-only ${ref}`, {
            encoding: 'utf-8',
          })
            .trim()
            .split('\n')
            .filter(Boolean);

          if (changed.length === 0) {
            process.stderr.write(`No files changed since ${ref}.\n`);
            process.exit(0);
          }

          // Override include patterns with the changed files
          includePatterns = changed;
        } catch {
          throw new Error(
            `Could not run git diff from "${rootDir}". Is this a git repository?`,
          );
        }
      }

      // Build the ignore filter (gitignore + custom excludes + defaults)
      const ignoreFilter = buildIgnoreFilter({ rootDir, useGitignore, excludePatterns });

      // Discover files
      const files = await walkFiles({ rootDir, ignoreFilter, includePatterns });

      if (files.length === 0) {
        process.stderr.write('No files found matching the given criteria.\n');
        process.exit(0);
      }

      // Read file contents (concurrently, capped at 50 at a time to avoid fd exhaustion)
      const CONCURRENCY = 50;
      const fileBlocks: FileBlock[] = [];
      for (let i = 0; i < files.length; i += CONCURRENCY) {
        const batch = files.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (file) => {
            const fc = await readFileContent(file.absolutePath, maxFileLines);
            return { relativePath: file.relativePath, ...fc };
          }),
        );
        fileBlocks.push(...results);
      }

      // Calculate initial token estimate
      let totalTokens = estimateTokens(
        fileBlocks
          .filter((b) => !b.isBinary)
          .map((b) => b.content)
          .join(''),
      );

      // Apply token budget by dropping / truncating the largest files first
      if (maxTokens !== undefined && totalTokens > maxTokens) {
        const nonBinaryBlocks = fileBlocks
          .filter((b) => !b.isBinary && b.content.length > 0)
          .sort((a, b) => b.content.length - a.content.length);

        let remaining = totalTokens - maxTokens;

        for (const block of nonBinaryBlocks) {
          if (remaining <= 0) break;
          const blockTokens = estimateTokens(block.content);

          if (blockTokens <= remaining) {
            // Drop file entirely
            remaining -= blockTokens;
            block.content = '[file omitted: token budget exceeded]';
            block.wasTruncated = true;
          } else {
            // Partially truncate: keep as many chars as the remaining budget allows
            const keepChars = (blockTokens - remaining) * 4;
            const lines = block.content.split('\n');
            let charsSeen = 0;
            let keepLines = 0;
            for (const line of lines) {
              if (charsSeen + line.length + 1 > keepChars) break;
              charsSeen += line.length + 1;
              keepLines++;
            }
            const originalTokens = blockTokens;
            block.content = lines.slice(0, keepLines).join('\n');
            block.wasTruncated = true;
            remaining -= originalTokens - estimateTokens(block.content);
          }
        }

        // Recalculate after trimming
        totalTokens = estimateTokens(
          fileBlocks
            .filter((b) => !b.isBinary)
            .map((b) => b.content)
            .join(''),
        );
      }

      // Build output header
      const header = buildHeader({
        format,
        sourcePath: rootDir,
        fileCount: fileBlocks.length,
        tokenCount: totalTokens,
        outputPath: opts.output,
      });

      // Optionally build directory tree
      let dirTree: string | undefined;
      if (opts.tree) {
        dirTree = await generateTree(rootDir, ignoreFilter);
      }

      // Format individual file blocks
      const formattedBlocks = fileBlocks.map((block) => formatFileBlock(block, format));

      // Assemble final output
      const output = buildOutput(header, formattedBlocks, dirTree);

      // Write to file or stdout
      if (opts.output) {
        await writeFile(opts.output, output, 'utf-8');
      } else if (!opts.copy) {
        process.stdout.write(output);
      }

      // Copy to clipboard
      if (opts.copy) {
        const { default: clipboardy } = await import('clipboardy');
        await clipboardy.write(output);
      }

      // Print summary line to stderr (always visible even when piping stdout)
      const nonBinaryCount = fileBlocks.filter((b) => !b.isBinary).length;
      const binaryCount = fileBlocks.filter((b) => b.isBinary).length;
      const tokenStr = totalTokens.toLocaleString('en-US');

      let summary = `✓ ${nonBinaryCount} files`;
      if (binaryCount > 0) summary += ` (${binaryCount} binary skipped)`;
      summary += ` | ~${tokenStr} tokens`;
      if (opts.output) summary += ` | saved to ${opts.output}`;
      if (opts.copy) summary += ` | copied to clipboard`;

      process.stderr.write(summary + '\n');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      process.stderr.write(`Error: ${message}\n`);
      process.exit(1);
    }
  });

program.parse();
