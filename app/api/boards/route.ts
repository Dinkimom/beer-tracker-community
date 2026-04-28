import { NextRequest, NextResponse } from 'next/server';

import { filterTeamsVisibleInPlanner } from '@/lib/access/orgAccess';
import { handleApiError } from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { isOnPremMode } from '@/lib/deploymentMode';
import { listTeams } from '@/lib/staffTeams';
import { fetchTrackerBoardsPaginate } from '@/lib/trackerApi';

/**
 * GET /api/boards
 * Пересечение досок из Tracker (доступ пользователя) и команд организации в PostgreSQL.
 */
export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const { ctx, profile } = tenantResult;
    const { organizationId } = ctx;
    const orgTeamsAll = await listTeams(organizationId, { activeOnly: true });
    const orgTeams = filterTeamsVisibleInPlanner(profile, orgTeamsAll);

    let trackerBoards: Awaited<ReturnType<typeof fetchTrackerBoardsPaginate>> = [];
    try {
      const trackerApi = await getTrackerApiFromRequest(request);
      trackerBoards = await fetchTrackerBoardsPaginate(trackerApi);
    } catch (error) {
      if (!isOnPremMode()) {
        throw error;
      }
      // On-prem may rely on DB-backed team catalog even when Tracker auth is temporarily unavailable.
      trackerBoards = [];
    }
    const accessibleBoardIds = new Set(trackerBoards.map((b) => b.id));
    const boardNameById = new Map(trackerBoards.map((b) => [b.id, b.name]));

    const boards = orgTeams
      .map((team) => {
        const boardNum = Number.parseInt(String(team.tracker_board_id), 10);
        return Number.isFinite(boardNum) ? { team, boardNum } : null;
      })
      .filter(
        (x): x is { boardNum: number; team: (typeof orgTeams)[0] } =>
          x !== null && (trackerBoards.length === 0 || accessibleBoardIds.has(x.boardNum))
      )
      .map(({ team, boardNum }) => ({
        id: boardNum,
        name: boardNameById.get(boardNum) ?? team.title,
        queue: team.tracker_queue_key,
        team: team.slug,
        teamTitle: team.title,
      }));

    return NextResponse.json(boards);
  } catch (error) {
    return handleApiError(error, 'fetch boards (Tracker + PostgreSQL teams)');
  }
}
