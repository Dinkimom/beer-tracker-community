import { describe, expect, it } from 'vitest';

import { generateInvitationRawToken, hashInvitationToken } from './invitationTokens';

describe('invitationTokens', () => {
  it('hashInvitationToken is deterministic', () => {
    const raw = 'test-token-abc';
    expect(hashInvitationToken(raw)).toBe(hashInvitationToken(raw));
  });

  it('generateInvitationRawToken returns url-safe non-empty string', () => {
    const a = generateInvitationRawToken();
    const b = generateInvitationRawToken();
    expect(a.length).toBeGreaterThan(20);
    expect(b.length).toBeGreaterThan(20);
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});
