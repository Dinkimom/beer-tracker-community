'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { useAdminOrganizationId } from '@/features/admin/AdminOrganizationIdContext';
import { muted, tabBtnBase, tabBtnIdle } from '@/features/admin/adminUiTokens';
import { AdminTrackerIntegrationSection } from '@/features/admin/components/AdminTrackerIntegrationSection';
import { AdminTrackerSection } from '@/features/admin/components/AdminTrackerSection';
import { notifyAdminTrackerConnectionChanged } from '@/features/admin/hooks/useAdminTrackerConnectionReady';

type TrackerAdminTabId = 'connection' | 'integration';

function tabFromSearchParams(tabParam: string | null): TrackerAdminTabId {
  return tabParam === 'integration' ? 'integration' : 'connection';
}

export default function TrackerPage() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const connectOrgId = useAdminOrganizationId();
  const activeTab = tabFromSearchParams(searchParams.get('tab'));

  const setActiveTab = useCallback(
    (tab: TrackerAdminTabId) => {
      const p = new URLSearchParams(searchParams.toString());
      if (tab === 'integration') {
        p.set('tab', 'integration');
      } else {
        p.delete('tab');
      }
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const [trackerOrgId, setTrackerOrgId] = useState('');
  const [trackerToken, setTrackerToken] = useState('');
  const [trackerHasStoredToken, setTrackerHasStoredToken] = useState(false);
  const [trackerTokenEditOpen, setTrackerTokenEditOpen] = useState(false);
  const [trackerVerifyLoading, setTrackerVerifyLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [trackerFormHydrated, setTrackerFormHydrated] = useState(false);

  const loadTrackerForm = useCallback(async () => {
    if (!connectOrgId) {
      setTrackerFormHydrated(false);
      return;
    }
    setTrackerFormHydrated(false);
    try {
      const res = await fetch(`/api/admin/organizations/${connectOrgId}/tracker`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        hasStoredToken?: boolean;
        trackerOrgId?: string;
      };
      setTrackerOrgId(data.trackerOrgId ?? '');
      setTrackerHasStoredToken(data.hasStoredToken === true);
    } catch {
      /* ignore */
    } finally {
      setTrackerFormHydrated(true);
    }
  }, [connectOrgId]);

  useEffect(() => {
    setTrackerToken('');
    setTrackerTokenEditOpen(false);
    void loadTrackerForm();
  }, [loadTrackerForm]);

  const trackerIntegrationUnlocked =
    trackerFormHydrated && trackerHasStoredToken && trackerOrgId.trim() !== '';

  const tabSearchParam = searchParams.get('tab');

  useEffect(() => {
    if (!connectOrgId) {
      if (tabSearchParam === 'integration') {
        setActiveTab('connection');
      }
      return;
    }
    if (trackerFormHydrated && activeTab === 'integration' && !trackerIntegrationUnlocked) {
      setActiveTab('connection');
    }
  }, [
    activeTab,
    connectOrgId,
    setActiveTab,
    tabSearchParam,
    trackerFormHydrated,
    trackerIntegrationUnlocked,
  ]);

  async function verifyTrackerToken() {
    if (!connectOrgId) return;
    setTrackerVerifyLoading(true);
    try {
      const body: { oauthToken?: string; trackerOrgId?: string } = {};
      if (trackerOrgId.trim()) body.trackerOrgId = trackerOrgId.trim();
      if (trackerToken.trim()) body.oauthToken = trackerToken.trim();

      const res = await fetch(`/api/admin/organizations/${connectOrgId}/tracker/verify`, {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as { error?: string; message?: string; ok?: boolean };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.tracker.verifyFailed'));
        return;
      }
      toast.success(
        data.message ?? t('admin.tracker.tokenVerifiedMessage')
      );
    } catch {
      toast.error(t('admin.common.networkErrorOnVerify'));
    } finally {
      setTrackerVerifyLoading(false);
    }
  }

  async function connectTracker(e: React.FormEvent) {
    e.preventDefault();
    if (!connectOrgId) {
      toast.error(t('admin.common.selectOrganization'));
      return;
    }
    const needNewTokenEntry = !trackerHasStoredToken || trackerTokenEditOpen;
    if (needNewTokenEntry && !trackerToken.trim()) {
      toast.error(
        trackerTokenEditOpen
          ? t('admin.tracker.tokenPromptEdit')
          : t('admin.tracker.tokenPromptFirst')
      );
      return;
    }
    setConnectLoading(true);
    try {
      const body: Record<string, unknown> = { trackerOrgId };
      if (trackerToken.trim()) {
        body.oauthToken = trackerToken;
      }
      const res = await fetch(`/api/admin/organizations/${connectOrgId}/tracker`, {
        body: JSON.stringify(body),
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });
      const data = (await res.json()) as {
        error?: string;
        success?: boolean;
        syncJobEnqueued?: boolean;
        syncJobWarning?: string;
        unchanged?: boolean;
      };
      if (!res.ok) {
        toast.error(data.error ?? t('admin.tracker.connectFailed'));
        return;
      }
      if (data.unchanged) {
        toast.success(t('admin.tracker.noChangesSaved'));
      } else {
        const parts: string[] = [];
        if (trackerToken.trim()) {
          parts.push(t('admin.tracker.tokenSaved'));
        } else {
          parts.push(t('admin.tracker.settingsUpdated'));
        }
        if (data.syncJobEnqueued) parts.push(t('admin.tracker.primaryImportQueued'));
        if (data.syncJobWarning) parts.push(data.syncJobWarning);
        toast.success(parts.join(' '));
      }
      if (trackerToken.trim()) setTrackerToken('');
      setTrackerTokenEditOpen(false);
      void loadTrackerForm();
      notifyAdminTrackerConnectionChanged(connectOrgId);
      router.refresh();
    } catch {
      toast.error(t('admin.common.networkError'));
    } finally {
      setConnectLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {connectOrgId ? (
        <div
          aria-label={t('admin.tracker.tablistAria')}
          className="inline-flex flex-wrap gap-1.5 rounded-lg bg-gray-100 p-1.5 dark:bg-gray-900/60"
          role="tablist"
        >
          <Button
            aria-controls="tracker-panel-connection"
            aria-selected={activeTab === 'connection'}
            className={`${tabBtnBase} !flex !min-h-0 !justify-center !px-3 !py-2 ${
              activeTab === 'connection'
                ? '!border-gray-200 !bg-white !text-gray-900 dark:!border-gray-600 dark:!bg-gray-800 dark:!text-gray-100'
                : `${tabBtnIdle} hover:!bg-gray-200/60 hover:!text-gray-900 dark:hover:!bg-gray-800 dark:hover:!text-gray-100`
            }`}
            id="tracker-tab-connection"
            role="tab"
            type="button"
            variant="ghost"
            onClick={() => setActiveTab('connection')}
          >
            {t('admin.tracker.tabConnection')}
          </Button>
          <Button
            aria-controls="tracker-panel-integration"
            aria-selected={activeTab === 'integration'}
            className={`${tabBtnBase} !flex !min-h-0 !justify-center !gap-2 !px-3 !py-2 ${
              activeTab === 'integration'
                ? '!border-gray-200 !bg-white !text-gray-900 dark:!border-gray-600 dark:!bg-gray-800 dark:!text-gray-100'
                : `${tabBtnIdle} hover:!bg-gray-200/60 hover:!text-gray-900 dark:hover:!bg-gray-800 dark:hover:!text-gray-100`
            }`}
            disabled={!trackerIntegrationUnlocked}
            id="tracker-tab-integration"
            role="tab"
            title={
              trackerIntegrationUnlocked
                ? t('admin.tracker.integrationTabTitleUnlocked')
                : t('admin.tracker.integrationLockedHint')
            }
            type="button"
            variant="ghost"
            onClick={() => {
              if (trackerIntegrationUnlocked) setActiveTab('integration');
            }}
          >
            {t('admin.tracker.tabIntegration')}
            {!trackerIntegrationUnlocked ? (
              <Icon className="h-4 w-4 shrink-0" name="lock" />
            ) : null}
          </Button>
        </div>
      ) : (
        <p className={`text-sm ${muted}`}>{t('admin.common.pickOrgForTracker')}</p>
      )}

      <div
        aria-labelledby="tracker-tab-connection"
        hidden={Boolean(connectOrgId) && activeTab !== 'connection'}
        id="tracker-panel-connection"
        role="tabpanel"
      >
        <AdminTrackerSection
          aria-labelledby="tracker-tab-connection"
          connectLoading={connectLoading}
          connectOrgId={connectOrgId}
          trackerHasStoredToken={trackerHasStoredToken}
          trackerOrgId={trackerOrgId}
          trackerToken={trackerToken}
          trackerTokenEditOpen={trackerTokenEditOpen}
          trackerVerifyLoading={trackerVerifyLoading}
          onSubmit={(e) => void connectTracker(e)}
          onTokenEditCancel={() => {
            setTrackerTokenEditOpen(false);
            setTrackerToken('');
          }}
          onTokenEditOpen={() => {
            setTrackerTokenEditOpen(true);
            setTrackerToken('');
          }}
          onTrackerOrgIdChange={setTrackerOrgId}
          onTrackerTokenChange={setTrackerToken}
          onVerify={() => void verifyTrackerToken()}
        />
      </div>

      {connectOrgId && trackerIntegrationUnlocked ? (
        <div
          aria-labelledby="tracker-tab-integration"
          hidden={activeTab !== 'integration'}
          id="tracker-panel-integration"
          role="tabpanel"
        >
          <AdminTrackerIntegrationSection organizationId={connectOrgId} />
        </div>
      ) : null}
    </div>
  );
}
