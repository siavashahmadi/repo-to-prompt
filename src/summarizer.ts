import { readFile } from 'fs/promises';
import { extname } from 'path';

const BINARY_EXTENSIONS = new Set([
  // Images
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', '.tiff', '.psd', '.raw',
  // Audio / Video
  '.mp3', '.mp4', '.wav', '.ogg', '.flac', '.aac', '.avi', '.mov', '.mkv', '.wmv',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.xz', '.rar', '.7z', '.zst',
  // Documents / Data
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  // Binaries / Libraries
  '.exe', '.dll', '.so', '.dylib', '.a', '.lib', '.bin', '.obj',
  // Fonts
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  // Database
  '.db', '.sqlite', '.sqlite3',
  // Other
  '.dat', '.pyc', '.class',
]);

export interface FileContent {
  content: string;
  wasTruncated: boolean;
  isBinary: boolean;
  totalLines: number;
}

function isBinaryExtension(filePath: string): boolean {
  return BINARY_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function hasBinaryContent(buffer: Buffer): boolean {
  const checkLength = Math.min(buffer.length, 512);
  for (let i = 0; i < checkLength; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export async function readFileContent(filePath: string, maxLines: number): Promise<FileContent> {
  if (isBinaryExtension(filePath)) {
    return { content: '', wasTruncated: false, isBinary: true, totalLines: 0 };
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: `[Error reading file: ${message}]`,
      wasTruncated: false,
      isBinary: false,
      totalLines: 0,
    };
  }

  if (hasBinaryContent(buffer)) {
    return { content: '', wasTruncated: false, isBinary: true, totalLines: 0 };
  }

  const text = buffer.toString('utf-8');
  const lines = text.split('\n');
  const totalLines = lines.length;

  if (totalLines <= maxLines) {
    return { content: text, wasTruncated: false, isBinary: false, totalLines };
  }

  const truncated = lines.slice(0, maxLines).join('\n');
  return { content: truncated, wasTruncated: true, isBinary: false, totalLines };
}
