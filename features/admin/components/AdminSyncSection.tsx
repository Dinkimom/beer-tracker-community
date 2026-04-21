'use client';

import type { AdminSyncStatusPayload } from '@/features/admin/adminSyncTypes';
import type { FormEvent } from 'react';

import { Button } from '@/components/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { formatDateTime } from '@/features/admin/adminFormatters';
import {
  formatSyncJobType,
  formatSyncRunStatus,
  syncRunStatusWordClass,
} from '@/features/admin/adminSyncDisplay';
import { AdminSyncProgressPanel } from '@/features/admin/AdminSyncProgressPanel';
import {
  adminFormCheckbox,
  cardBody,
  cardHeader,
  cardShell,
  field,
  hCard,
  label,
  muted,
} from '@/features/admin/adminUiTokens';
import { AdminInlineAlert } from '@/features/admin/components/AdminInlineAlert';

interface AdminSyncSectionProps {
  'aria-labelledby'?: string;
  connectOrgId: string;
  formEnabled: boolean;
  formIntervalMinutes: string;
  formMaxIssuesPerRun: string;
  formOverlapMinutes: string;
  formWindowEnd: string;
  formWindowStart: string;
  id?: string;
  settingsSaving: boolean;
  showSyncRaw: boolean;
  syncStatusLoading: boolean;
  syncView: AdminSyncStatusPayload | null;
  onFormEnabledChange: (value: boolean) => void;
  onFormIntervalChange: (value: string) => void;
  onFormMaxIssuesChange: (value: string) => void;
  onFormOverlapChange: (value: string) => void;
  onFormWindowEndChange: (value: string) => void;
  onFormWindowStartChange: (value: string) => void;
  onFullRescan: () => void;
  onIncrementalSync: () => void;
  onRefreshStatus: () => void;
  onSaveSettings: (e: FormEvent) => void;
  onShowSyncRawChange: (value: boolean) => void;
}

type AdminSyncLastRun = NonNullable<AdminSyncStatusPayload['lastSyncRun']>;

function AdminSyncLastSyncRunLine({
  has,
  run,
  t,
}: {
  has: (key: string) => boolean;
  run: AdminSyncLastRun;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  const jobLabel = formatSyncJobType(run.jobType, t, has);
  return (
    <li>
      {t('admin.syncPage.lastRunPrefix')}{' '}
      <span className={syncRunStatusWordClass(run.status)}>{formatSyncRunStatus(run.status, t, has)}</span>
      {jobLabel ? (
        <>
          {' · '}
          <span className="text-gray-700 dark:text-gray-300">{jobLabel}</span>
        </>
      ) : null}
      {', '}
      {formatDateTime(run.startedAt)}
      {run.finishedAt ? ` — ${formatDateTime(run.finishedAt)}` : ''}
      {run.errorSummary ? (
        <span className="mt-0.5 block text-red-600 dark:text-red-400">{run.errorSummary}</span>
      ) : null}
    </li>
  );
}

function AdminSyncStateBlock({
  has,
  syncView,
  t,
}: {
  has: (key: string) => boolean;
  syncView: AdminSyncStatusPayload;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-200">
      <h3 className={hCard}>{t('admin.syncPage.stateTitle')}</h3>
      <ul className="mt-2 space-y-1.5 text-gray-700 dark:text-gray-300">
        <li>
          {t('admin.syncPage.initialImportLabel')}{' '}
          {syncView.organization.initialSyncCompletedAt ? (
            <span className="text-green-700 dark:text-green-400">
              {t('admin.syncPage.initialReady', {
                date: formatDateTime(syncView.organization.initialSyncCompletedAt),
              })}
            </span>
          ) : (
            <span className="text-amber-800 dark:text-amber-200">{t('admin.syncPage.initialPending')}</span>
          )}
        </li>
        {syncView.lastSyncRun ? (
          <AdminSyncLastSyncRunLine has={has} run={syncView.lastSyncRun} t={t} />
        ) : (
          <li className="text-gray-500 dark:text-gray-400">{t('admin.syncPage.noRunsYet')}</li>
        )}
        <li>
          {t('admin.syncPage.nextAutoRunPrefix')} {formatDateTime(syncView.organization.syncNextRunAt)}
          {!syncView.syncCronSecretConfigured ? (
            <span className="mt-1 block text-amber-800 dark:text-amber-200">{t('admin.syncPage.cronSecretWarning')}</span>
          ) : null}
        </li>
        <li>
          {t('admin.syncPage.backgroundJobsLabel')}{' '}
          {syncView.redisConfigured ? (
            <span className="text-green-700 dark:text-green-400">{t('admin.syncPage.redisAvailable')}</span>
          ) : (
            <span className="text-amber-800 dark:text-amber-200">{t('admin.syncPage.redisUnavailable')}</span>
          )}
        </li>
      </ul>
      {!syncView.syncValidation.ok ? (
        <div className="mt-4">
          <AdminInlineAlert variant="warning">
            {t('admin.syncPage.validationWarning', { message: syncView.syncValidation.message })}
          </AdminInlineAlert>
        </div>
      ) : null}
    </div>
  );
}

export function AdminSyncSection({
  'aria-labelledby': ariaLabelledBy,
  connectOrgId,
  id,
  formEnabled,
  formIntervalMinutes,
  formMaxIssuesPerRun,
  formOverlapMinutes,
  formWindowEnd,
  formWindowStart,
  settingsSaving,
  showSyncRaw,
  syncStatusLoading,
  syncView,
  onFormEnabledChange,
  onFormIntervalChange,
  onFormMaxIssuesChange,
  onFormOverlapChange,
  onFormWindowEndChange,
  onFormWindowStartChange,
  onFullRescan,
  onIncrementalSync,
  onRefreshStatus,
  onSaveSettings,
  onShowSyncRawChange,
}: AdminSyncSectionProps) {
  const { has, t } = useI18n();
  return (
    <section aria-labelledby={ariaLabelledBy} className={cardShell} id={id} role="tabpanel">
      <div className={cardHeader}>
        <div className="min-w-0">
          <h2 className={hCard}>{t('admin.syncPage.title')}</h2>
          <p className={`mt-1 ${muted}`}>{t('admin.syncPage.intro')}</p>
        </div>
      </div>
      <div className={`${cardBody} space-y-4`}>
        <div className="flex flex-wrap items-center gap-3 gap-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              className="px-3.5 py-2"
              disabled={syncStatusLoading || !connectOrgId}
              type="button"
              variant="outline"
              onClick={onRefreshStatus}
            >
              {syncStatusLoading ? t('admin.syncPage.refreshLoading') : t('admin.syncPage.refresh')}
            </Button>
          </div>
          <div className="flex flex-wrap gap-2 sm:border-l sm:border-ds-border-subtle sm:pl-3">
            <Button
              className="px-3.5 py-2"
              disabled={!connectOrgId}
              type="button"
              variant="outline"
              onClick={onIncrementalSync}
            >
              {t('admin.syncPage.runNow')}
            </Button>
            <Button
              className="px-3.5 py-2"
              disabled={!connectOrgId}
              type="button"
              variant="warning"
              onClick={onFullRescan}
            >
              {t('admin.syncPage.fullRescan')}
            </Button>
          </div>
        </div>
        {syncView ? <AdminSyncProgressPanel mutedClass={muted} syncView={syncView} /> : null}

        {syncView ? (
          <div className="space-y-4">
            <AdminSyncStateBlock has={has} syncView={syncView} t={t} />

            <form
              className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4 text-sm text-gray-800 dark:border-gray-600 dark:bg-gray-900/50 dark:text-gray-200"
              onSubmit={onSaveSettings}
            >
              <h3 className={hCard}>{t('admin.syncPage.settingsTitle')}</h3>
              <p className={`text-xs ${muted}`}>{t('admin.syncPage.settingsHint')}</p>
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  checked={formEnabled}
                  className={adminFormCheckbox}
                  type="checkbox"
                  onChange={(e) => onFormEnabledChange(e.target.checked)}
                />
                {t('admin.syncPage.syncEnabled')}
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className={label} htmlFor="set-int">
                    {t('admin.syncPage.intervalMinutes')}
                  </label>
                  <input
                    className={field}
                    id="set-int"
                    inputMode="numeric"
                    type="text"
                    value={formIntervalMinutes}
                    onChange={(e) => onFormIntervalChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="set-ov">
                    {t('admin.syncPage.overlapMinutes')}
                  </label>
                  <input
                    className={field}
                    id="set-ov"
                    inputMode="numeric"
                    type="text"
                    value={formOverlapMinutes}
                    onChange={(e) => onFormOverlapChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="set-max">
                    {t('admin.syncPage.maxIssues')}
                  </label>
                  <input
                    className={field}
                    id="set-max"
                    inputMode="numeric"
                    type="text"
                    value={formMaxIssuesPerRun}
                    onChange={(e) => onFormMaxIssuesChange(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="set-ws">
                    {t('admin.syncPage.windowStart')}
                  </label>
                  <input
                    className={`${field} font-mono text-xs`}
                    id="set-ws"
                    placeholder="2026-01-01T00:00:00.000Z"
                    title={t('admin.syncPage.windowStartTitle')}
                    type="text"
                    value={formWindowStart}
                    onChange={(e) => onFormWindowStartChange(e.target.value)}
                  />
                </div>
                <div>
                  <label className={label} htmlFor="set-we">
                    {t('admin.syncPage.windowEnd')}
                  </label>
                  <input
                    className={`${field} font-mono text-xs`}
                    id="set-we"
                    placeholder="2026-01-02T00:00:00.000Z"
                    title={t('admin.syncPage.windowEndTitle')}
                    type="text"
                    value={formWindowEnd}
                    onChange={(e) => onFormWindowEndChange(e.target.value)}
                  />
                </div>
              </div>
              <Button
                className="px-3.5 py-2"
                disabled={settingsSaving || !connectOrgId}
                type="submit"
                variant="primary"
              >
                {settingsSaving ? t('admin.syncPage.saveSaving') : t('admin.syncPage.save')}
              </Button>
            </form>
          </div>
        ) : null}

        {!syncView && syncStatusLoading && connectOrgId ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('admin.syncPage.loading')}</p>
        ) : null}

        <div className="border-t border-ds-border-subtle pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <input
              checked={showSyncRaw}
              className={adminFormCheckbox}
              type="checkbox"
              onChange={(e) => onShowSyncRawChange(e.target.checked)}
            />
            {t('admin.syncPage.showRawDebug')}
          </label>
          {showSyncRaw && syncView ? (
            <pre className="mt-2 max-h-72 overflow-auto rounded-lg border border-gray-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
              {JSON.stringify(syncView, null, 2)}
            </pre>
          ) : null}
        </div>
      </div>
    </section>
  );
}
