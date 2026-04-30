import { describe, expect, it } from 'vitest';

import {
  isDenied,
  isInCommunityPathScope,
  matchesAllowEntry,
  partitionPathsByCommunityScope,
  type AllowManifest,
} from './communityPathScope';

const sampleAllow: AllowManifest = {
  includePrefixes: [
    'app/',
    'package.json',
    'ARCHITECTURE.md',
    '.github/workflows/ci.yml',
  ],
};

const sampleDeny = ['app/demo/', 'lib/demo/', 'private/'];

describe('matchesAllowEntry', () => {
  it('matches directory prefix', () => {
    expect(matchesAllowEntry('app/page.tsx', 'app/')).toBe(true);
    expect(matchesAllowEntry('app', 'app/')).toBe(false);
  });

  it('matches exact file', () => {
    expect(matchesAllowEntry('package.json', 'package.json')).toBe(true);
    expect(matchesAllowEntry('package.json.bak', 'package.json')).toBe(false);
    expect(matchesAllowEntry('.github/workflows/ci.yml', '.github/workflows/ci.yml')).toBe(true);
  });
});

describe('isInCommunityPathScope', () => {
  it('accepts allowed paths', () => {
    expect(isInCommunityPathScope('app/foo.ts', sampleAllow, sampleDeny)).toBe(true);
    expect(isInCommunityPathScope('package.json', sampleAllow, sampleDeny)).toBe(true);
  });

  it('rejects deny under allowed prefix', () => {
    expect(isInCommunityPathScope('app/demo/x.ts', sampleAllow, sampleDeny)).toBe(false);
  });

  it('rejects paths outside manifest', () => {
    expect(isInCommunityPathScope('enterprise/foo.ts', sampleAllow, sampleDeny)).toBe(false);
  });
});

describe('partitionPathsByCommunityScope', () => {
  it('splits in and out', () => {
    const { inScope, outOfScope } = partitionPathsByCommunityScope(
      ['app/a.ts', 'private/x.ts', 'app/demo/b.ts'],
      sampleAllow,
      sampleDeny,
    );
    expect(inScope).toEqual(['app/a.ts']);
    expect(outOfScope).toContain('private/x.ts');
    expect(outOfScope).toContain('app/demo/b.ts');
  });
});

describe('isDenied', () => {
  it('matches prefix semantics', () => {
    expect(isDenied('lib/demo/foo', sampleDeny)).toBe(true);
    expect(isDenied('lib/other/foo', sampleDeny)).toBe(false);
  });
});
