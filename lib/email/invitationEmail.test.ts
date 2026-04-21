import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildInvitationEmailContent, scheduleInvitationEmailDelivery } from './invitationEmail';

describe('buildInvitationEmailContent', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('includes org, team and link in subject and body', () => {
    const { html, subject, text } = buildInvitationEmailContent({
      acceptUrl: 'https://app.test/invite/token',
      organizationName: 'Acme',
      teamTitle: 'Backend',
    });
    expect(subject).toContain('Backend');
    expect(text).toContain('Acme');
    expect(text).toContain('https://app.test/invite/token');
    expect(html).toContain('Acme');
    expect(html).toContain('https://app.test/invite/token');
  });

  it('org-only invitation omits team from subject and body', () => {
    const { html, subject, text } = buildInvitationEmailContent({
      acceptUrl: 'https://app.test/invite/token',
      organizationName: 'Acme',
      teamTitle: null,
    });
    expect(subject).toContain('организацию');
    expect(subject).toContain('Acme');
    expect(text).not.toContain('команда');
    expect(text).toContain('Acme');
    expect(html).toContain('Acme');
    expect(html).not.toContain('команда');
  });

  it('escapes HTML in org and team names', () => {
    const { html } = buildInvitationEmailContent({
      acceptUrl: 'https://x/y',
      organizationName: '<script>',
      teamTitle: 'A & B',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; B');
  });

  it('embeds favicon when NEXT_PUBLIC_APP_URL is set', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example');
    const { html } = buildInvitationEmailContent({
      acceptUrl: 'https://app.example/invite/t',
      organizationName: 'Org',
      teamTitle: null,
    });
    expect(html).toContain('src="https://app.example/favicon.svg"');
  });

  it('omits logo img when NEXT_PUBLIC_APP_URL is unset', () => {
    const { html } = buildInvitationEmailContent({
      acceptUrl: 'https://x/y',
      organizationName: 'Org',
      teamTitle: null,
    });
    expect(html).not.toContain('favicon.svg');
  });
});

const { mockSendMail } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({}),
}));

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: mockSendMail })),
  },
}));

describe('scheduleInvitationEmailDelivery', () => {
  beforeEach(() => {
    mockSendMail.mockClear();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  async function flushMicrotasks(): Promise<void> {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }

  it('does not call sendMail when SMTP is not configured', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    scheduleInvitationEmailDelivery({
      acceptUrl: 'https://app/invite/t',
      organizationName: 'O',
      teamTitle: 'T',
      to: 'a@b.c',
    });
    await flushMicrotasks();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('calls sendMail when SMTP env is complete', async () => {
    vi.stubEnv('SMTP_HOST', 'localhost');
    vi.stubEnv('SMTP_PORT', '1025');
    vi.stubEnv('SMTP_USER', 'u');
    vi.stubEnv('SMTP_PASSWORD', 'p');
    vi.stubEnv('INVITATION_EMAIL_FROM', 'Beer <noreply@localhost>');
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    scheduleInvitationEmailDelivery({
      acceptUrl: 'https://app/invite/tok',
      organizationName: 'Org',
      teamTitle: 'Team',
      to: 'user@example.com',
    });
    await flushMicrotasks();

    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const arg = mockSendMail.mock.calls[0]?.[0] as { from: string; to: string };
    expect(arg.to).toBe('user@example.com');
    expect(arg.from).toBe('Beer <noreply@localhost>');
  });
});
