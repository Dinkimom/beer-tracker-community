/**
 * Ядро синхронизации организации: sync_runs, инкремент (watermark + overlap), вызов Tracker с серверным токеном.
 */

import type { SyncJobMode } from './types';

import { getSyncPlatformEnv } from '@/lib/env';
import {
  findOrganizationById,
  getDecryptedOrganizationTrackerToken,
} from '@/lib/organizations';
import {
  getLastFullRescanAtFromSettingsRoot,
  parseResolveAndValidateOrgSyncFromSettingsRoot,
} from '@/lib/orgSyncSettings';
import { upsertIssueSnapshotsForOrg } from '@/lib/snapshots';
import {
  fetchIssuesUpdatedInRange,
  TRACKER_ISSUES_SEARCH_PER_PAGE_CAP,
} from '@/lib/trackerApi/issues';
import { createTrackerAxiosInstance } from '@/lib/trackerAxiosFactory';

import { runChangelogSyncWithProgress } from './runChangelogSyncWithProgress';
import { runFullSyncModes } from './runFullSyncModes';
import {
  finishSyncRun,
  getLastIncrementalWatermarkUntil,
  tryBeginSyncRun,
  type SyncRunTerminalStatus,
} from './syncRunsRepository';
import {
  computeIncrementalWindow,
  WATERMARK_UNTIL_STATS_KEY,
} from './watermark';

export type RunOrgSyncSkippedReason =
  | 'concurrent_sync'
  | 'incremental_before_initial'
  | 'invalid_sync_settings'
  | 'missing_tracker_org_id'
  | 'missing_tracker_token'
  | 'sync_disabled';

export type RunOrgSyncResult =
  | { finalStatus: SyncRunTerminalStatus; status: 'ok'; syncRunId: string }
  | { message?: string; reason: RunOrgSyncSkippedReason; status: 'skipped' };

export interface RunOrgSyncInput {
  bullJobId?: string;
  mode: SyncJobMode;
  organizationId: string;
  onProgress?: (percent: number, meta?: Record<string, unknown>) => Promise<void> | void;
}

export async function runOrgSync(input: RunOrgSyncInput): Promise<RunOrgSyncResult> {
  const org = await findOrganizationById(input.organizationId);
  if (!org) {
    throw new Error(`Organization not found: ${input.organizationId}`);
  }

  const platform = getSyncPlatformEnv();
  const validated = parseResolveAndValidateOrgSyncFromSettingsRoot(org.settings, platform);
  if (!validated.ok) {
    return {
      status: 'skipped',
      reason: 'invalid_sync_settings',
      message: validated.message,
    };
  }
  const settings = validated.settings;

  if (input.mode === 'incremental' && !settings.enabled) {
    return { status: 'skipped', reason: 'sync_disabled' };
  }
  if (input.mode === 'incremental' && !org.initial_sync_completed_at) {
    return { status: 'skipped', reason: 'incremental_before_initial' };
  }
  if (!org.tracker_org_id?.trim()) {
    return { status: 'skipped', reason: 'missing_tracker_org_id' };
  }

  let token: string;
  try {
    const t = await getDecryptedOrganizationTrackerToken(org.id);
    if (!t?.trim()) {
      return { status: 'skipped', reason: 'missing_tracker_token' };
    }
    token = t.trim();
  } catch (e) {
    return {
      status: 'skipped',
      reason: 'missing_tracker_token',
      message: e instanceof Error ? e.message : String(e),
    };
  }

  const began = await tryBeginSyncRun({
    initialStats: {
      ...(input.bullJobId != null ? { bull_job_id: input.bullJobId } : {}),
      mode: input.mode,
    },
    jobType: input.mode,
    organizationId: org.id,
  });
  if (!began.ok) {
    return { status: 'skipped', reason: 'concurrent_sync' };
  }

  const syncRunId = began.syncRunId;

  try {
    await input.onProgress?.(10);
    const api = createTrackerAxiosInstance({
      apiUrl: org.tracker_api_base_url?.trim() || undefined,
      oauthToken: token,
      orgId: org.tracker_org_id.trim(),
    });

    if (input.mode === 'incremental') {
      const rescanCutoff = getLastFullRescanAtFromSettingsRoot(org.settings);
      const lastWm = await getLastIncrementalWatermarkUntil(org.id, rescanCutoff);
      const { since, until } = computeIncrementalWindow({
        now: new Date(),
        intervalMinutes: settings.intervalMinutes,
        lastWatermarkUntil: lastWm,
        overlapMinutes: settings.overlapMinutes,
      });

      await input.onProgress?.(25);

      const perPage = Math.min(settings.maxIssuesPerRun, TRACKER_ISSUES_SEARCH_PER_PAGE_CAP);
      const { issues, truncated } = await fetchIssuesUpdatedInRange(
        api,
        since,
        until,
        { maxIssues: settings.maxIssuesPerRun, perPage }
      );

      await input.onProgress?.(70);
      const upserted = await upsertIssueSnapshotsForOrg(org.id, issues);
      const issueKeys = issues
        .map((i) => i.key)
        .filter((k): k is string => typeof k === 'string' && k.length > 0);
      const changelogUpserted = await runChangelogSyncWithProgress({
        api,
        firstProgressExtra: { issues_upserted: upserted },
        issueKeys,
        onProgress: input.onProgress,
        organizationId: org.id,
        percentFrom: 72,
        percentTo: 92,
        syncRunId,
      });
      await input.onProgress?.(95);

      const terminal: SyncRunTerminalStatus = truncated ? 'partial' : 'success';
      await finishSyncRun({
        extraStats: {
          [WATERMARK_UNTIL_STATS_KEY]: until.toISOString(),
          changelog_rows_upserted: changelogUpserted,
          issues_fetched: issues.length,
          issues_upserted: upserted,
          mode: input.mode,
          requested_since: since.toISOString(),
          requested_until: until.toISOString(),
          truncated,
        },
        status: terminal,
        syncRunId,
      });
      await input.onProgress?.(100);
      return { status: 'ok', syncRunId, finalStatus: terminal };
    }

    const { finalStatus } = await runFullSyncModes({
      api,
      mode: input.mode,
      onProgress: input.onProgress,
      org,
      platform,
      settings,
      syncRunId,
    });
    return { status: 'ok', finalStatus, syncRunId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await finishSyncRun({
      errorSummary: msg,
      extraStats: { error: msg },
      status: 'failed',
      syncRunId,
    });
    throw e;
  }
}
