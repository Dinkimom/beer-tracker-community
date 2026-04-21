/**
 * initial_full / full_rescan: доски команд, пагинация, чекпоинты в sync_runs.stats, обновление org.
 */

import type { SyncJobMode } from './types';
import type { SyncPlatformEnv } from '@/lib/env';
import type { OrganizationRow } from '@/lib/organizations/types';
import type { ResolvedOrgSyncSettings } from '@/lib/orgSyncSettings';
import type { AxiosInstance } from 'axios';

import { updateOrganization } from '@/lib/organizations';
import {
  extractOrgSyncSettingsJson,
} from '@/lib/orgSyncSettings';
import { upsertIssueSnapshotsForOrg } from '@/lib/snapshots';
import { listTeams } from '@/lib/staffTeams';
import { TRACKER_ISSUES_SEARCH_PER_PAGE_CAP } from '@/lib/trackerApi/issues';

import {
  collectIssuesFullSyncAcrossBoards,
  uniqueBoardIdsFromTeams,
} from './fullOrgBoardScan';
import { runChangelogSyncWithProgress } from './runChangelogSyncWithProgress';
import {
  finishSyncRun,
  mergeSyncRunStats,
  type SyncRunTerminalStatus,
} from './syncRunsRepository';
import { WATERMARK_UNTIL_STATS_KEY } from './watermark';

function computeSyncNextRunAtFromNow(settings: ResolvedOrgSyncSettings): Date {
  return new Date(Date.now() + settings.intervalMinutes * 60_000);
}

function buildSettingsWithSyncPatch(
  root: Record<string, unknown>,
  syncPatch: Record<string, unknown>
): Record<string, unknown> {
  const rawSync = extractOrgSyncSettingsJson(root);
  const syncObj =
    rawSync !== null && typeof rawSync === 'object' && !Array.isArray(rawSync)
      ? { ...(rawSync as Record<string, unknown>) }
      : {};
  return {
    ...root,
    sync: { ...syncObj, ...syncPatch },
  };
}

export async function runFullSyncModes(params: {
  api: AxiosInstance;
  mode: Extract<SyncJobMode, 'full_rescan' | 'initial_full'>;
  onProgress?: (percent: number, meta?: Record<string, unknown>) => Promise<void> | void;
  org: OrganizationRow;
  platform: SyncPlatformEnv;
  settings: ResolvedOrgSyncSettings;
  syncRunId: string;
}): Promise<{ finalStatus: SyncRunTerminalStatus; syncRunId: string }> {
  const { api, mode, onProgress, org, platform, settings, syncRunId } = params;

  const teams = await listTeams(org.id, { activeOnly: true });
  const boardIds = uniqueBoardIdsFromTeams(teams);

  await onProgress?.(12, { boards_total: boardIds.length, phase: 'list_boards' });

  if (boardIds.length === 0) {
    await mergeSyncRunStats(syncRunId, {
      boards_total: 0,
      no_boards: true,
      phase: 'no_boards',
    });
    await finishSyncRun({
      errorSummary:
        'Нет досок для импорта. Добавьте команды с привязкой к доске Яндекс Трекера (tracker_board_id).',
      extraStats: {
        boards_processed: 0,
        boards_total: 0,
        issues_fetched: 0,
        issues_upserted: 0,
        mode,
        no_boards: true,
      },
      status: 'failed',
      syncRunId,
    });
    await onProgress?.(100, { phase: 'failed', reason: 'no_boards' });
    return { finalStatus: 'failed', syncRunId };
  }

  await onProgress?.(18, { boards_total: boardIds.length, phase: 'fetch_start' });

  const perPage = Math.min(settings.maxIssuesPerRun, TRACKER_ISSUES_SEARCH_PER_PAGE_CAP);
  const { boardsProcessed, issues, truncated } =
    await collectIssuesFullSyncAcrossBoards({
      api,
      boardIds,
      maxTotalIssues: platform.fullSyncMaxIssuesPerRun,
      mergeStats: async (patch) => {
        await mergeSyncRunStats(syncRunId, patch);
        const cp = patch.full_sync_checkpoint;
        if (cp != null && typeof cp === 'object' && !Array.isArray(cp)) {
          const c = cp as Record<string, unknown>;
          const boardIndex = Number(c.board_index);
          const boardTotal = Number(c.board_total);
          const page = Number(c.page);
          const totalPages = Math.max(1, Number(c.total_pages));
          const issuesSoFar = Number(patch.issues_total_so_far);
          const boardSpan = 36;
          const boardWeight = boardTotal > 0 ? (boardIndex - 1 + page / totalPages) / boardTotal : 0;
          const pct = Math.min(54, Math.round(18 + boardSpan * boardWeight));
          const meta: Record<string, unknown> = {
            boardId: c.board_id,
            boardIndex,
            boardTotal,
            page,
            phase: 'fetch_boards',
            totalPages,
          };
          if (Number.isFinite(issuesSoFar)) {
            meta.issuesCollected = issuesSoFar;
          }
          await onProgress?.(pct, meta);
        }
      },
      perPage,
    });

  await onProgress?.(58, { boards_done: boardsProcessed, boards_total: boardIds.length, phase: 'upsert_start' });
  const upserted = await upsertIssueSnapshotsForOrg(org.id, issues);
  const changelogKeys = issues
    .map((i) => i.key)
    .filter((k): k is string => typeof k === 'string' && k.length > 0);
  const changelogUpserted = await runChangelogSyncWithProgress({
    api,
    firstProgressExtra: { issues_upserted: upserted },
    issueKeys: changelogKeys,
    onProgress,
    organizationId: org.id,
    percentFrom: 68,
    percentTo: 88,
    syncRunId,
  });
  await onProgress?.(88, {
    changelog_rows_upserted: changelogUpserted,
    issues_upserted: upserted,
    phase: 'upsert_done',
  });

  const until = new Date();
  const terminal: SyncRunTerminalStatus = truncated ? 'partial' : 'success';

  if (mode === 'initial_full' && terminal === 'success' && !truncated) {
    await updateOrganization(org.id, {
      initial_sync_completed_at: until,
      sync_next_run_at: computeSyncNextRunAtFromNow(settings),
    });
  }

  if (mode === 'full_rescan' && terminal === 'success' && !truncated) {
    const newSettings = buildSettingsWithSyncPatch(
      org.settings as Record<string, unknown>,
      { lastFullRescanAt: until.toISOString() }
    );
    await updateOrganization(org.id, {
      ...(org.initial_sync_completed_at == null
        ? { initial_sync_completed_at: until }
        : {}),
      settings: newSettings,
      sync_next_run_at: computeSyncNextRunAtFromNow(settings),
    });
  }

  await finishSyncRun({
    extraStats: {
      [WATERMARK_UNTIL_STATS_KEY]: until.toISOString(),
      boards_processed: boardsProcessed,
      boards_total: boardIds.length,
      changelog_rows_upserted: changelogUpserted,
      issues_fetched: issues.length,
      issues_upserted: upserted,
      mode,
      truncated,
    },
    status: terminal,
    syncRunId,
  });
  await onProgress?.(100);
  return { finalStatus: terminal, syncRunId };
}
