import { NextRequest, NextResponse } from 'next/server';

import { TRACKER_UPSTREAM_FORWARD_STATUSES, handleApiError } from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { resolvePlannerAssigneeIdForTrackerSync } from '@/lib/staffTeams/resolvePlannerAssigneeForTrackerSync';
import { updateIssueAssignee } from '@/lib/trackerApi';
import { loadTrackerIntegrationForTrackerPatch } from '@/lib/trackerIntegration';
import { buildIssueAssigneePatch } from '@/lib/trackerIntegration/buildIssueAssigneePatch';
import { TaskPositionSchema, formatValidationError, validateRequest } from '@/lib/validation';

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

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);

    if (isNaN(sprintId)) {
      return NextResponse.json(
        { error: 'Invalid sprint ID' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT 
        task_id,
        assignee_id,
        start_day,
        start_part,
        duration,
        planned_start_day,
        planned_start_part,
        planned_duration,
        is_qa
      FROM task_positions 
      WHERE organization_id = $1 AND sprint_id = $2
      ORDER BY assignee_id, start_day, start_part`,
      [organizationId, sprintId]
    );

    const positions = result.rows as Array<Record<string, unknown> & { task_id: string }>;
    // Загружаем отрезки (task_position_segments) и добавляем в каждую позицию — клиент ожидает positions[].segments
    if (positions.length > 0) {
      const segmentsResult = await query(
        `SELECT task_id, segment_index, start_day, start_part, duration
         FROM task_position_segments
         WHERE organization_id = $1 AND sprint_id = $2
         ORDER BY task_id, segment_index`,
        [organizationId, sprintId]
      );
      const segmentsByTask = new Map<string, Array<{ segment_index: number; start_day: number; start_part: number; duration: number }>>();
      for (const row of segmentsResult.rows as Array<{ task_id: string; segment_index: number; start_day: number; start_part: number; duration: number }>) {
        const list = segmentsByTask.get(row.task_id) ?? [];
        list.push({ segment_index: row.segment_index, start_day: row.start_day, start_part: row.start_part, duration: row.duration });
        segmentsByTask.set(row.task_id, list);
      }
      for (const pos of positions) {
        const segs = segmentsByTask.get(pos.task_id);
        (pos as Record<string, unknown>).segments = segs
          ? segs.sort((a, b) => a.segment_index - b.segment_index).map(({ start_day, start_part, duration }) => ({ start_day, start_part, duration }))
          : undefined;
      }
    }

    return NextResponse.json({ positions });
  } catch (error) {
    return handleApiError(error, 'fetch positions', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> | { sprintId: string } }
) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);

    if (isNaN(sprintId)) {
      return NextResponse.json(
        { error: 'Invalid sprint ID' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(TaskPositionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error)
        },
        { status: 400 }
      );
    }

    const {
      taskId,
      assigneeId,
      startDay,
      startPart,
      duration,
      plannedStartDay,
      plannedStartPart,
      plannedDuration,
      isQa,
      devTaskKey,
      segments,
      syncAssignee,
    } = validation.data;

    const result = await query(
      `INSERT INTO task_positions (
        organization_id, sprint_id, task_id, assignee_id, start_day, start_part, duration,
        planned_start_day, planned_start_part, planned_duration, is_qa
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (organization_id, sprint_id, task_id)
      DO UPDATE SET
        assignee_id = EXCLUDED.assignee_id,
        start_day = EXCLUDED.start_day,
        start_part = EXCLUDED.start_part,
        duration = EXCLUDED.duration,
        planned_start_day = EXCLUDED.planned_start_day,
        planned_start_part = EXCLUDED.planned_start_part,
        planned_duration = EXCLUDED.planned_duration,
        is_qa = EXCLUDED.is_qa,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [organizationId, sprintId, taskId, assigneeId, startDay, startPart, duration, plannedStartDay ?? null, plannedStartPart ?? null, plannedDuration ?? null, isQa ?? false]
    );

    // Обновляем сегменты только если поле segments явно присутствует в запросе.
    // Если его нет — не трогаем существующие task_position_segments.
    if (segments !== undefined) {
      await query(
        'DELETE FROM task_position_segments WHERE organization_id = $1 AND sprint_id = $2 AND task_id = $3',
        [organizationId, sprintId, taskId]
      );
      if (segments.length > 0) {
        for (let i = 0; i < segments.length; i++) {
          const seg = segments[i]!;
          await query(
            `INSERT INTO task_position_segments (organization_id, sprint_id, task_id, segment_index, start_day, start_part, duration)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             ON CONFLICT (organization_id, sprint_id, task_id, segment_index)
             DO UPDATE SET
               start_day = EXCLUDED.start_day,
               start_part = EXCLUDED.start_part,
               duration = EXCLUDED.duration`,
            [organizationId, sprintId, taskId, i, seg.startDay, seg.startPart, seg.duration]
          );
        }
      }
    }

    // Синхронизируем исполнителя в Трекере (assignee для dev, qaEngineer на dev-задаче для QA),
    // только если клиент не запретил это явно.
    if (syncAssignee ?? true) {
      const trackerAssigneeId = await resolvePlannerAssigneeIdForTrackerSync(organizationId, assigneeId);
      if (trackerAssigneeId) {
        try {
          const trackerApi = await getTrackerApiFromRequest(request);
          const integration = await loadTrackerIntegrationForTrackerPatch(organizationId);
          const issueKeyToUpdate = isQa && devTaskKey ? devTaskKey : taskId;
          const patch = buildIssueAssigneePatch(trackerAssigneeId, isQa ?? false, integration);
          await updateIssueAssignee(issueKeyToUpdate, trackerAssigneeId, trackerApi, isQa ?? false, patch);
        } catch (err) {
          console.error('[sync assignee → tracker] POST /sprints/.../positions', err);
        }
      }
    }

    return NextResponse.json({ position: result.rows[0] });
  } catch (error) {
    return handleApiError(error, 'save position', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> | { sprintId: string } }
) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (isNaN(sprintId) || !taskId) {
      return NextResponse.json(
        { error: 'Invalid sprint ID or task ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { assigneeId, startDay, startPart, duration, plannedStartDay, plannedStartPart, plannedDuration, devTaskKey } = body;

    const result = await query(
      `UPDATE task_positions SET
        assignee_id = COALESCE($1, assignee_id),
        start_day = COALESCE($2, start_day),
        start_part = COALESCE($3, start_part),
        duration = COALESCE($4, duration),
        planned_start_day = $5,
        planned_start_part = $6,
        planned_duration = $7,
        updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = $8 AND sprint_id = $9 AND task_id = $10
      RETURNING *`,
      [assigneeId, startDay, startPart, duration, plannedStartDay, plannedStartPart, plannedDuration, organizationId, sprintId, taskId]
    );

    // Синхронизируем исполнителя в Трекере при изменении (assignee для dev, qaEngineer на dev-задаче для QA)
    if (result.rows.length > 0 && assigneeId != null) {
      const trackerAssigneeId = await resolvePlannerAssigneeIdForTrackerSync(organizationId, assigneeId);
      if (trackerAssigneeId) {
        try {
          const trackerApi = await getTrackerApiFromRequest(request);
          const integration = await loadTrackerIntegrationForTrackerPatch(organizationId);
          const isQa = result.rows[0]?.is_qa ?? false;
          const issueKeyToUpdate = isQa && devTaskKey ? devTaskKey : taskId;
          const patch = buildIssueAssigneePatch(trackerAssigneeId, isQa, integration);
          await updateIssueAssignee(issueKeyToUpdate, trackerAssigneeId, trackerApi, isQa, patch);
        } catch (err) {
          console.error('[sync assignee → tracker] PUT /sprints/.../positions', err);
        }
      }
    }

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Position not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ position: result.rows[0] });
  } catch (error) {
    return handleApiError(error, 'update position', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

/**
 * DELETE — удаление фазы из плана.
 * Только удаляем запись из task_positions. Не трогаем assignee и qaEngineer в Трекере —
 * задача остаётся в спринте с теми же исполнителями.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sprintId: string }> | { sprintId: string } }
) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get('taskId');

    if (isNaN(sprintId) || !taskId) {
      return NextResponse.json(
        { error: 'Invalid sprint ID or task ID' },
        { status: 400 }
      );
    }

    await query(
      'DELETE FROM task_positions WHERE organization_id = $1 AND sprint_id = $2 AND task_id = $3',
      [organizationId, sprintId, taskId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'delete position', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

