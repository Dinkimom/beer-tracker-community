import { NextRequest, NextResponse } from 'next/server';

import {
  TRACKER_UPSTREAM_FORWARD_STATUSES,
  handleApiError,
} from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveParams } from '@/lib/nextjs-utils';
import {
  aggregateSprintScorePoints,
  queryIssueSnapshotsMatchingSprint,
} from '@/lib/snapshots';
import { fetchSprintInfo } from '@/lib/trackerApi';
import { loadTrackerIntegrationForOrganization } from '@/lib/trackerIntegration';

export interface SprintScoreRow {
  goals_done: number;
  goals_percent: number;
  goals_total: number;
  mark: number;
  mark_emoji: string;
  mark_goals: number;
  mark_sp: number;
  mark_tp: number;
  qa_done: number;
  qa_left: number;
  qa_total: number;
  sname: string;
  sp_done: number;
  sp_done_percent: number;
  sp_drop: number;
  sp_left: number;
  sp_total: number;
  sprint_id: number;
  team: string;
  tp_done_percent: number;
  tp_drop: number;
}

interface PgGoalsAggRow {
  goals_done: number;
  goals_total: number;
  team: string;
}

export interface SprintScoreResponse {
  rows: SprintScoreRow[];
  testingFlowMode: 'embedded_in_dev' | 'standalone_qa_tasks' | 'unknown';
}

function n(v: number | null | undefined): number {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function queryIssueSnapshotsMatchingSprintSafe(
  organizationId: string,
  args: { sprintId: string; sprintName: string }
) {
  try {
    return await queryIssueSnapshotsMatchingSprint(organizationId, args);
  } catch {
    return [];
  }
}

function buildScoreRow(
  sprintId: number,
  sname: string,
  team: string,
  goalsTotal: number,
  goalsDone: number,
  spLeft: number,
  spDone: number,
  qaLeft: number,
  qaDone: number
): SprintScoreRow {
  const spTotal = spLeft + spDone;
  const qaTotal = qaLeft + qaDone;
  const goalsPercent = goalsTotal > 0 ? Math.round((100 * goalsDone) / goalsTotal) : 0;
  const spDrop = spTotal > 0 ? Math.round((100 * spLeft) / spTotal) : 0;
  const tpDrop = qaTotal > 0 ? Math.round((100 * qaLeft) / qaTotal) : 0;
  const spDonePercent = spTotal > 0 ? Math.round((100 * spDone) / spTotal) : 0;
  const tpDonePercent = qaTotal > 0 ? Math.round((100 * qaDone) / qaTotal) : 0;

  const markGoals = goalsPercent >= 60 ? 2 : goalsPercent >= 30 ? 1 : 0;
  const markSp = spDrop > 30 ? 0 : spDrop > 20 ? 1 : 2;
  const markTp = tpDrop > 30 ? 0 : tpDrop > 20 ? 1 : 2;
  const mark = markGoals + markSp + markTp;
  const markEmoji = mark > 4 ? '🟢' : mark > 2 ? '🟡' : '🔴';

  return {
    goals_done: goalsDone,
    goals_percent: goalsPercent,
    goals_total: goalsTotal,
    mark,
    mark_emoji: markEmoji,
    mark_goals: markGoals,
    mark_sp: markSp,
    mark_tp: markTp,
    qa_done: qaDone,
    qa_left: qaLeft,
    qa_total: qaTotal,
    sname,
    sp_done: spDone,
    sp_done_percent: spDonePercent,
    sp_drop: spDrop,
    sp_left: spLeft,
    sp_total: spTotal,
    sprint_id: sprintId,
    team,
    tp_done_percent: tpDonePercent,
    tp_drop: tpDrop,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> | { sprintId: string } }
) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;
    const onPrem = isOnPremMode();

    const { sprintId } = await resolveParams(params);

    if (!sprintId) {
      return NextResponse.json({ error: 'sprintId is required' }, { status: 400 });
    }

    const sprintIdNum = parseInt(sprintId, 10);
    if (isNaN(sprintIdNum)) {
      return NextResponse.json({ error: 'sprintId must be a valid number' }, { status: 400 });
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const [sprintInfo, integration] = await Promise.all([
      fetchSprintInfo(sprintIdNum, trackerApi),
      loadTrackerIntegrationForOrganization(organizationId),
    ]);
    const testingFlowMode =
      integration?.testingFlow?.mode === 'standalone_qa_tasks'
        ? 'standalone_qa_tasks'
        : integration
          ? 'embedded_in_dev'
          : 'unknown';

    const goalsSql = `
      SELECT
        COALESCE(NULLIF(TRIM(BOTH FROM team), ''), goal_type::text) AS team,
        COUNT(*)::int AS goals_total,
        COALESCE(SUM(CASE WHEN done THEN 1 ELSE 0 END), 0)::int AS goals_done
      FROM sprint_goals
      WHERE ${onPrem ? 'sprint_id = $1' : 'organization_id = $1 AND sprint_id = $2'}
      GROUP BY COALESCE(NULLIF(TRIM(BOTH FROM team), ''), goal_type::text)
      ORDER BY 1 ASC
    `;

    const [pgResult, snapshotIssues] = await Promise.all([
      query(goalsSql, onPrem ? [sprintIdNum] : [organizationId, sprintIdNum]),
      queryIssueSnapshotsMatchingSprintSafe(organizationId, {
        sprintId: String(sprintIdNum),
        sprintName: sprintInfo.name ?? '',
      }),
    ]);

    const { qa_done: qaDone, qa_left: qaLeft, sp_done: spDone, sp_left: spLeft } =
      aggregateSprintScorePoints(snapshotIssues);

    const sname = sprintInfo.name ?? '';
    const pgGoals = pgResult.rows as PgGoalsAggRow[];

    let rows: SprintScoreRow[];
    if (pgGoals.length === 0) {
      rows = [
        buildScoreRow(sprintIdNum, sname, '', 0, 0, spLeft, spDone, qaLeft, qaDone),
      ];
    } else {
      rows = pgGoals.map((g) =>
        buildScoreRow(
          sprintIdNum,
          sname,
          g.team ?? '',
          n(g.goals_total),
          n(g.goals_done),
          spLeft,
          spDone,
          qaLeft,
          qaDone
        )
      );
    }

    rows.sort((a, b) => b.mark - a.mark || a.sname.localeCompare(b.sname, 'ru'));

    return NextResponse.json({ rows, testingFlowMode } satisfies SprintScoreResponse);
  } catch (error) {
    return handleApiError(error, 'fetch sprint score', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
