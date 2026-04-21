/**
 * Доставка ссылки приглашения: SMTP (если задан env) или лог сервера.
 * Отправка не блокирует HTTP-ответ API (schedule…).
 */

import nodemailer from 'nodemailer';

import { readInvitationSmtpEnv } from '@/lib/email/invitationSmtpConfig';

export function logInvitationAcceptUrl(email: string, acceptUrl: string): void {
  console.warn(`[invitation] ${email} → ${acceptUrl}`);
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const INVITATION_EMAIL_FONT =
  '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif';

/** Как `Button` primary: Tailwind `blue-600`. */
const EMAIL_PRIMARY = '#2563eb';
/** Как `AuthBackground` (светлая тема) в `components/AuthScreenChrome.tsx`. */
const EMAIL_AUTH_GRADIENT =
  'linear-gradient(165deg,#f0f9ff 0%,#e8f4fc 42%,#f1f5f9 78%,#f8fafc 100%)';
/** Fallback, если клиент обрежет градиент. */
const EMAIL_AUTH_FALLBACK_BG = '#f0f9ff';
/** Как `AuthCard`: `rounded-2xl`, тень ближе к `shadow-xl`. */
const EMAIL_CARD_RADIUS = '16px';
const EMAIL_CARD_SHADOW = '0 20px 25px -5px rgba(15,23,42,0.08),0 8px 10px -6px rgba(15,23,42,0.06)';
/** Как ссылки входа: `authTextLinkClassName` (blue-600 + подчёркивание). */
const EMAIL_LINK_STYLE = `color:${EMAIL_PRIMARY};text-decoration:underline;text-underline-offset:2px;`;

/**
 * Абсолютный URL favicon для шапки письма (как иконка на вкладке в приложении).
 * Без `NEXT_PUBLIC_APP_URL` блок с картинкой не рендерится.
 */
function invitationBrandLogoUrl(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL('favicon.svg', raw.endsWith('/') ? raw : `${raw}/`).href;
  } catch {
    return null;
  }
}

function buildInvitationEmailHtml(input: {
  acceptUrlEscaped: string;
  introLineHtml: string;
  logoUrl: string | null;
}): string {
  const { acceptUrlEscaped, introLineHtml, logoUrl } = input;
  const logoBlock =
    logoUrl != null
      ? `<img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="" role="presentation" style="display:block;margin:0 auto 10px;border:0;" />`
      : '';
  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="x-ua-compatible" content="ie=edge" />
<title>Приглашение</title>
</head>
<body style="margin:0;padding:0;background-color:${EMAIL_AUTH_FALLBACK_BG};">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${EMAIL_AUTH_FALLBACK_BG};background-image:${EMAIL_AUTH_GRADIENT};">
  <tr>
    <td align="center" style="padding:28px 16px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:448px;">
        <tr>
          <td style="padding:0 0 22px 0;font-family:${INVITATION_EMAIL_FONT};text-align:center;">
            ${logoBlock}
            <div style="font-size:15px;font-weight:700;letter-spacing:-0.02em;color:#111827;">Beer Tracker</div>
            <div style="margin-top:4px;font-size:13px;line-height:1.45;color:#374151;">Планер спринтов и команд</div>
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;border-radius:${EMAIL_CARD_RADIUS};border:1px solid #e5e7eb;box-shadow:${EMAIL_CARD_SHADOW};">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
              <tr>
                <td style="padding:32px 32px 12px 32px;font-family:${INVITATION_EMAIL_FONT};">
                  <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;font-weight:700;letter-spacing:-0.02em;color:#111827;">
                    Вас пригласили
                  </h1>
                  <p style="margin:0 0 20px 0;font-size:16px;line-height:1.55;color:#374151;">
                    ${introLineHtml}
                  </p>
                  <p style="margin:0 0 0 0;font-size:15px;line-height:1.5;color:#374151;">
                    Нажмите кнопку ниже, чтобы принять приглашение и задать пароль для входа.
                  </p>
                </td>
              </tr>
              <tr>
                <td style="padding:12px 32px 32px 32px;font-family:${INVITATION_EMAIL_FONT};">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                    <tr>
                      <td align="center" bgcolor="${EMAIL_PRIMARY}" style="border-radius:8px;">
                        <a href="${acceptUrlEscaped}" style="display:inline-block;padding:12px 24px;font-family:${INVITATION_EMAIL_FONT};font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">
                          Принять приглашение
                        </a>
                      </td>
                    </tr>
                  </table>
                  <p style="margin:22px 0 0 0;font-size:13px;line-height:1.5;color:#4b5563;">
                    Если кнопка не открывается, скопируйте ссылку в адресную строку браузера:
                  </p>
                  <p style="margin:8px 0 0 0;font-size:13px;line-height:1.45;word-break:break-all;font-family:${INVITATION_EMAIL_FONT};">
                    <a href="${acceptUrlEscaped}" style="${EMAIL_LINK_STYLE}">${acceptUrlEscaped}</a>
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 8px 0 8px;font-family:${INVITATION_EMAIL_FONT};font-size:12px;line-height:1.5;color:#6b7280;text-align:center;">
            Если вы не ждали это письмо, просто проигнорируйте его — аккаунт не будет создан.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function buildInvitationEmailContent(input: {
  acceptUrl: string;
  organizationName: string;
  /** Если пусто — приглашение только в организацию (без команды). */
  teamTitle?: string | null;
}): { html: string; subject: string; text: string } {
  const org = escapeHtml(input.organizationName);
  const teamRaw = input.teamTitle?.trim();
  const team = teamRaw ? escapeHtml(teamRaw) : '';
  const subject = teamRaw
    ? `Приглашение в команду «${teamRaw}»`
    : `Приглашение в организацию «${input.organizationName}»`;
  const text = teamRaw
    ? [
        `Вас пригласили в организацию «${input.organizationName}», команда «${teamRaw}».`,
        '',
        'Перейдите по ссылке, чтобы принять приглашение и задать пароль:',
        input.acceptUrl,
        '',
        'Если вы не ждали это письмо, проигнорируйте его.',
      ].join('\n')
    : [
        `Вас пригласили в организацию «${input.organizationName}».`,
        '',
        'Перейдите по ссылке, чтобы принять приглашение и задать пароль:',
        input.acceptUrl,
        '',
        'Если вы не ждали это письмо, проигнорируйте его.',
      ].join('\n');
  const acceptUrlEscaped = escapeHtml(input.acceptUrl);
  const introLineHtml = teamRaw
    ? `Вас пригласили в организацию <strong style="color:#111827;">${org}</strong>, команда <strong style="color:#111827;">${team}</strong>.`
    : `Вас пригласили в организацию <strong style="color:#111827;">${org}</strong>.`;
  const html = buildInvitationEmailHtml({
    acceptUrlEscaped,
    introLineHtml,
    logoUrl: invitationBrandLogoUrl(),
  });
  return { html, subject, text };
}

async function sendInvitationViaSmtp(input: {
  acceptUrl: string;
  organizationName: string;
  teamTitle?: string | null;
  to: string;
}): Promise<void> {
  const config = readInvitationSmtpEnv();
  if (!config) {
    throw new Error('SMTP not configured');
  }
  const { html, subject, text } = buildInvitationEmailContent(input);
  const transporter = nodemailer.createTransport({
    auth: config.auth,
    host: config.host,
    port: config.port,
    secure: config.secure,
  });
  await transporter.sendMail({
    from: config.from,
    html,
    subject,
    text,
    to: input.to,
  });
}

export interface ScheduleInvitationEmailInput {
  acceptUrl: string;
  organizationName: string;
  teamTitle?: string | null;
  to: string;
}

async function runInvitationEmailDelivery(input: ScheduleInvitationEmailInput): Promise<void> {
  const smtp = readInvitationSmtpEnv();
  if (!smtp) {
    logInvitationAcceptUrl(input.to, input.acceptUrl);
    return;
  }
  try {
    await sendInvitationViaSmtp(input);
    console.warn(`[invitation] письмо отправлено на ${input.to} (SMTP)`);
  } catch (err) {
    console.error('[invitation] ошибка SMTP, ссылка в логе ниже', err);
    logInvitationAcceptUrl(input.to, input.acceptUrl);
  }
}

/**
 * Запускает доставку в фоне: при успехе SMTP в лог попадает только факт отправки (без ссылки).
 * Без SMTP или при ошибке — полная ссылка в логе для ручной передачи.
 */
export function scheduleInvitationEmailDelivery(input: ScheduleInvitationEmailInput): void {
  runInvitationEmailDelivery(input).catch((err) => {
    console.error('[invitation] доставка приглашения', err);
  });
}
