import { NextRequest, NextResponse } from 'next/server';

import { TRACKER_UPSTREAM_FORWARD_STATUSES, handleApiError } from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveParams } from '@/lib/nextjs-utils';
import { resolvePlannerAssigneeIdsForTrackerSync } from '@/lib/staffTeams/resolvePlannerAssigneeForTrackerSync';
import { updateIssueAssignee } from '@/lib/trackerApi';
import { loadTrackerIntegrationForTrackerPatch } from '@/lib/trackerIntegration';
import { buildIssueAssigneePatch } from '@/lib/trackerIntegration/buildIssueAssigneePatch';
import { BatchPositionsSchema, formatValidationError, validateRequest } from '@/lib/validation';
import { syncPlannedDatesToTracker } from '../plannedDateSync';

/**
 * Батч сохранение позиций задач в спринте
 * Позволяет сохранить множество позиций одним запросом
 */
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
    const onPrem = isOnPremMode();

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
    const validation = validateRequest(BatchPositionsSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { positions } = validation.data;

    // Используем транзакцию для атомарности операции
    await query('BEGIN');

    try {
      // Удаляем существующие позиции для задач, которые обновляются
      const taskIds = positions.map((p) => p.taskId);
      if (taskIds.length > 0) {
        const placeholders = taskIds.map((_, i) => `$${i + (onPrem ? 2 : 3)}`).join(', ');
        await query(
          `DELETE FROM task_positions 
           WHERE ${onPrem ? `sprint_id = $1 AND task_id IN (${placeholders})` : `organization_id = $1 AND sprint_id = $2 AND task_id IN (${placeholders})`}`,
          onPrem ? [sprintId, ...taskIds] : [organizationId, sprintId, ...taskIds]
        );
      }

      // Вставляем все позиции одним запросом
      // Используем правильную нумерацию параметров
      const valuesParts: string[] = [];
      const params: Array<boolean | number | string | null> = [];

      positions.forEach((pos, index) => {
        const baseIndex = index * (onPrem ? 10 : 11) + 1;
        valuesParts.push(
          onPrem
            ? `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9})`
            : `($${baseIndex}, $${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6}, $${baseIndex + 7}, $${baseIndex + 8}, $${baseIndex + 9}, $${baseIndex + 10})`
        );
        if (onPrem) {
          params.push(
            sprintId,
            pos.taskId,
            pos.assigneeId,
            pos.startDay,
            pos.startPart,
            pos.duration,
            pos.plannedStartDay ?? null,
            pos.plannedStartPart ?? null,
            pos.plannedDuration ?? null,
            pos.isQa ?? false
          );
        } else {
          params.push(
            organizationId,
            sprintId,
            pos.taskId,
            pos.assigneeId,
            pos.startDay,
            pos.startPart,
            pos.duration,
            pos.plannedStartDay ?? null,
            pos.plannedStartPart ?? null,
            pos.plannedDuration ?? null,
            pos.isQa ?? false
          );
        }
      });

      await query(
        onPrem
          ? `INSERT INTO task_positions (
               sprint_id, task_id, assignee_id, start_day, start_part, duration,
               planned_start_day, planned_start_part, planned_duration, is_qa
             ) VALUES ${valuesParts.join(', ')}
             ON CONFLICT (sprint_id, task_id)
             DO UPDATE SET
               assignee_id = EXCLUDED.assignee_id,
               start_day = EXCLUDED.start_day,
               start_part = EXCLUDED.start_part,
               duration = EXCLUDED.duration,
               planned_start_day = EXCLUDED.planned_start_day,
               planned_start_part = EXCLUDED.planned_start_part,
               planned_duration = EXCLUDED.planned_duration,
               is_qa = EXCLUDED.is_qa,
               updated_at = CURRENT_TIMESTAMP`
          : `INSERT INTO task_positions (
               organization_id, sprint_id, task_id, assignee_id, start_day, start_part, duration,
               planned_start_day, planned_start_part, planned_duration, is_qa
             ) VALUES ${valuesParts.join(', ')}
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
               updated_at = CURRENT_TIMESTAMP`,
        params
      );

      for (const pos of positions) {
        // Обновляем сегменты только если поле segments явно присутствует для этой позиции.
        // Если его нет — не трогаем существующие task_position_segments по этой задаче.
        if (pos.segments !== undefined) {
          await query(
            onPrem
              ? 'DELETE FROM task_position_segments WHERE sprint_id = $1 AND task_id = $2'
              : 'DELETE FROM task_position_segments WHERE organization_id = $1 AND sprint_id = $2 AND task_id = $3',
            onPrem ? [sprintId, pos.taskId] : [organizationId, sprintId, pos.taskId]
          );
          if (pos.segments.length > 0) {
            for (let i = 0; i < pos.segments.length; i++) {
              const seg = pos.segments[i]!;
              await query(
                onPrem
                  ? `INSERT INTO task_position_segments (sprint_id, task_id, segment_index, start_day, start_part, duration)
                     VALUES ($1, $2, $3, $4, $5, $6)
                     ON CONFLICT (sprint_id, task_id, segment_index)
                     DO UPDATE SET
                       start_day = EXCLUDED.start_day,
                       start_part = EXCLUDED.start_part,
                       duration = EXCLUDED.duration`
                  : `INSERT INTO task_position_segments (organization_id, sprint_id, task_id, segment_index, start_day, start_part, duration)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     ON CONFLICT (organization_id, sprint_id, task_id, segment_index)
                     DO UPDATE SET
                       start_day = EXCLUDED.start_day,
                       start_part = EXCLUDED.start_part,
                       duration = EXCLUDED.duration`,
                onPrem
                  ? [sprintId, pos.taskId, i, seg.startDay, seg.startPart, seg.duration]
                  : [organizationId, sprintId, pos.taskId, i, seg.startDay, seg.startPart, seg.duration]
              );
            }
          }
        }
      }

      await query('COMMIT');

      // Синхронизируем исполнителей в Трекере (assignee для dev, qaEngineer на dev-задаче для QA),
      // только для тех позиций, у которых syncAssignee не отключён.
      try {
        const toSync = positions.filter((pos) => pos.syncAssignee ?? true);
        const resolved = await resolvePlannerAssigneeIdsForTrackerSync(
          organizationId,
          toSync.map((p) => p.assigneeId)
        );
        const trackerApi = await getTrackerApiFromRequest(request);
        const integration = await loadTrackerIntegrationForTrackerPatch(organizationId);
        await Promise.all(
          toSync
            .map((pos) => {
              const trackerAssigneeId = resolved.get(pos.assigneeId);
              if (!trackerAssigneeId) {
                return null;
              }
              const issueKeyToUpdate = pos.isQa && pos.devTaskKey ? pos.devTaskKey : pos.taskId;
              const isQa = pos.isQa ?? false;
              const patch = buildIssueAssigneePatch(trackerAssigneeId, isQa, integration);
              return updateIssueAssignee(issueKeyToUpdate, trackerAssigneeId, trackerApi, isQa, patch);
            })
            .filter((p): p is Promise<boolean> => p != null)
        );
      } catch (err) {
        console.error('[sync assignee → tracker] POST /sprints/.../positions/batch', err);
      }

      // Синхронизируем запланированные даты в Tracker для всех позиций,
      // где client прислал plannedStartDay/plannedStartPart.
      try {
        const toSyncDates = positions.filter(
          (pos) => pos.plannedStartDay != null && pos.plannedStartPart != null
        );

        if (toSyncDates.length > 0) {
          await syncPlannedDatesToTracker({
            organizationId,
            positions: toSyncDates,
            request,
            sprintId,
          });
        }
      } catch (err) {
        console.error('[sync planned dates → tracker] POST /sprints/.../positions/batch', err);
      }

      return NextResponse.json({
        success: true,
        count: positions.length,
      });
    } catch (error) {
      await query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    return handleApiError(error, 'save batch positions', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

