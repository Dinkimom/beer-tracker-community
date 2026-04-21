import { readFileSync } from 'node:fs';
import path from 'node:path';
import { error as logError } from 'node:console';
import process from 'node:process';

const KEYS = new Set(['PUBLIC_CORE_REPO', 'PUBLIC_CORE_PUSH_TOKEN', 'PUBLIC_CORE_TARGET_BRANCH']);

function stripQuotes(raw) {
  const s = raw.trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  return s;
}

function parseDotEnv(contents) {
  /** @type {Record<string, string>} */
  const out = {};
  const lines = contents.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (!KEYS.has(key)) {
      continue;
    }
    const value = stripQuotes(trimmed.slice(eq + 1));
    out[key] = value;
  }
  return out;
}

function normalizeRepoSlug(raw) {
  let s = raw.trim();
  s = s.replace(/^https?:\/\/github\.com\//i, '');
  s = s.replace(/^git@github\.com:/i, '');
  if (s.endsWith('.git')) {
    s = s.slice(0, -'.git'.length);
  }
  return s;
}

function bashSingleQuoted(value) {
  // Wrap for POSIX sh: '...' with any ' escaped as '\''.
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

const emitBash = process.argv.includes('--emit-bash') || process.argv.includes('--emit-shell');

const repoRoot = process.cwd();
const envPath = path.join(repoRoot, '.env');

let parsed = {};
try {
  parsed = parseDotEnv(readFileSync(envPath, 'utf8'));
} catch {
  parsed = {};
}

for (const [k, v] of Object.entries(parsed)) {
  if (process.env[k] && String(process.env[k]).trim() !== '') {
    continue;
  }
  process.env[k] = v;
}

if (process.env.PUBLIC_CORE_REPO && String(process.env.PUBLIC_CORE_REPO).trim() !== '') {
  process.env.PUBLIC_CORE_REPO = normalizeRepoSlug(String(process.env.PUBLIC_CORE_REPO));
}

function mask(value) {
  const s = String(value ?? '');
  if (!s) {
    return '(empty)';
  }
  if (s.length <= 10) {
    return `len=${s.length}`;
  }
  return `len=${s.length} prefix=${s.slice(0, 4)}…suffix=${s.slice(-4)}`;
}

if (emitBash) {
  const lines = [];
  for (const key of KEYS) {
    const raw = process.env[key];
    if (!raw || String(raw).trim() === '') {
      continue;
    }
    let value = String(raw);
    if (key === 'PUBLIC_CORE_REPO') {
      value = normalizeRepoSlug(value);
    }
    lines.push(`export ${key}=${bashSingleQuoted(value)}`);
  }
  // Diagnostics must not pollute stdout (stdout is consumed by `eval "$(...)"`).
  logError(
    `[open-core] env: PUBLIC_CORE_REPO=${process.env.PUBLIC_CORE_REPO ?? '(unset)'} PUBLIC_CORE_TARGET_BRANCH=${process.env.PUBLIC_CORE_TARGET_BRANCH ?? '(unset)'} PUBLIC_CORE_PUSH_TOKEN=${mask(process.env.PUBLIC_CORE_PUSH_TOKEN)}`
  );
  process.stdout.write(`${lines.join('\n')}\n`);
  process.exit(0);
}

logError(
  `[open-core] env: PUBLIC_CORE_REPO=${process.env.PUBLIC_CORE_REPO ?? '(unset)'} PUBLIC_CORE_TARGET_BRANCH=${process.env.PUBLIC_CORE_TARGET_BRANCH ?? '(unset)'} PUBLIC_CORE_PUSH_TOKEN=${mask(process.env.PUBLIC_CORE_PUSH_TOKEN)}`
);
