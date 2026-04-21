/**
 * SMTP для писем с приглашениями. Все значения из env; без секретов в коде.
 */

export interface InvitationSmtpConfig {
  auth: { pass: string; user: string };
  from: string;
  host: string;
  port: number;
  secure: boolean;
}

/**
 * Полная конфигурация только если заданы host, user, password, from.
 * Иначе отправка не выполняется — ссылка пишется в лог (см. invitationEmail).
 */
export function readInvitationSmtpEnv(): InvitationSmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.INVITATION_EMAIL_FROM?.trim();
  if (!host || !user || !password || !from) {
    return null;
  }

  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? Number.parseInt(portRaw, 10) : 587;
  if (!Number.isFinite(port) || port < 1 || port > 65_535) {
    return null;
  }

  const secureFlag = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure =
    secureFlag === 'true' ||
    secureFlag === '1' ||
    secureFlag === 'yes' ||
    port === 465;

  return { auth: { pass: password, user }, from, host, port, secure };
}
