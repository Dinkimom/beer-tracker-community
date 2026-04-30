#!/usr/bin/env node
/**
 * Filters `git diff --name-only` paths to community export scope (allow + deny rules).
 * Used by contribute-to-community.sh so previews are not flooded by private-only paths.
 *
 * stdin: one repo-relative path per line
 * stdout: in-scope paths (POSIX, deduped, stable sort)
 * stderr: OUT_OF_SCOPE lines for paths not in export scope (still denied-checked for allow side)
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  partitionPathsByCommunityScope,
  readAllowManifest,
  readDenyPrefixes,
} from './communityPathScope';

async function main() {
  const repoRoot = path.resolve(process.cwd());
  const stdin = readFileSync(0, 'utf8');
  const lines = stdin.split('\n');
  const allow = await readAllowManifest(repoRoot);
  const deny = await readDenyPrefixes(repoRoot);
  const { inScope, outOfScope } = partitionPathsByCommunityScope(lines, allow, deny);

  for (const p of outOfScope) {
    process.stderr.write(`OUT_OF_SCOPE\t${p}\n`);
  }

  const unique = [...new Set(inScope)].sort((a, b) => a.localeCompare(b));
  for (const p of unique) {
    process.stdout.write(`${p}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
