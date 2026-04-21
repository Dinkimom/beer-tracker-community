import { afterEach, describe, expect, it, vi } from 'vitest';

import { readInvitationSmtpEnv } from './invitationSmtpConfig';

describe('readInvitationSmtpEnv', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns null if any required var is missing', () => {
    vi.stubEnv('SMTP_HOST', 'smtp.test');
    vi.stubEnv('SMTP_USER', 'u');
    vi.stubEnv('SMTP_PASSWORD', 'p');
    expect(readInvitationSmtpEnv()).toBeNull();
  });

  it('returns config when host, user, password, from are set', () => {
    vi.stubEnv('SMTP_HOST', 'smtp.test');
    vi.stubEnv('SMTP_PORT', '587');
    vi.stubEnv('SMTP_USER', 'user');
    vi.stubEnv('SMTP_PASSWORD', 'secret');
    vi.stubEnv('INVITATION_EMAIL_FROM', 'App <noreply@test.local>');
    const c = readInvitationSmtpEnv();
    expect(c).toEqual({
      auth: { pass: 'secret', user: 'user' },
      from: 'App <noreply@test.local>',
      host: 'smtp.test',
      port: 587,
      secure: false,
    });
  });

  it('sets secure true for port 465', () => {
    vi.stubEnv('SMTP_HOST', 'smtp.test');
    vi.stubEnv('SMTP_PORT', '465');
    vi.stubEnv('SMTP_USER', 'user');
    vi.stubEnv('SMTP_PASSWORD', 'secret');
    vi.stubEnv('INVITATION_EMAIL_FROM', 'App <a@b>');
    expect(readInvitationSmtpEnv()?.secure).toBe(true);
  });
});
