
import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';

/**
 * GET /api/sprints/batch/positions?sprintIds=1,2,3
 * Возвращает позиции по всем указанным спринтам одним запросом.
 */
export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;
    const onPrem = isOnPremMode();

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
      return NextResponse.json({ bySprint: [] });
    }

    const result = await query(
      `SELECT 
        sprint_id,
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
      WHERE ${onPrem ? 'sprint_id = ANY($1::int[])' : 'organization_id = $1 AND sprint_id = ANY($2::int[])'}
      ORDER BY sprint_id, assignee_id, start_day, start_part`,
      onPrem ? [sprintIds] : [organizationId, sprintIds]
    );

    const bySprint: Record<number, Array<Record<string, unknown>>> = {};
    for (const id of sprintIds) {
      bySprint[id] = [];
    }
    for (const row of result.rows as Array<Record<string, unknown> & { sprint_id: number; task_id: string }>) {
      const { sprint_id, ...rest } = row;
      if (!bySprint[sprint_id]) bySprint[sprint_id] = [];
      bySprint[sprint_id].push(rest);
    }

    if (sprintIds.length > 0) {
      const segmentsResult = await query(
        `SELECT sprint_id, task_id, segment_index, start_day, start_part, duration
         FROM task_position_segments
         WHERE ${onPrem ? 'sprint_id = ANY($1::int[])' : 'organization_id = $1 AND sprint_id = ANY($2::int[])'}
         ORDER BY sprint_id, task_id, segment_index`,
        onPrem ? [sprintIds] : [organizationId, sprintIds]
      );
      const segmentsBySprintAndTask = new Map<string, Array<{ start_day: number; start_part: number; duration: number }>>();
      for (const row of segmentsResult.rows as Array<{ sprint_id: number; task_id: string; segment_index: number; start_day: number; start_part: number; duration: number }>) {
        const key = `${row.sprint_id}:${row.task_id}`;
        const list = segmentsBySprintAndTask.get(key) ?? [];
        list.push({ start_day: row.start_day, start_part: row.start_part, duration: row.duration });
        segmentsBySprintAndTask.set(key, list);
      }
      for (const sprintId of sprintIds) {
        for (const pos of bySprint[sprintId] ?? []) {
          const taskId = pos.task_id as string;
          const segs = segmentsBySprintAndTask.get(`${sprintId}:${taskId}`);
          pos.segments = segs;
        }
      }
    }

    return NextResponse.json({
      bySprint: sprintIds.map((id) => ({ sprintId: id, positions: bySprint[id] ?? [] })),
    });
  } catch (error) {
    console.error('Error fetching batch positions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch positions' },
      { status: 500 }
    );
  }
}
