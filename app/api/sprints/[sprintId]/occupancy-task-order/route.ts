import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveParams } from '@/lib/nextjs-utils';

/**
 * GET /api/sprints/[sprintId]/occupancy-task-order
 * Получить порядок стори и задач для вкладки «Занятость»
 */
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

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);

    if (isNaN(sprintId)) {
      return NextResponse.json(
        { error: 'Invalid sprint ID' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT parent_ids as "parentIds", task_orders as "taskOrders"
       FROM occupancy_task_order
       WHERE ${onPrem ? 'sprint_id = $1' : 'organization_id = $1 AND sprint_id = $2'}`,
      onPrem ? [sprintId] : [organizationId, sprintId]
    );

    const row = result.rows[0];
    if (!row) {
      return NextResponse.json({ order: null });
    }

    return NextResponse.json({
      order: {
        parentIds: row.parentIds ?? [],
        taskOrders: row.taskOrders ?? {},
      },
    });
  } catch (error) {
    console.error('[GET /occupancy-task-order] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch occupancy task order' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/sprints/[sprintId]/occupancy-task-order
 * Сохранить порядок стори и задач для вкладки «Занятость»
 */
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
    const parentIds = Array.isArray(body.parentIds) ? body.parentIds : [];
    const taskOrders = body.taskOrders && typeof body.taskOrders === 'object' ? body.taskOrders : {};

    await query(
      onPrem
        ? `INSERT INTO occupancy_task_order (sprint_id, parent_ids, task_orders)
           VALUES ($1, $2::jsonb, $3::jsonb)
           ON CONFLICT (sprint_id)
           DO UPDATE SET parent_ids = $2::jsonb, task_orders = $3::jsonb, updated_at = CURRENT_TIMESTAMP`
        : `INSERT INTO occupancy_task_order (organization_id, sprint_id, parent_ids, task_orders)
           VALUES ($1, $2, $3::jsonb, $4::jsonb)
           ON CONFLICT (organization_id, sprint_id)
           DO UPDATE SET parent_ids = $3::jsonb, task_orders = $4::jsonb, updated_at = CURRENT_TIMESTAMP`,
      onPrem
        ? [sprintId, JSON.stringify(parentIds), JSON.stringify(taskOrders)]
        : [organizationId, sprintId, JSON.stringify(parentIds), JSON.stringify(taskOrders)]
    );

    return NextResponse.json({
      success: true,
      order: { parentIds, taskOrders },
    });
  } catch (error) {
    console.error('[PUT /occupancy-task-order] Error:', error);
    return NextResponse.json(
      { error: 'Failed to save occupancy task order' },
      { status: 500 }
    );
  }
}
