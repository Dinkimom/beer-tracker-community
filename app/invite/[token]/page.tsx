'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type FormEvent } from 'react';

import { BeerLottie } from '@/components/BeerLottie';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { PasswordInput } from '@/components/PasswordInput';
import { useI18n } from '@/contexts/LanguageContext';
import { parseInvitationRawTokenFromRouteParam } from '@/lib/invitations/invitationTokenRouteParse';

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function invitationPreviewErrorMessage(reason: string | undefined, t: TranslateFn): string {
  switch (reason) {
    case 'expired':
      return t('inviteAccept.previewErrors.expired');
    case 'used':
      return t('inviteAccept.previewErrors.used');
    case 'revoked':
      return t('inviteAccept.previewErrors.revoked');
    case 'not_found':
      return t('inviteAccept.previewErrors.not_found');
    default:
      return t('inviteAccept.previewErrors.not_found');
  }
}

type PreviewState =
  | {
      email: string;
      expiresAt: string;
      organizationName: string;
      status: 'ready';
      teamTitle: string | null;
    }
  | { error: string; status: 'error' }
  | { status: 'loading' };

export default function InviteAcceptPage() {
  const { language, t } = useI18n();
  const dateLocale = language === 'en' ? 'en-US' : 'ru-RU';
  const params = useParams();
  const router = useRouter();
  const tokenParam = typeof params.token === 'string' ? params.token : '';
  const rawInviteToken = parseInvitationRawTokenFromRouteParam(tokenParam);

  const [preview, setPreview] = useState<PreviewState>({ status: 'loading' });
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadPreview = useCallback(async () => {
    if (!rawInviteToken) {
      setPreview({ error: t('inviteAccept.invalidLink'), status: 'error' });
      return;
    }
    setPreview({ status: 'loading' });
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(rawInviteToken)}`, {
        credentials: 'include',
      });
      const data = (await res.json()) as {
        email?: string;
        error?: string;
        expiresAt?: string;
        organizationName?: string;
        reason?: string;
        teamTitle?: string;
      };
      if (!res.ok) {
        setPreview({
          error: invitationPreviewErrorMessage(data.reason, t),
          status: 'error',
        });
        return;
      }
      if (!data.email || !data.expiresAt || !data.organizationName) {
        setPreview({ error: t('inviteAccept.badServerResponse'), status: 'error' });
        return;
      }
      setPreview({
        email: data.email,
        expiresAt: data.expiresAt,
        organizationName: data.organizationName,
        status: 'ready',
        teamTitle:
          data.teamTitle != null && String(data.teamTitle).trim() !== ''
            ? String(data.teamTitle)
            : null,
      });
    } catch {
      setPreview({ error: t('inviteAccept.networkError'), status: 'error' });
    }
  }, [rawInviteToken, t]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (preview.status !== 'ready') return;
    if (password.trim().length < 8) {
      setFormError(t('inviteAccept.passwordTooShort'));
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      const res = await fetch(`/api/invitations/${encodeURIComponent(rawInviteToken)}`, {
        body: JSON.stringify({ password: password.trim() }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setFormError(data.error ?? t('inviteAccept.acceptFailed'));
        setSubmitting(false);
        return;
      }
      router.push('/auth-setup');
      router.refresh();
    } catch {
      setFormError(t('inviteAccept.networkError'));
      setSubmitting(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden p-4"
      style={{
        background:
          'linear-gradient(165deg, #f0f9ff 0%, #e0f2fe 25%, #fefce8 50%, #fef3c7 75%, #fef9c3 100%)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden dark:block"
        style={{
          background:
            'linear-gradient(165deg, #0f172a 0%, #1e293b 30%, #1e3a5f 60%, #0f172a 100%)',
        }}
      />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex items-center justify-center gap-3">
            <BeerLottie size={64} />
            <h1
              className="text-2xl font-bold text-gray-900 dark:text-gray-100 md:text-3xl"
              style={{
                fontFamily: 'var(--font-caveat), cursive',
                fontWeight: 700,
                letterSpacing: '0.02em',
                transform: 'rotate(-1deg)',
              }}
            >
              {preview.status === 'ready'
                ? preview.teamTitle
                  ? t('inviteAccept.titleTeam')
                  : t('inviteAccept.titleOrg')
                : t('inviteAccept.titleGeneric')}
            </h1>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white/90 shadow-2xl shadow-gray-200/50 dark:border-gray-600/80 dark:bg-gray-800/95 dark:shadow-none">
          {preview.status === 'loading' ? (
            <div className="flex flex-col items-center gap-4 p-12">
              <Icon className="h-10 w-10 animate-spin text-amber-600" name="loader" />
              <p className="text-sm text-gray-600 dark:text-gray-300">{t('inviteAccept.loading')}</p>
            </div>
          ) : null}

          {preview.status === 'error' ? (
            <div className="space-y-4 p-8 text-center">
              <p className="text-gray-800 dark:text-gray-200">{preview.error}</p>
              <Link
                className="text-sm font-semibold text-amber-600 hover:underline dark:text-amber-400"
                href="/login"
              >
                {t('inviteAccept.goToLogin')}
              </Link>
            </div>
          ) : null}

          {preview.status === 'ready' ? (
            <form className="space-y-5 p-8" onSubmit={(e) => void handleSubmit(e)}>
              <div className="rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
                <p className="text-sm text-amber-950 dark:text-amber-100">
                  <span className="font-semibold">{preview.organizationName}</span>
                  {preview.teamTitle ? (
                    <>
                      {' · '}
                      <span>{preview.teamTitle}</span>
                    </>
                  ) : (
                    <span className="block text-xs font-normal opacity-90">{t('inviteAccept.orgOnlyHint')}</span>
                  )}
                </p>
                <p className="mt-2 text-xs text-amber-900/80 dark:text-amber-200/80">
                  {t('inviteAccept.linkExpires', {
                    date: new Date(preview.expiresAt).toLocaleString(dateLocale),
                  })}
                </p>
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  htmlFor="email"
                >
                  Email
                </label>
                <input
                  className="w-full cursor-not-allowed rounded-xl border-2 border-gray-200 bg-gray-100 px-4 py-3 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-700/50 dark:text-gray-200"
                  id="email"
                  readOnly
                  type="email"
                  value={preview.email}
                />
              </div>

              <div>
                <label
                  className="mb-2 block text-sm font-semibold text-gray-700 dark:text-gray-300"
                  htmlFor="password"
                >
                  {preview.email
                    ? t('inviteAccept.passwordLabelWithEmailHint')
                    : t('inviteAccept.passwordLabel')}
                </label>
                <PasswordInput
                  autoComplete="new-password"
                  className="w-full rounded-xl border-2 border-gray-200 px-4 py-3 text-sm dark:border-gray-600"
                  id="password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setFormError('');
                  }}
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t('inviteAccept.passwordHelp')}</p>
              </div>

              {formError ? (
                <p className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" name="alert-circle" />
                  <span>{formError}</span>
                </p>
              ) : null}

              <Button
                className="w-full !rounded-xl !border-0 !bg-amber-500 py-3.5 !text-sm !font-semibold !shadow-lg !shadow-amber-500/25 hover:!bg-amber-600 dark:!shadow-amber-500/10"
                disabled={submitting || password.trim().length < 8}
                type="submit"
                variant="primary"
              >
                {submitting ? (
                  <>
                    <Icon className="h-5 w-5 animate-spin" name="loader" />
                    <span>{t('inviteAccept.submitting')}</span>
                  </>
                ) : (
                  <>
                    <Icon className="h-5 w-5" name="check" />
                    <span>{t('inviteAccept.submit')}</span>
                  </>
                )}
              </Button>
            </form>
          ) : null}
        </div>
      </div>
    </div>
  );
}
