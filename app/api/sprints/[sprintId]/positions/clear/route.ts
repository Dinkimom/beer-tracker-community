import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';

/**
 * DELETE /api/sprints/[sprintId]/positions/clear
 * Удаляет все позиции задач для указанного спринта
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

    if (isNaN(sprintId)) {
      return NextResponse.json(
        { error: 'Invalid sprint ID' },
        { status: 400 }
      );
    }

    await query(
      'DELETE FROM task_positions WHERE organization_id = $1 AND sprint_id = $2',
      [organizationId, sprintId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing positions:', error);
    return NextResponse.json(
      { error: 'Failed to clear positions' },
      { status: 500 }
    );
  }
}

