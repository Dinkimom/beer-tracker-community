/**
 * Полная выгрузка снимков по доскам команд org (initial_full / full_rescan).
 */

import type { TeamRow } from '@/lib/staffTeams/types';
import type { TrackerIssue } from '@/types/tracker';
import type { AxiosInstance } from 'axios';

import { fetchAllIssuesOnBoard } from '@/lib/trackerApi/issues';

export interface FullBoardScanResult {
  boardsProcessed: number;
  issues: TrackerIssue[];
  truncated: boolean;
}

export function uniqueBoardIdsFromTeams(teams: TeamRow[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const t of teams) {
    const n = Number.parseInt(String(t.tracker_board_id), 10);
    if (!Number.isFinite(n) || seen.has(n)) {
      continue;
    }
    seen.add(n);
    out.push(n);
  }
  return out;
}

export async function collectIssuesFullSyncAcrossBoards(params: {
  api: AxiosInstance;
  boardIds: number[];
  maxTotalIssues: number;
  mergeStats?: (patch: Record<string, unknown>) => Promise<void>;
  perPage: number;
}): Promise<FullBoardScanResult> {
  if (params.boardIds.length === 0) {
    return { boardsProcessed: 0, issues: [], truncated: false };
  }

  const byKey = new Map<string, TrackerIssue>();
  const boardTotal = params.boardIds.length;

  for (let i = 0; i < params.boardIds.length; i++) {
    const boardId = params.boardIds[i]!;
    const remaining = params.maxTotalIssues - byKey.size;
    const { issues, truncated: boardTruncated } = await fetchAllIssuesOnBoard(
      boardId,
      params.api,
      {
        maxTotalIssues: remaining,
        onCheckpoint: async (c) => {
          await params.mergeStats?.({
            full_sync_checkpoint: {
              board_id: boardId,
              board_index: i + 1,
              board_total: boardTotal,
              page: c.page,
              total_pages: c.totalPages,
            },
            issues_total_so_far: byKey.size + c.totalIssues,
          });
        },
        perPage: params.perPage,
      }
    );

    for (const issue of issues) {
      byKey.set(issue.key, issue);
    }

    if (boardTruncated || byKey.size >= params.maxTotalIssues) {
      await params.mergeStats?.({
        full_sync_stopped: true,
        issues_total_so_far: byKey.size,
      });
      return {
        boardsProcessed: i + 1,
        issues: [...byKey.values()],
        truncated: true,
      };
    }
  }

  return {
    boardsProcessed: boardTotal,
    issues: [...byKey.values()],
    truncated: false,
  };
}
