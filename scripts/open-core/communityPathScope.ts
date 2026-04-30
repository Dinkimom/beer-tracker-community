import { readFile } from 'node:fs/promises';
import path from 'node:path';

export interface AllowManifest {
  includePrefixes: string[];
}

export async function readAllowManifest(repoRoot: string): Promise<AllowManifest> {
  const filePath = path.join(repoRoot, 'scripts/open-core/community-core-allow.json');
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as AllowManifest;
}

export async function readDenyPrefixes(repoRoot: string): Promise<string[]> {
  const denyFile = path.join(repoRoot, 'scripts/open-core/community-core-deny-pathPrefixes.txt');
  const raw = await readFile(denyFile, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

export function normalizePosix(p: string): string {
  return p.split(path.sep).join('/');
}

/** Same deny semantics as `build-community-core-export.ts`. */
export function isDenied(posixPath: string, denyPrefixes: string[]): boolean {
  const normalizedPath = posixPath.endsWith('/') ? posixPath.slice(0, -1) : posixPath;
  for (const rawPrefix of denyPrefixes) {
    const prefix = rawPrefix.replace(/\/+$/, '');
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether `relPath` (repo-relative POSIX) would be considered under community export
 * include rules (directory prefixes end with `/`; otherwise exact file path).
 */
export function matchesAllowEntry(relPath: string, includePrefix: string): boolean {
  const prefix = normalizePosix(includePrefix);
  const p = relPath.endsWith('/') && relPath !== '/' ? relPath.slice(0, -1) : relPath;
  if (prefix.endsWith('/')) {
    // Directory rule: only paths under the prefix (avoids treating `app` as under `app/`)
    return p.startsWith(prefix);
  }
  return p === prefix;
}

export function isInCommunityPathScope(relPath: string, allow: AllowManifest, denyPrefixes: string[]): boolean {
  const p = normalizePosix(relPath);
  if (isDenied(p, denyPrefixes)) {
    return false;
  }
  return allow.includePrefixes.some((prefix) => matchesAllowEntry(p, prefix));
}

export function partitionPathsByCommunityScope(
  relPaths: readonly string[],
  allow: AllowManifest,
  denyPrefixes: string[],
): { inScope: string[]; outOfScope: string[] } {
  const inScope: string[] = [];
  const outOfScope: string[] = [];
  for (const raw of relPaths) {
    const line = raw.trim();
    if (!line) {
      continue;
    }
    const p = normalizePosix(line);
    if (isInCommunityPathScope(p, allow, denyPrefixes)) {
      inScope.push(p);
    } else {
      outOfScope.push(p);
    }
  }
  return { inScope, outOfScope };
}
