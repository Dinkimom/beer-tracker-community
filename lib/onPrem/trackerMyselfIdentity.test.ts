import { describe, expect, it } from 'vitest';

import { trackerIdentityCandidatesFromMyself } from './trackerMyselfIdentity';

describe('trackerIdentityCandidatesFromMyself', () => {
  it('returns string uid from numeric uid', () => {
    expect(trackerIdentityCandidatesFromMyself({ uid: 12345 })).toEqual(['12345']);
  });

  it('prefers uid over trackerUid when both present', () => {
    expect(trackerIdentityCandidatesFromMyself({ trackerUid: 9, uid: 42 })).toEqual(['42']);
  });

  it('returns trimmed string id', () => {
    expect(trackerIdentityCandidatesFromMyself({ id: '  y-user-1  ' })).toEqual(['y-user-1']);
  });

  it('returns empty for invalid input', () => {
    expect(trackerIdentityCandidatesFromMyself(null)).toEqual([]);
    expect(trackerIdentityCandidatesFromMyself({})).toEqual([]);
  });
});
