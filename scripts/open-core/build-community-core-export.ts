import { createHash } from 'node:crypto';
import { copyFile, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

type AllowManifest = {
  includePrefixes: string[];
};

const CONTENT_SCAN_EXT = new Set([
  '.cjs',
  '.env',
  '.example',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.toml',
  '.ts',
  '.tsx',
  '.yaml',
  '.yml',
]);

const LEAK_SUBSTRINGS = [
  '-----BEGIN',
  'PRIVATE KEY-----',
  'sk_live_',
  'xoxb-',
  'ghp_',
  'github_pat_',
];

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const raw = process.argv.find((a) => a === `--${name}` || a.startsWith(prefix));
  if (!raw) {
    return undefined;
  }
  if (raw === `--${name}`) {
    return '';
  }
  return raw.slice(prefix.length);
}

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) {
    return defaultValue;
  }
  const normalized = raw.trim().toLowerCase();
  if (normalized === '' || normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') {
    return true;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') {
    return false;
  }
  return defaultValue;
}

function normalizePosix(p: string): string {
  return p.split(path.sep).join('/');
}

function posixJoin(a: string, b: string): string {
  return `${a.replace(/\/+$/, '')}/${b.replace(/^\/+/, '')}`;
}

function relativePosix(rootPosix: string, fullPosix: string): string {
  const prefix = rootPosix.endsWith('/') ? rootPosix : `${rootPosix}/`;
  if (!fullPosix.startsWith(prefix)) {
    throw new Error(`Path ${fullPosix} is not under ${rootPosix}`);
  }
  return fullPosix.slice(prefix.length);
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function isDenied(posixPath: string, denyPrefixes: string[]): boolean {
  const normalizedPath = posixPath.endsWith('/') ? posixPath.slice(0, -1) : posixPath;
  for (const rawPrefix of denyPrefixes) {
    const prefix = rawPrefix.replace(/\/+$/, '');
    if (normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

function looksLikeText(content: Buffer): boolean {
  const sample = content.subarray(0, Math.min(content.length, 8_000));
  return !sample.includes(0);
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as T;
}

async function readDenyPrefixes(repoRoot: string): Promise<string[]> {
  const denyFile = path.join(repoRoot, 'scripts/open-core/community-core-deny-pathPrefixes.txt');
  const raw = await readFile(denyFile, 'utf8');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

async function copyFileEnsuringDir(sourceAbs: string, targetAbs: string): Promise<void> {
  await mkdir(path.dirname(targetAbs), { recursive: true });
  await copyFile(sourceAbs, targetAbs);
}

async function walkFiles(rootAbs: string): Promise<string[]> {
  const output: string[] = [];
  const rootPosix = normalizePosix(rootAbs);

  async function walk(dirAbs: string): Promise<void> {
    const entries = await readdir(dirAbs, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dirAbs, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === '.next' || entry.name === 'node_modules') {
          continue;
        }
        await walk(abs);
        continue;
      }
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        continue;
      }
      output.push(relativePosix(rootPosix, normalizePosix(abs)));
    }
  }

  await walk(rootAbs);
  return output;
}

async function scanLeaks(exportRootAbs: string): Promise<void> {
  const files = await walkFiles(exportRootAbs);
  const hits: string[] = [];

  for (const rel of files) {
    if (
      rel === 'OPEN_CORE_EXPORT_META.json' ||
      rel === 'scripts/open-core/build-community-core-export.ts'
    ) {
      continue;
    }
    const ext = path.extname(rel).toLowerCase();
    if (!CONTENT_SCAN_EXT.has(ext)) {
      continue;
    }
    const abs = path.join(exportRootAbs, rel);
    const content = await readFile(abs);
    if (!looksLikeText(content)) {
      continue;
    }
    const text = content.toString('utf8');
    for (const signature of LEAK_SUBSTRINGS) {
      if (text.includes(signature)) {
        hits.push(`${rel}: contains "${signature}"`);
      }
    }
  }

  if (hits.length > 0) {
    const message = ['Open-core export failed leak scan:', ...hits.map((x) => `- ${x}`)].join('\n');
    throw new Error(message);
  }
}

async function ensureCommunityExportMetadata(repoRoot: string, outDirAbs: string, copied: Set<string>): Promise<void> {
  const communityEnvExampleAbs = path.join(repoRoot, 'scripts/open-core/community-core-env.example');
  try {
    await stat(communityEnvExampleAbs);
  } catch {
    throw new Error(`Missing community env template: ${communityEnvExampleAbs}`);
  }
  await copyFile(communityEnvExampleAbs, path.join(outDirAbs, 'env.example'));
  copied.add('env.example');

  const communityLicenseAbs = path.join(repoRoot, 'scripts/open-core/community-core-LICENSE');
  try {
    await stat(communityLicenseAbs);
  } catch {
    throw new Error(`Missing community LICENSE template: ${communityLicenseAbs}`);
  }
  await copyFile(communityLicenseAbs, path.join(outDirAbs, 'LICENSE'));
  copied.add('LICENSE');

  const exportPackageJsonAbs = path.join(outDirAbs, 'package.json');
  const packageJsonRaw = await readFile(exportPackageJsonAbs, 'utf8');
  const packageJson = JSON.parse(packageJsonRaw) as Record<string, unknown>;
  // SPDX: proprietary grant; full terms in root `LICENSE` copied from `community-core-LICENSE`.
  packageJson.license = 'UNLICENSED';
  await writeFile(exportPackageJsonAbs, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
}

async function main() {
  const repoRoot = path.resolve(process.cwd());
  const outDirArg = readArg('out-dir') ?? process.env.OPEN_CORE_EXPORT_DIR;
  const outDirAbs = path.resolve(repoRoot, (outDirArg && outDirArg.trim()) || '.open-core-export');
  const dryRun = parseBool(readArg('dry-run') ?? process.env.OPEN_CORE_DRY_RUN, false);

  const allowManifestPath = path.join(repoRoot, 'scripts/open-core/community-core-allow.json');
  const allowManifest = await readJson<AllowManifest>(allowManifestPath);
  const denyPrefixes = await readDenyPrefixes(repoRoot);

  if (!dryRun) {
    await rm(outDirAbs, { recursive: true, force: true });
    await mkdir(outDirAbs, { recursive: true });
  }

  const copied = new Set<string>();
  for (const prefix of allowManifest.includePrefixes) {
    const sourceAbs = path.join(repoRoot, prefix);
    let sourceStat;
    try {
      sourceStat = await stat(sourceAbs);
    } catch {
      continue;
    }

    const prefixPosix = normalizePosix(prefix);
    if (isDenied(prefixPosix, denyPrefixes)) {
      throw new Error(`Allow manifest contains denied path: ${prefixPosix}`);
    }

    if (sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      if (!dryRun) {
        await copyFileEnsuringDir(sourceAbs, path.join(outDirAbs, prefixPosix));
      }
      copied.add(prefixPosix);
      continue;
    }
    if (!sourceStat.isDirectory()) {
      continue;
    }

    const files = await walkFiles(sourceAbs);
    for (const inner of files) {
      const relPath = posixJoin(prefixPosix, normalizePosix(inner));
      if (isDenied(relPath, denyPrefixes)) {
        continue;
      }
      if (!dryRun) {
        await copyFileEnsuringDir(path.join(repoRoot, relPath), path.join(outDirAbs, relPath));
      }
      copied.add(relPath);
    }
  }

  if (!dryRun) {
    await ensureCommunityExportMetadata(repoRoot, outDirAbs, copied);
  }

  const meta = {
    builtAt: new Date().toISOString(),
    denyPrefixesSha256: sha256Hex(denyPrefixes.join('\n')),
    dryRun,
    exportDir: normalizePosix(path.relative(repoRoot, outDirAbs) || '.'),
    filesCopied: copied.size,
    manifestSha256: sha256Hex(JSON.stringify(allowManifest)),
    sourceCommit: process.env.GITHUB_SHA ?? '',
  };

  if (!dryRun) {
    await writeFile(path.join(outDirAbs, 'OPEN_CORE_EXPORT_META.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
    await scanLeaks(outDirAbs);
  }

  // eslint-disable-next-line no-console -- CLI output
  console.log(
    dryRun
      ? `[open-core] dry-run: would export ~${copied.size} files`
      : `[open-core] exported ${copied.size} files to ${meta.exportDir}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
