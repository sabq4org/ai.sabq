import fs from "fs";
import os from "os";
import path from "path";

function ensureWritableDirectory(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

function resolveUploadsRootDir(): string {
  const candidates = [
    process.env.UPLOADS_DIR,
    fs.existsSync("/home/runner/workspace/uploads")
      ? "/home/runner/workspace/uploads"
      : undefined,
    path.resolve(process.cwd(), "uploads"),
    path.join(os.tmpdir(), "sabq-uploads"),
  ].filter((dir): dir is string => Boolean(dir));

  const attemptedDirs = new Set<string>();

  for (const candidate of candidates) {
    if (attemptedDirs.has(candidate)) {
      continue;
    }

    attemptedDirs.add(candidate);

    if (ensureWritableDirectory(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `No writable uploads directory available. Tried: ${Array.from(attemptedDirs).join(", ")}`
  );
}

export const uploadsRootDir = resolveUploadsRootDir();

export function getUploadsSubdirectory(...segments: string[]): string {
  const dir = path.join(uploadsRootDir, ...segments);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
