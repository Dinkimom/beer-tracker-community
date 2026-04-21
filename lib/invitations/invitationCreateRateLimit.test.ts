import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  checkInvitationCreateAllowed,
  resetInvitationCreateRateLimitForTests,
} from './invitationCreateRateLimit';

describe('checkInvitationCreateAllowed', () => {
  beforeEach(() => {
    resetInvitationCreateRateLimitForTests();
    vi.unstubAllEnvs();
    vi.stubEnv('INVITATION_CREATE_MAX_PER_HOUR', '3');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    resetInvitationCreateRateLimitForTests();
  });

  it('allows up to max requests per hour', () => {
    expect(checkInvitationCreateAllowed('o1', 'u1').ok).toBe(true);
    expect(checkInvitationCreateAllowed('o1', 'u1').ok).toBe(true);
    expect(checkInvitationCreateAllowed('o1', 'u1').ok).toBe(true);
  });

  it('blocks when limit exceeded', () => {
    checkInvitationCreateAllowed('o1', 'u1');
    checkInvitationCreateAllowed('o1', 'u1');
    checkInvitationCreateAllowed('o1', 'u1');
    const r = checkInvitationCreateAllowed('o1', 'u1');
    expect(r.ok).toBe(false);
    expect(r.retryAfterSec).toBeGreaterThan(0);
  });

  it('disables limit when INVITATION_CREATE_MAX_PER_HOUR is 0', () => {
    vi.stubEnv('INVITATION_CREATE_MAX_PER_HOUR', '0');
    for (let i = 0; i < 5; i += 1) {
      expect(checkInvitationCreateAllowed('o2', 'u2').ok).toBe(true);
    }
  });
});
