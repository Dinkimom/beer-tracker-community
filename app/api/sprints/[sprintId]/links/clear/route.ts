import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveParams } from '@/lib/nextjs-utils';

/**
 * DELETE /api/sprints/[sprintId]/links/clear
 * Удаляет все связи задач для указанного спринта
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
    const onPrem = isOnPremMode();

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);

    if (isNaN(sprintId)) {
      return NextResponse.json(
        { error: 'Invalid sprint ID' },
        { status: 400 }
      );
    }

    await query(
      onPrem
        ? 'DELETE FROM task_links WHERE sprint_id = $1'
        : 'DELETE FROM task_links WHERE organization_id = $1 AND sprint_id = $2',
      onPrem ? [sprintId] : [organizationId, sprintId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error clearing links:', error);
    return NextResponse.json(
      { error: 'Failed to clear links' },
      { status: 500 }
    );
  }
}

