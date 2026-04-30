/**
 * Interactive wrapper for `contribute-to-community.sh`.
 * When stdin is a TTY and no title is passed on the CLI, asks for PR title via @inquirer/prompts.
 *
 * Run: `pnpm community:pr` or `pnpm community:pr -- "feat: …"` or `pnpm community:pr -- --dry-run`
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { confirm, input } from '@inquirer/prompts';

interface ParsedArgs {
  forwarded: string[];
  title?: string;
}

function stripLeadingDoubleDash(argv: string[]): string[] {
  const out = [...argv];
  while (out[0] === '--') {
    out.shift();
  }
  return out;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args = stripLeadingDoubleDash(argv);
  const forwarded: string[] = [];
  let title: string | undefined;

  for (let i = 0; i < args.length; ) {
    const a = args[i];
    if (a === undefined) break;

    if (a === '--body-file') {
      const path = args[i + 1];
      if (!path) {
        throw new Error('--body-file requires a path');
      }
      forwarded.push('--body-file', path);
      i += 2;
      continue;
    }
    if (a === '--dry-run' || a === '--from-current-branch') {
      forwarded.push(a);
      i += 1;
      continue;
    }
    if (a.startsWith('-')) {
      forwarded.push(a);
      i += 1;
      continue;
    }
    if (title === undefined) {
      title = a;
      i += 1;
      continue;
    }
    throw new Error(`Unexpected extra argument: ${a}`);
  }

  return { forwarded, title };
}

function gitTopLevel(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- local dev CLI (`git` on PATH)
  const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
  });
  if (r.status !== 0 || !r.stdout) {
    throw new Error('Not a git repository (git rev-parse --show-toplevel failed).');
  }
  return r.stdout.trim();
}

function lastCommitSubject(repoRoot: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- local dev CLI (`git` on PATH)
  const r = spawnSync('git', ['log', '-1', '--pretty=%s'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return (r.stdout ?? '').trim();
}

function isInteractive(): boolean {
  if (process.env.COMMUNITY_PR_NO_PROMPT === '1') {
    return false;
  }
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

async function resolveTitle(cliTitle: string | undefined, repoRoot: string): Promise<string> {
  if (cliTitle !== undefined && cliTitle !== '') {
    return cliTitle;
  }
  const fromEnv = process.env.COMMUNITY_PR_TITLE?.trim();
  if (fromEnv) {
    return fromEnv;
  }
  const defaultSubject = lastCommitSubject(repoRoot);
  if (!isInteractive()) {
    if (defaultSubject) {
      return defaultSubject;
    }
    throw new Error(
      'Could not resolve PR title. Pass it: pnpm community:pr -- "feat: …" or set COMMUNITY_PR_TITLE.',
    );
  }
  const title = await input({
    default: defaultSubject || undefined,
    message: 'PR title (GitHub)',
    required: true,
    validate: (value) => (value.trim() ? true : 'Title must not be empty'),
  });
  const trimmed = title.trim();
  const ok = await confirm({
    default: true,
    message: `Open community PR with title: "${trimmed}"?`,
  });
  if (!ok) {
    process.exit(0);
  }
  return trimmed;
}

async function main(): Promise<void> {
  const repoRoot = gitTopLevel();
  const scriptPath = join(
    repoRoot,
    'scripts/sync-public-private/contribute-to-community.sh',
  );
  if (!existsSync(scriptPath)) {
    throw new Error(`Missing script: ${scriptPath}`);
  }

  let parsed: ParsedArgs;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }

  const title = await resolveTitle(parsed.title, repoRoot);

  // eslint-disable-next-line sonarjs/no-os-command-from-path -- local dev CLI (`bash` on PATH)
  const result = spawnSync('bash', [scriptPath, title, ...parsed.forwarded], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });
  const code = result.status ?? 1;
  process.exit(code === null ? 1 : code);
}

main().catch((err: unknown) => {
  console.error('[community:pr]', err);
  process.exit(1);
});
