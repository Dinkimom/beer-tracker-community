'use client';

import type { AdminSyncStatusPayload } from '@/features/admin/adminSyncTypes';

import { useEffect, useState } from 'react';

import { useI18n } from '@/contexts/LanguageContext';
import {
  describeStatsCheckpoint,
  describeSyncProgressMeta,
  redisJobStateLabel,
} from '@/lib/sync/syncProgressForAdmin';

export function AdminSyncProgressPanel({
  mutedClass,
  syncView,
}: {
  mutedClass: string;
  syncView: AdminSyncStatusPayload;
}) {
  const { has, t } = useI18n();
  const [staleWaitingHint, setStaleWaitingHint] = useState(false);

  const heavyJobs = syncView.redisJobs.filter(
    (j) => j.mode === 'initial_full' || j.mode === 'full_rescan',
  );
  const displayJob =
    heavyJobs.find((j) => j.state === 'active') ??
    heavyJobs.find((j) => ['waiting', 'delayed', 'paused'].includes(j.state)) ??
    null;
  const waitingJobId =
    syncView.redisConfigured && displayJob?.state === 'waiting' && !syncView.runningSyncRun
      ? displayJob.id
      : null;

  useEffect(() => {
    if (waitingJobId == null) {
      return undefined;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (!cancelled) {
        setStaleWaitingHint(true);
      }
    }, 15_000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      setStaleWaitingHint(false);
    };
  }, [waitingJobId]);

  const runningStats =
    syncView.runningSyncRun?.stats &&
    typeof syncView.runningSyncRun.stats === 'object' &&
    !Array.isArray(syncView.runningSyncRun.stats)
      ? (syncView.runningSyncRun.stats as Record<string, unknown>)
      : null;
  const lineJob = displayJob ? describeSyncProgressMeta(displayJob.progressMeta, t) : null;
  const lineDb = describeStatsCheckpoint(runningStats, t);
  const workerMaybeMissing = staleWaitingHint && waitingJobId != null;
  const jobActive = displayJob?.state === 'active';
  const pct = Math.min(100, Math.max(0, displayJob?.progress ?? 0));
  const hasRunning = syncView.runningSyncRun != null;
  const detailLine = lineJob ?? lineDb;
  const showPanel = workerMaybeMissing || displayJob != null || hasRunning;

  if (!showPanel) {
    return null;
  }

  const panelShell =
    'space-y-3 rounded-xl border border-blue-200/80 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20';

  return (
    <div className={panelShell}>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t('admin.syncPage.progressTitle')}</h3>
      {workerMaybeMissing ? (
        <p className="text-sm text-amber-800 dark:text-amber-200">{t('admin.syncPage.workerMissingHint')}</p>
      ) : null}
      {displayJob ? (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span className="font-mono">{displayJob.name}</span>
            <span className="uppercase tracking-wide">{redisJobStateLabel(displayJob.state, t, has)}</span>
          </div>
          {jobActive ? (
            <div
              aria-valuemax={100}
              aria-valuemin={0}
              aria-valuenow={Math.round(pct)}
              className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
              role="progressbar"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-[width] duration-300 dark:bg-blue-500"
                style={{ width: `${String(pct)}%` }}
              />
            </div>
          ) : null}
          {!jobActive && displayJob.state === 'waiting' ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">{t('admin.syncPage.jobWaitingHint')}</p>
          ) : null}
          {detailLine ? <p className="text-sm text-gray-800 dark:text-gray-200">{detailLine}</p> : null}
        </div>
      ) : null}
      {!displayJob && hasRunning ? (
        <div className="space-y-2">
          <div
            aria-busy="true"
            aria-label={t('admin.syncPage.syncBusyAria')}
            className="h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700"
            role="progressbar"
          >
            <div className="h-full w-1/3 animate-pulse rounded-full bg-blue-500/70 dark:bg-blue-400/70" />
          </div>
          {detailLine ? (
            <p className="text-sm text-gray-800 dark:text-gray-200">{detailLine}</p>
          ) : (
            <p className={`text-sm ${mutedClass}`}>{t('admin.syncPage.estimatingSync')}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
