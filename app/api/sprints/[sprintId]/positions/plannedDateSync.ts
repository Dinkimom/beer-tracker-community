import type { PhaseSegment } from '@/types';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import {
  getPlannedCellRangeDateRange,
  getPlannedPositionCellRange,
} from '@/lib/planner-timeline';
import { buildSyntheticQaTaskId } from '@/lib/qaTaskIdentity';
import { fetchSprintInfo } from '@/lib/trackerApi';
import { resolveSprintTimelineWorkingDaysCount } from '@/utils/dateUtils';

export interface PlannedDateSyncPosition {
  devTaskKey?: string;
  duration: number;
  isQa?: boolean | null;
  plannedDuration?: number | null;
  plannedStartDay?: number | null;
  plannedStartPart?: number | null;
  segments?: PhaseSegment[] | null;
  taskId: string;
}

interface PersistedPosition {
  duration: number;
  plannedDuration?: number | null;
  plannedStartDay?: number | null;
  plannedStartPart?: number | null;
  segments?: PhaseSegment[];
  taskId: string;
}

function toIsoDateOnlyLocal(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addGroupTaskId(groups: Map<string, Set<string>>, issueKey: string, taskId: string): void {
  const group = groups.get(issueKey) ?? new Set<string>();
  group.add(taskId);
  groups.set(issueKey, group);
}

function buildIssueTaskGroups(positions: PlannedDateSyncPosition[]): Map<string, Set<string>> {
  const groups = new Map<string, Set<string>>();

  positions.forEach((position) => {
    if (!getPlannedPositionCellRange(position)) return;

    const isSyntheticQa = position.isQa && position.devTaskKey;
    const issueKey = isSyntheticQa ? position.devTaskKey! : position.taskId;

    addGroupTaskId(groups, issueKey, position.taskId);

    if (isSyntheticQa) {
      addGroupTaskId(groups, issueKey, issueKey);
    } else if (!position.isQa) {
      addGroupTaskId(groups, issueKey, buildSyntheticQaTaskId(issueKey));
    }
  });

  return groups;
}

async function loadPersistedPositions(
  organizationId: number | string,
  sprintId: number,
  taskIds: string[]
): Promise<Map<string, PersistedPosition>> {
  if (taskIds.length === 0) return new Map();

  const onPrem = isOnPremMode();
  const firstTaskParamIndex = onPrem ? 2 : 3;
  const placeholders = taskIds.map((_, i) => `$${i + firstTaskParamIndex}`).join(', ');
  const scopeSql = onPrem
    ? `sprint_id = $1 AND task_id IN (${placeholders})`
    : `organization_id = $1 AND sprint_id = $2 AND task_id IN (${placeholders})`;
  const params = onPrem ? [sprintId, ...taskIds] : [organizationId, sprintId, ...taskIds];

  const positionsResult = await query(
    `SELECT task_id, duration, planned_start_day, planned_start_part, planned_duration
     FROM task_positions
     WHERE ${scopeSql}`,
    params
  );

  const positions = new Map<string, PersistedPosition>();
  for (const row of positionsResult.rows as Array<{
    duration: number;
    planned_duration: number | null;
    planned_start_day: number | null;
    planned_start_part: number | null;
    task_id: string;
  }>) {
    positions.set(row.task_id, {
      duration: row.duration,
      plannedDuration: row.planned_duration,
      plannedStartDay: row.planned_start_day,
      plannedStartPart: row.planned_start_part,
      taskId: row.task_id,
    });
  }

  if (positions.size === 0) return positions;

  const segmentsResult = await query(
    `SELECT task_id, start_day, start_part, duration
     FROM task_position_segments
     WHERE ${scopeSql}
     ORDER BY task_id, segment_index`,
    params
  );

  for (const row of segmentsResult.rows as Array<{
    duration: number;
    start_day: number;
    start_part: number;
    task_id: string;
  }>) {
    const position = positions.get(row.task_id);
    if (!position) continue;
    position.segments = [
      ...(position.segments ?? []),
      { duration: row.duration, startDay: row.start_day, startPart: row.start_part },
    ];
  }

  return positions;
}

export async function syncPlannedDatesToTracker({
  organizationId,
  positions,
  request,
  sprintId,
}: {
  organizationId: number | string;
  positions: PlannedDateSyncPosition[];
  request: Request;
  sprintId: number;
}): Promise<void> {
  const groups = buildIssueTaskGroups(positions);
  if (groups.size === 0) return;

  const relatedTaskIds = Array.from(new Set(Array.from(groups.values()).flatMap((ids) => [...ids])));
  const persistedPositions = await loadPersistedPositions(organizationId, sprintId, relatedTaskIds);
  const trackerApi = await getTrackerApiFromRequest(request);
  const sprintInfo = await fetchSprintInfo(sprintId, trackerApi);
  const sprintStartDate = new Date(sprintInfo.startDate);
  sprintStartDate.setHours(0, 0, 0, 0);
  const workingDaysCount = resolveSprintTimelineWorkingDaysCount(
    sprintInfo.startDate,
    sprintInfo.endDate,
    10
  );

  await Promise.all(
    Array.from(groups.entries()).map(async ([issueKey, taskIds]) => {
      const ranges = Array.from(taskIds)
        .map((taskId) => persistedPositions.get(taskId))
        .filter((position): position is PersistedPosition => position != null)
        .map(getPlannedPositionCellRange)
        .filter((range): range is { endCell: number; startCell: number } => range != null);

      if (ranges.length === 0) return;

      const dateRange = getPlannedCellRangeDateRange(
        {
          endCell: Math.max(...ranges.map((range) => range.endCell)),
          startCell: Math.min(...ranges.map((range) => range.startCell)),
        },
        sprintStartDate,
        workingDaysCount
      );

      if (!dateRange) return;

      const start = toIsoDateOnlyLocal(dateRange.startDate);
      const deadline = toIsoDateOnlyLocal(dateRange.endDate);
      try {
        await trackerApi.patch(`/issues/${issueKey}`, { deadline, start });
      } catch {
        await trackerApi.patch(`/issues/${issueKey}`, { deadline });
      }
    })
  );
}
