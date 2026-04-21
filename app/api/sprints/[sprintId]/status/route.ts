import omit from 'lodash-es/omit';
import { NextRequest, NextResponse } from 'next/server';

import { TRACKER_UPSTREAM_FORWARD_STATUSES, handleApiError } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { invalidateCache } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';
import { updateTrackerSprintStatus } from '@/lib/trackerApi';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> | { sprintId: string } }
) {
  try {
    const { sprintId } = await resolveParams(params);
    const body = await request.json();
    const { status, version } = body;

    if (!sprintId) {
      return NextResponse.json(
        { error: 'sprintId is required' },
        { status: 400 }
      );
    }

    if (!status) {
      return NextResponse.json(
        { error: 'status is required' },
        { status: 400 }
      );
    }

    const sprintIdNum = parseInt(sprintId, 10);
    if (isNaN(sprintIdNum)) {
      return NextResponse.json(
        { error: 'Invalid sprintId' },
        { status: 400 }
      );
    }

    const validStatuses = ['draft', 'in_progress', 'released', 'archived'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const updatedSprint = await updateTrackerSprintStatus(
      sprintIdNum,
      status,
      version,
      trackerApi
    );

    if (!updatedSprint) {
      return NextResponse.json(
        { error: 'Failed to update sprint status' },
        { status: 500 }
      );
    }

    // Инвалидируем кэш для спринта (бурдаун, sprintInfo)
    invalidateCache.sprint(sprintIdNum);

    // Список спринтов GET /api/sprints кэшируется по доске — сбрасываем, иначе статус в селекторе до 10 минут старый
    if (updatedSprint.boardId != null) {
      invalidateCache.sprints(updatedSprint.boardId);
    }

    const sprintForClient = omit(updatedSprint, 'boardId');

    return NextResponse.json({
      success: true,
      sprint: sprintForClient,
    });
  } catch (error) {
    return handleApiError(error, 'update sprint status', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
