'use client';

import type { AdminSyncStatusPayload } from '@/features/admin/adminSyncTypes';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { useConfirmDialog } from '@/components/ConfirmDialog';
import { useI18n } from '@/contexts/LanguageContext';
import { useAdminOrganizationId } from '@/features/admin/AdminOrganizationIdContext';
import { isAdminSyncStatusPayload } from '@/features/admin/adminSyncTypes';
import { muted } from '@/features/admin/adminUiTokens';
import { AdminSyncSection } from '@/features/admin/components/AdminSyncSection';
import { useAdminTrackerConnectionReady } from '@/features/admin/hooks/useAdminTrackerConnectionReady';

const EXPORTER_ENABLED = process.env.NEXT_PUBLIC_EXPORTER_ENABLED !== 'false';

export default function SyncPage() {
  const { t } = useI18n();
  const { confirm, DialogComponent } = useConfirmDialog();
  const router = useRouter();
  const connectOrgId = useAdminOrganizationId();
  const { loading: trackerGateLoading, ready: trackerReady } =
    useAdminTrackerConnectionReady(connectOrgId);

  const [syncView, setSyncView] = useState<AdminSyncStatusPayload | null>(null);
  const [syncStatusLoading, setSyncStatusLoading] = useState(false);
  const [showSyncRaw, setShowSyncRaw] = useState(false);

  const [settingsDirty, setSettingsDirty] = useState(false);
  const [formEnabled, setFormEnabled] = useState(true);
  const [formIntervalMinutes, setFormIntervalMinutes] = useState('');
  const [formOverlapMinutes, setFormOverlapMinutes] = useState('');
  const [formMaxIssuesPerRun, setFormMaxIssuesPerRun] = useState('');
  const [formWindowStart, setFormWindowStart] = useState('');
  const [formWindowEnd, setFormWindowEnd] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  useEffect(() => {
    if (!syncView || settingsDirty) return;
    const r = syncView.resolvedSync;
    setFormEnabled(r.enabled);
    setFormIntervalMinutes(String(r.intervalMinutes));
    setFormOverlapMinutes(String(r.overlapMinutes));
    setFormMaxIssuesPerRun(String(r.maxIssuesPerRun));
    const w = r.windowUtc;
    setFormWindowStart(w?.start ?? '');
    setFormWindowEnd(w?.end ?? '');
  }, [syncView, settingsDirty]);

  useEffect(() => {
    if (EXPORTER_ENABLED) return;
    router.replace('/admin/teams');
  }, [router]);

  useEffect(() => {
    if (!connectOrgId || trackerGateLoading || trackerReady) return;
    router.replace('/admin/tracker');
  }, [connectOrgId, router, trackerGateLoading, trackerReady]);

  const loadSyncStatus = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!connectOrgId) return;
      const silent = opts?.silent === true;
      if (!silent) {
        setSyncStatusLoading(true);
      }
      try {
        const res = await fetch(`/api/admin/organizations/${connectOrgId}/sync/status`, {
          credentials: 'include',
        });
        const data: unknown = await res.json();
        if (!res.ok) {
          const err = data as { error?: string };
          const msg = err.error ?? t('admin.sync.loadStatusFailed');
          if (!silent) {
            toast.error(msg);
            setSyncView(null);
          }
          return;
        }
        if (!isAdminSyncStatusPayload(data)) {
          const msg = t('admin.sync.invalidStatusResponse');
          if (!silent) {
            toast.error(msg);
            setSyncView(null);
          }
          return;
        }
        setSyncView(data);
      } catch {
        const msg = t('admin.sync.networkStatusError');
        if (!silent) {
          toast.error(msg);
          setSyncView(null);
        }
      } finally {
        if (!silent) setSyncStatusLoading(false);
      }
    },
    [connectOrgId, t]
  );

  useEffect(() => {
    setSyncView(null);
    setSettingsDirty(false);
    if (!connectOrgId || trackerGateLoading || !trackerReady) return;
    void loadSyncStatus({ silent: false });
    const id = setInterval(() => void loadSyncStatus({ silent: true }), 5000);
    return () => clearInterval(id);
  }, [connectOrgId, loadSyncStatus, trackerGateLoading, trackerReady]);

  async function postIncrementalSync() {
    if (!connectOrgId) return;
    try {
      const res = await fetch(`/api/admin/organizations/${connectOrgId}/sync/incremental`, {
        credentials: 'include',
        method: 'POST',
      });
      const data = (await res.json()) as { error?: string; jobId?: string };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.sync.enqueueIncrementalFailed'));
        return;
      }
      toast.success(t('admin.sync.incrementalQueued'));
      await loadSyncStatus({ silent: true });
    } catch {
      toast.error(t('admin.common.networkError'));
    }
  }

  async function postFullRescan() {
    if (!connectOrgId) return;
    const confirmed = await confirm(t('admin.sync.fullRescanConfirm'), {
      confirmText: t('admin.sync.fullRescanRun'),
      title: t('admin.sync.fullRescanTitle'),
      variant: 'destructive',
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/admin/organizations/${connectOrgId}/sync/full-rescan`, {
        body: JSON.stringify({ confirm: true }),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as {
        error?: string;
        jobId?: string;
        retryAfterSeconds?: number;
      };
      if (!res.ok) {
        if (res.status === 429 && data.retryAfterSeconds != null) {
          toast.error(
            t('admin.sync.fullRescanRetry', {
              message: data.error ?? t('admin.sync.cooldownFallback'),
              seconds: String(data.retryAfterSeconds),
            })
          );
        } else {
          toast.error(data.error ?? t('admin.sync.fullRescanEnqueueFailed'));
        }
        return;
      }
      const jobSuffix = data.jobId ? ` (${data.jobId})` : '';
      toast.success(t('admin.sync.fullRescanQueued', { jobSuffix }));
      await loadSyncStatus({ silent: true });
    } catch {
      toast.error(t('admin.common.networkError'));
    }
  }

  async function saveSyncSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!connectOrgId) return;
    const interval = Number.parseInt(formIntervalMinutes, 10);
    const overlap = Number.parseInt(formOverlapMinutes, 10);
    const maxIssues = Number.parseInt(formMaxIssuesPerRun, 10);
    if (!Number.isFinite(interval) || !Number.isFinite(overlap) || !Number.isFinite(maxIssues)) {
      toast.error(t('admin.sync.integersOnlyError'));
      return;
    }
    const body: Record<string, unknown> = {
      enabled: formEnabled,
      intervalMinutes: interval,
      maxIssuesPerRun: maxIssues,
      overlapMinutes: overlap,
    };
    const ws = formWindowStart.trim();
    const we = formWindowEnd.trim();
    if (ws || we) {
      if (!ws || !we) {
        toast.error(t('admin.sync.utcWindowBothOrNeither'));
        return;
      }
      body.windowUtc = { end: we, start: ws };
    }
    setSettingsSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${connectOrgId}/sync/settings`, {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });
      const data = (await res.json()) as { code?: string; error?: string; issues?: unknown };
      if (!res.ok) {
        if (res.status === 422) {
          toast.error(data.error ?? data.code ?? t('admin.sync.platformValidationFailed'));
        } else if (res.status === 400 && data.issues) {
          toast.error(data.error ?? t('admin.sync.invalidFields'));
        } else {
          toast.error(data.error ?? t('admin.sync.saveFailed'));
        }
        return;
      }
      toast.success(t('admin.sync.settingsSaved'));
      setSettingsDirty(false);
      await loadSyncStatus({ silent: true });
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setSettingsSaving(false);
    }
  }

  if (!connectOrgId) {
    return (
      <>
        {DialogComponent}
        <p className={`text-sm ${muted}`}>{t('admin.common.pickOrgForSync')}</p>
      </>
    );
  }

  if (!EXPORTER_ENABLED) {
    return null;
  }

  if (trackerGateLoading || !trackerReady) {
    return (
      <>
        {DialogComponent}
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-2 text-sm text-ds-text-muted">
          {trackerGateLoading
            ? t('admin.common.loading')
            : t('admin.common.redirectingToTrackerSettings')}
        </div>
      </>
    );
  }

  return (
    <>
      {DialogComponent}
      <AdminSyncSection
      connectOrgId={connectOrgId}
      formEnabled={formEnabled}
      formIntervalMinutes={formIntervalMinutes}
      formMaxIssuesPerRun={formMaxIssuesPerRun}
      formOverlapMinutes={formOverlapMinutes}
      formWindowEnd={formWindowEnd}
      formWindowStart={formWindowStart}
      settingsSaving={settingsSaving}
      showSyncRaw={showSyncRaw}
      syncStatusLoading={syncStatusLoading}
      syncView={syncView}
      onFormEnabledChange={(v) => {
        setSettingsDirty(true);
        setFormEnabled(v);
      }}
      onFormIntervalChange={(v) => {
        setSettingsDirty(true);
        setFormIntervalMinutes(v);
      }}
      onFormMaxIssuesChange={(v) => {
        setSettingsDirty(true);
        setFormMaxIssuesPerRun(v);
      }}
      onFormOverlapChange={(v) => {
        setSettingsDirty(true);
        setFormOverlapMinutes(v);
      }}
      onFormWindowEndChange={(v) => {
        setSettingsDirty(true);
        setFormWindowEnd(v);
      }}
      onFormWindowStartChange={(v) => {
        setSettingsDirty(true);
        setFormWindowStart(v);
      }}
      onFullRescan={() => void postFullRescan()}
      onIncrementalSync={() => void postIncrementalSync()}
      onRefreshStatus={() => void loadSyncStatus({ silent: false })}
      onSaveSettings={(e) => void saveSyncSettings(e)}
      onShowSyncRawChange={setShowSyncRaw}
    />
    </>
  );
}
