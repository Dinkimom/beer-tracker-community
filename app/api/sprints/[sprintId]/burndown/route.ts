import type { BurndownDayChangelogItem } from '@/lib/api/types';
import type { TrackerIssue } from '@/types/tracker';

import { NextRequest, NextResponse } from 'next/server';

import {
  TRACKER_UPSTREAM_FORWARD_STATUSES,
  handleApiError,
} from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import {
  computeBurndownFromChangelog,
  computeSprintTimelineTotals,
  type BurndownDataPoint,
  type SprintTimelineTotals,
} from '@/lib/burndown/computeBurndownFromChangelog';
import { mergeTrackerIssuesByKey } from '@/lib/burndown/mergeTrackerIssuesByKey';
import { apiCache, cacheKeys } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';
import { queryIssueSnapshotsMatchingSprint } from '@/lib/snapshots';
import { getTeamByBoardId } from '@/lib/staffTeams';
import {
  fetchBurndownIssuesFromTrackerApi,
  fetchSprintInfo as fetchSprintInfoFromTracker,
  fetchTrackerIssues as fetchTrackerIssuesFromTracker,
} from '@/lib/trackerApi';
import { loadTrackerIntegrationForOrganization } from '@/lib/trackerIntegration';

function isRealTask(issue: TrackerIssue): boolean {
  const team = (issue.functionalTeam ?? '').toLowerCase();
  return !team.includes('qa') && !team.includes('tester');
}

const BURNDOWN_CACHE_TTL_ACTIVE = 10 * 60;
const BURNDOWN_CACHE_TTL_ARCHIVED = 60 * 60;

interface BurndownResponse {
  currentSP: number;
  currentTP: number;
  dailyChangelog: Record<string, BurndownDayChangelogItem[]>;
  dataPoints: BurndownDataPoint[];
  initialSP: number;
  initialTP: number;
  sprintInfo: {
    endDate: string;
    name: string;
    startDate: string;
  };
  sprintTimelineTotals: SprintTimelineTotals;
  testingFlowMode: 'embedded_in_dev' | 'standalone_qa_tasks' | 'unknown';
}

interface SprintIssuesBundle {
  issues: TrackerIssue[];
  sprintInfo: Awaited<ReturnType<typeof fetchSprintInfoFromTracker>>;
}

/**
 * Спринт — из Tracker. Задачи — объединение Tracker + issue_snapshots по ключу
 * (снимки с совпадением спринта в payload; при boardId — фильтр по functionalTeam = title команды в PG).
 */
async function loadSprintInfoAndIssues(
  request: NextRequest,
  organizationId: string,
  sprintIdNum: number,
  boardId: number | undefined
): Promise<SprintIssuesBundle> {
  const trackerApi = await getTrackerApiFromRequest(request);
  const sprintInfo = await fetchSprintInfoFromTracker(sprintIdNum, trackerApi);

  let functionalTeamExact: string | null = null;
  if (boardId != null) {
    const teamRow = await getTeamByBoardId(organizationId, boardId);
    functionalTeamExact = teamRow?.title?.trim() || null;
  }

  const [fromTracker, fromSnapshots] = await Promise.all([
    fetchTrackerIssuesFromTracker(sprintIdNum, trackerApi),
    queryIssueSnapshotsMatchingSprint(organizationId, {
      functionalTeamExact,
      sprintId: sprintInfo.id != null ? String(sprintInfo.id) : null,
      sprintName: sprintInfo.name,
    }),
  ]);
  const issues = mergeTrackerIssuesByKey(fromTracker, fromSnapshots);
  return { issues, sprintInfo };
}

async function computeBurndownPayload(
  request: NextRequest,
  organizationId: string,
  sprintIdNum: number,
  boardId: number | undefined
): Promise<
  { cacheTTL: number; response: BurndownResponse } | { response: BurndownResponse; skipCache: true }
> {
  const integration = await loadTrackerIntegrationForOrganization(organizationId);
  const testingFlowMode =
    integration?.testingFlow?.mode === 'standalone_qa_tasks'
      ? 'standalone_qa_tasks'
      : integration
        ? 'embedded_in_dev'
        : 'unknown';

  const { sprintInfo, issues } = await loadSprintInfoAndIssues(
    request,
    organizationId,
    sprintIdNum,
    boardId
  );

  const isArchived =
    sprintInfo.status === 'archived' || sprintInfo.status === 'released';
  const cacheTTL = isArchived ? BURNDOWN_CACHE_TTL_ARCHIVED : BURNDOWN_CACHE_TTL_ACTIVE;

  const sprintIssueKeys = issues.filter(isRealTask).map((i) => i.key);
  if (sprintIssueKeys.length === 0) {
    const startDate = new Date(sprintInfo.startDateTime);
    const endDate = new Date(sprintInfo.endDateTime);
    const emptyDataPoints: BurndownDataPoint[] = [];
    for (const d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const cur = new Date(d);
      emptyDataPoints.push({
        dateKey: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`,
        date: new Date(cur.getFullYear(), cur.getMonth(), cur.getDate()).toISOString(),
        remainingSP: 0,
        remainingTP: 0,
      });
    }
    const emptyTotals: SprintTimelineTotals = {
      doneSP: 0,
      doneTP: 0,
      remainingSP: 0,
      remainingTP: 0,
      totalSP: 0,
      totalTP: 0,
    };
    return {
      response: {
        currentSP: 0,
        currentTP: 0,
        dailyChangelog: {},
        dataPoints: emptyDataPoints,
        initialSP: 0,
        initialTP: 0,
        testingFlowMode,
        sprintInfo: {
          endDate: sprintInfo.endDate,
          name: sprintInfo.name,
          startDate: sprintInfo.startDate,
        },
        sprintTimelineTotals: emptyTotals,
      },
      skipCache: true,
    };
  }

  const sprintName = sprintInfo.name;
  const sprintIdForMatch = sprintInfo.id != null ? String(sprintInfo.id) : undefined;

  const trackerApi = await getTrackerApiFromRequest(request);
  const issueByKey = new Map(issues.map((i) => [i.key, i]));
  const ytrackerIssues = await fetchBurndownIssuesFromTrackerApi(
    sprintIssueKeys,
    {
      sprintId: sprintIdForMatch,
      sprintName,
    },
    issueByKey,
    trackerApi
  );

  const sprintStartTime = new Date(sprintInfo.startDateTime).getTime();
  const sprintEndTime = new Date(sprintInfo.endDateTime).getTime();

  const issueSummaries = new Map<string, string>();
  for (const issue of issues) {
    issueSummaries.set(issue.key, issue.summary ?? issue.key);
  }

  const startDate = new Date(sprintInfo.startDateTime);
  const endDate = new Date(sprintInfo.endDateTime);

  const computed = computeBurndownFromChangelog({
    issueSummaries,
    sprintEndDate: endDate,
    sprintEndTime,
    sprintIdForMatch,
    sprintName,
    sprintStartDate: startDate,
    sprintStartTime,
    ytrackerIssues,
  });

  const sprintTimelineTotals = computeSprintTimelineTotals(ytrackerIssues, {
    sprintId: sprintIdForMatch,
    sprintName,
    sprintStartTime,
    windowEndMs: sprintEndTime,
    windowStartMs: sprintStartTime,
  });

  const response: BurndownResponse = {
    currentSP: computed.currentSP,
    currentTP: computed.currentTP,
    dailyChangelog: computed.dailyChangelog,
    dataPoints: computed.dataPoints,
    initialSP: computed.initialSP,
    initialTP: computed.initialTP,
    testingFlowMode,
    sprintInfo: {
      endDate: sprintInfo.endDate,
      name: sprintInfo.name,
      startDate: sprintInfo.startDate,
    },
    sprintTimelineTotals,
  };

  return { cacheTTL, response };
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

    const { sprintId } = await resolveParams(params);

    if (!sprintId) {
      return NextResponse.json(
        { error: 'sprintId is required' },
        { status: 400 }
      );
    }

    const sprintIdNum = parseInt(sprintId, 10);

    if (isNaN(sprintIdNum)) {
      return NextResponse.json(
        { error: 'sprintId must be a valid number' },
        { status: 400 }
      );
    }

    const boardIdParam = request.nextUrl.searchParams.get('boardId');
    const boardId = boardIdParam ? parseInt(boardIdParam, 10) : undefined;

    const cacheKey = cacheKeys.burndownFromPg(organizationId, sprintIdNum, boardId);
    const cachedData = apiCache.get<BurndownResponse>(cacheKey);

    if (
      cachedData &&
      'dailyChangelog' in cachedData &&
      typeof cachedData.dailyChangelog === 'object' &&
      cachedData.sprintTimelineTotals != null
    ) {
      return NextResponse.json(cachedData);
    }

    const computed = await computeBurndownPayload(
      request,
      organizationId,
      sprintIdNum,
      boardId
    );
    if ('cacheTTL' in computed) {
      apiCache.set(cacheKey, computed.response, computed.cacheTTL);
    }
    return NextResponse.json(computed.response);
  } catch (error) {
    return handleApiError(error, 'calculate burndown data', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
