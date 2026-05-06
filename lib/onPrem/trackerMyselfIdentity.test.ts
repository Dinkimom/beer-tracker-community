import { describe, expect, it } from 'vitest';

import { trackerIdentityCandidatesFromMyself, trackerWorkEmailFromMyself } from './trackerMyselfIdentity';

describe('trackerWorkEmailFromMyself', () => {
  it('returns normalized email', () => {
    expect(trackerWorkEmailFromMyself({ email: '  User@Example.COM  ' })).toBe('user@example.com');
  });

  it('returns null when missing or empty', () => {
    expect(trackerWorkEmailFromMyself(null)).toBeNull();
    expect(trackerWorkEmailFromMyself({})).toBeNull();
    expect(trackerWorkEmailFromMyself({ email: '   ' })).toBeNull();
    expect(trackerWorkEmailFromMyself({ email: 1 })).toBeNull();
  });
});

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
