import { NextRequest, NextResponse } from 'next/server';

import { TRACKER_UPSTREAM_FORWARD_STATUSES, handleApiError } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { fetchTasksInSprintWithParents } from '@/lib/trackerApi';

/**
 * GET /api/sprints/batch/task-parents?sprintIds=1,2,3
 * Возвращает маппинг taskId → parentKey (story key) для всех задач в указанных спринтах.
 * Используется для отображения «запланировано в спринт» без N запросов по стори/эпикам.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sprintIdsStr = searchParams.get('sprintIds');
    if (!sprintIdsStr) {
      return NextResponse.json(
        { error: 'sprintIds is required (comma-separated)' },
        { status: 400 }
      );
    }
    const sprintIds = sprintIdsStr
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n));
    if (sprintIds.length === 0) {
      return NextResponse.json({ taskIdToStoryKey: {} });
    }

    const api = await getTrackerApiFromRequest(request);
    const taskIdToStoryKey: Record<string, string> = {};

    for (const sprintId of sprintIds) {
      try {
        const issues = await fetchTasksInSprintWithParents(sprintId, api);
        for (const issue of issues) {
          const parentKey = issue.parent?.key;
          if (parentKey && issue.key) {
            taskIdToStoryKey[issue.key] = parentKey;
          }
        }
      } catch (err) {
        console.warn(`[task-parents] Failed to fetch sprint ${sprintId}:`, err);
        // продолжаем со следующими спринтами
      }
    }

    return NextResponse.json({ taskIdToStoryKey });
  } catch (error) {
    return handleApiError(error, 'fetch batch task parents', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
