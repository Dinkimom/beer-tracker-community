import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';

/**
 * GET /api/sprints/batch/links?sprintIds=1,2,3
 * Возвращает связи по всем указанным спринтам одним запросом.
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
        id,
        from_task_id,
        to_task_id,
        from_anchor,
        to_anchor,
        created_at
      FROM task_links 
      WHERE ${onPrem ? 'sprint_id = ANY($1::int[])' : 'organization_id = $1 AND sprint_id = ANY($2::int[])'}
      ORDER BY sprint_id, created_at`,
      onPrem ? [sprintIds] : [organizationId, sprintIds]
    );

    const bySprint: Record<number, typeof result.rows> = {};
    for (const id of sprintIds) {
      bySprint[id] = [];
    }
    for (const row of result.rows as Array<Record<string, unknown> & { sprint_id: number }>) {
      const { sprint_id, ...rest } = row;
      if (!bySprint[sprint_id]) bySprint[sprint_id] = [];
      bySprint[sprint_id].push(rest);
    }

    return NextResponse.json({
      bySprint: sprintIds.map((id) => ({ sprintId: id, links: bySprint[id] ?? [] })),
    });
  } catch (error) {
    console.error('Error fetching batch links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}
