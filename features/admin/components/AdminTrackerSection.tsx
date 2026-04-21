'use client';

import type { FormEvent } from 'react';

import { Button } from '@/components/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { YANDEX_OAUTH_CLIENT_ID } from '@/constants';
import { badgeSuccess, badgeWarning, cardBody, cardHeader, cardShell, field, hCard, label, muted } from '@/features/admin/adminUiTokens';

interface AdminTrackerSectionProps {
  'aria-labelledby'?: string;
  connectLoading: boolean;
  connectOrgId: string;
  id?: string;
  trackerHasStoredToken: boolean;
  trackerOrgId: string;
  trackerToken: string;
  trackerTokenEditOpen: boolean;
  trackerVerifyLoading: boolean;
  onSubmit: (e: FormEvent) => void;
  onTokenEditCancel: () => void;
  onTokenEditOpen: () => void;
  onTrackerOrgIdChange: (value: string) => void;
  onTrackerTokenChange: (value: string) => void;
  onVerify: () => void;
}

export function AdminTrackerSection({
  'aria-labelledby': ariaLabelledBy,
  connectLoading,
  connectOrgId,
  id,
  trackerHasStoredToken,
  trackerOrgId,
  trackerToken,
  trackerTokenEditOpen,
  trackerVerifyLoading,
  onSubmit,
  onTokenEditCancel,
  onTokenEditOpen,
  onTrackerOrgIdChange,
  onTrackerTokenChange,
  onVerify,
}: AdminTrackerSectionProps) {
  const { t } = useI18n();
  const storedTokenOnly = trackerHasStoredToken && !trackerTokenEditOpen;

  return (
    <section aria-labelledby={ariaLabelledBy} className={cardShell} id={id}>
      <div className={`${cardHeader} flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`}>
        <div className="min-w-0">
          <h2 className={hCard}>{t('admin.trackerSection.title')}</h2>
          <p className={`mt-1 ${muted}`}>{t('admin.trackerSection.description')}</p>
        </div>
        <div className="flex shrink-0 justify-end sm:pt-0.5">
          {trackerHasStoredToken ? (
            <span className={badgeSuccess}>{t('admin.trackerSection.tokenSaved')}</span>
          ) : (
            <span className={badgeWarning}>{t('admin.trackerSection.notConfigured')}</span>
          )}
        </div>
      </div>
      <div className={`${cardBody} space-y-5`}>
        <form className="space-y-5" onSubmit={onSubmit}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-3">
            <div className="w-full shrink-0 sm:w-[9rem] md:w-[10rem]">
              <label className={label} htmlFor="tr-org">
                Cloud Organization ID
              </label>
              <input
                className={field}
                id="tr-org"
                placeholder={t('admin.trackerSection.orgPlaceholder')}
                required
                type="text"
                value={trackerOrgId}
                onChange={(e) => onTrackerOrgIdChange(e.target.value)}
              />
            </div>

            {storedTokenOnly ? (
              <div className="flex min-w-0 flex-1 flex-col gap-0 sm:flex-none">
                <span className={label}>{t('admin.trackerSection.oauthTokenLabel')}</span>
                <Button
                  className="h-9 w-full px-3.5 sm:w-auto sm:self-start"
                  type="button"
                  variant="accent"
                  onClick={onTokenEditOpen}
                >
                  {t('admin.trackerSection.changeToken')}
                </Button>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <label className={label} htmlFor="tr-token">
                  {trackerTokenEditOpen
                    ? t('admin.trackerSection.oauthTokenNewLabel')
                    : t('admin.trackerSection.oauthTokenLabel')}
                </label>
                {trackerTokenEditOpen ? (
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-2">
                    <input
                      autoComplete="off"
                      className={`${field} min-w-0 w-full sm:flex-1`}
                      id="tr-token"
                      placeholder={t('admin.trackerSection.pasteTokenPlaceholder')}
                      required
                      type="password"
                      value={trackerToken}
                      onChange={(e) => onTrackerTokenChange(e.target.value)}
                    />
                    <Button
                      className="h-9 w-full shrink-0 px-3.5 sm:w-auto"
                      type="button"
                      variant="outline"
                      onClick={onTokenEditCancel}
                    >
                      {t('common.cancel')}
                    </Button>
                  </div>
                ) : (
                  <input
                    autoComplete="off"
                    className={field}
                    id="tr-token"
                    placeholder={t('admin.trackerSection.pasteTokenPlaceholder')}
                    required={!trackerHasStoredToken}
                    type="password"
                    value={trackerToken}
                    onChange={(e) => onTrackerTokenChange(e.target.value)}
                  />
                )}
              </div>
            )}

            <Button
              className="h-9 w-full shrink-0 px-3.5 sm:w-auto"
              disabled={
                !connectOrgId ||
                trackerVerifyLoading ||
                !trackerOrgId.trim() ||
                (!trackerHasStoredToken && !trackerToken.trim())
              }
              type="button"
              variant="outline"
              onClick={onVerify}
            >
              {trackerVerifyLoading
                ? t('admin.trackerSection.verifying')
                : t('admin.trackerSection.verifyToken')}
            </Button>
          </div>
          <p className={muted}>
            {t('auth.setup.getTokenPrefix')}{' '}
            <a
              className="font-semibold text-amber-600 hover:underline dark:text-amber-400"
              href={`https://oauth.yandex.ru/authorize?response_type=token&client_id=${YANDEX_OAUTH_CLIENT_ID}&scope=tracker:read+tracker:write`}
              rel="noopener noreferrer"
              target="_blank"
            >
              {t('auth.setup.oauthLink')}
            </a>
          </p>

          <Button className="px-3.5 py-2" disabled={connectLoading} type="submit" variant="primary">
            {connectLoading ? t('admin.trackerSection.saving') : t('admin.trackerSection.saveSettings')}
          </Button>
        </form>
      </div>
    </section>
  );
}
