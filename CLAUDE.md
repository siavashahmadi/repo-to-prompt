# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`repo-to-prompt` is a TypeScript CLI tool that packs a local code repository into a single, token-optimized text file for LLM context. It walks the file tree, filters binaries and ignored paths, estimates token counts, applies a budget by trimming large files, and outputs formatted content (plain text or markdown) to stdout, a file, or the clipboard.

## Commands

```bash
npm run build        # compile with tsup → dist/index.js
npm run dev          # run from source with tsx (no build step)
npm test             # run vitest tests once
npm run test:watch   # run vitest in watch mode
npm run lint         # type-check only (tsc --noEmit)
```

Run a single test file:
```bash
npx vitest run tests/filter.test.ts
```

Run the CLI locally (after build):
```bash
node dist/index.js [path] [options]
```

## Architecture

All source is in `src/`. The CLI entry point (`index.ts`) orchestrates a pipeline:

1. **`config.ts`** — loads `.repo2prompt.json` from the target repo root (optional, falls back to empty config on error)
2. **`filter.ts`** — builds a stacked ignore filter: default ignores → `.gitignore` → custom `--exclude` patterns (uses `ignore` package)
3. **`walker.ts`** — recursively walks directories, skips symlinks, applies ignore filter and optional `--include` glob patterns
4. **`summarizer.ts`** — reads file contents; detects binary files by extension and null-byte scanning; truncates files exceeding `--max-file-lines`
5. **`tokenEstimator.ts`** — estimates token count as `length / 4` (simple heuristic)
6. **`index.ts`** — applies token budget by dropping/truncating the largest files first; batches file reads (max 50 concurrent) to avoid fd exhaustion
7. **`formatter.ts`** — assembles the output: metadata header + optional directory tree + per-file blocks; markdown format uses fenced code blocks with language identifiers; plain format uses `=== path ===` delimiters
8. **`tree.ts`** — generates ASCII directory tree (respects ignore filter); used when `--tree` flag is passed

## Configuration

Projects can add a `.repo2prompt.json` at their root to set defaults (see `.repo2prompt.json.example`):
```json
{
  "exclude": ["*.test.ts"],
  "maxTokens": 100000,
  "format": "markdown",
  "maxFileLines": 500,
  "noGitignore": false
}
```

CLI flags override config file values. Key flags: `--output`, `--format`, `--include`, `--exclude`, `--no-gitignore`, `--max-tokens`, `--max-file-lines`, `--copy`, `--tree`, `--diff [ref]`.
