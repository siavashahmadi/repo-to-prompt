# repo-to-prompt

A CLI tool that packs a local code repository into a single, optimized text file. It walks the file tree, skips ignored paths, detects binary files, estimates output size, and formats everything with clear file delimiters — ready to paste anywhere you need to share code as text.

## Features

- Recursive directory traversal with `.gitignore` support
- Binary file detection via extension list and null-byte scanning
- Token estimation with a configurable size budget (trims largest files first)
- Two output formats: plain text and Markdown with syntax highlighting
- ASCII directory tree visualization (`--tree`)
- Git diff mode — only include files changed since a given ref (`--diff`)
- Copy directly to clipboard (`--copy`)
- Project-level config file (`.repo2prompt.json`)

## Installation

```bash
npm install
npm run build
```

Then run directly:

```bash
node dist/index.js [directory] [options]
```

Or link globally:

```bash
npm link
repo-to-prompt [directory] [options]
```

## Usage

```bash
repo-to-prompt [directory] [options]
```

`directory` defaults to `.` (current directory).

### Examples

```bash
# Print current directory to stdout
repo-to-prompt .

# Save to a file in Markdown format with a directory tree
repo-to-prompt ./my-project --output context.md --format markdown --tree

# Only TypeScript files, cap at 80,000 tokens
repo-to-prompt . --include "**/*.ts" --max-tokens 80000

# Exclude test files and copy to clipboard
repo-to-prompt . --exclude "**/*.test.ts" --copy

# Only files changed since last commit
repo-to-prompt . --diff HEAD~1

# Skip .gitignore and use only custom excludes
repo-to-prompt . --no-gitignore --exclude "docs/" --exclude "**/*.md"
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output <file>` | Save output to a file instead of stdout | stdout |
| `-f, --format <format>` | Output format: `plain` or `markdown` | `plain` |
| `--include <patterns...>` | Only include files matching these glob patterns | all files |
| `--exclude <patterns...>` | Exclude files matching these glob patterns | none |
| `--no-gitignore` | Skip `.gitignore` parsing | gitignore enabled |
| `--max-tokens <number>` | Trim largest files first if this token budget is exceeded | unlimited |
| `--max-file-lines <number>` | Truncate files longer than this many lines | 500 |
| `--copy` | Copy output to clipboard | false |
| `--tree` | Prepend an ASCII directory tree to the output | false |
| `--diff [ref]` | Only include files changed since a git ref | HEAD~1 |

## Output Format

Every run produces a header followed by one block per file.

**Plain (default):**
```
# repo-to-prompt output
# Generated: 2026-03-07T10:23:01.000Z
# Source: /Users/sia/my-project
# Files: 12 | Estimated tokens: ~18,400
# ---

=== src/index.ts ===
import { Command } from 'commander';
...

=== src/walker.ts ===
...
```

**Markdown (`--format markdown`):**

Each file becomes a fenced code block with a language identifier derived from the file extension. A summary header with metadata precedes all blocks.

## Always-Excluded Paths

The following are excluded by default regardless of other settings:

`node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `__pycache__`, `.DS_Store`, `*.lock`, `*.log`

## Configuration File

Add a `.repo2prompt.json` to the root of any project to set defaults for that project. CLI flags override all config file values.

```json
{
  "exclude": ["**/*.test.ts", "**/*.spec.ts", "docs/"],
  "include": ["src/**"],
  "maxTokens": 80000,
  "format": "markdown",
  "maxFileLines": 400,
  "noGitignore": false
}
```

See `.repo2prompt.json.example` for reference.

## Development

```bash
npm run dev          # run from source with tsx (no build step)
npm run build        # compile to dist/
npm test             # run all tests
npm run test:watch   # run tests in watch mode
npm run lint         # type-check only (no emit)
```

Run a single test file:

```bash
npx vitest run tests/filter.test.ts
```

## License

MIT
