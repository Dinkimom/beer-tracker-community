import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveParams } from '@/lib/nextjs-utils';
import {
  TaskLinkSchema,
  validateRequest,
  formatValidationError,
} from '@/lib/validation';

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
      `SELECT 
        id,
        from_task_id,
        to_task_id,
        from_anchor,
        to_anchor,
        created_at
      FROM task_links 
      WHERE ${onPrem ? 'sprint_id = $1' : 'organization_id = $1 AND sprint_id = $2'}
      ORDER BY created_at`,
      onPrem ? [sprintId] : [organizationId, sprintId]
    );

    return NextResponse.json({ links: result.rows });
  } catch (error) {
    console.error('Error fetching links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    );
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
    const validation = validateRequest(TaskLinkSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { fromTaskId, toTaskId, fromAnchor, toAnchor, id } = validation.data;

    // Если передан id, используем его, иначе генерируем новый UUID
    const linkId = id || `link-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const result = await query(
      onPrem
        ? `INSERT INTO task_links (id, sprint_id, from_task_id, to_task_id, from_anchor, to_anchor)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (sprint_id, from_task_id, to_task_id)
           DO UPDATE SET
             from_anchor = EXCLUDED.from_anchor,
             to_anchor = EXCLUDED.to_anchor
           RETURNING *`
        : `INSERT INTO task_links (id, organization_id, sprint_id, from_task_id, to_task_id, from_anchor, to_anchor)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (organization_id, sprint_id, from_task_id, to_task_id)
           DO UPDATE SET
             from_anchor = EXCLUDED.from_anchor,
             to_anchor = EXCLUDED.to_anchor
           RETURNING *`,
      onPrem
        ? [linkId, sprintId, fromTaskId, toTaskId, fromAnchor || null, toAnchor || null]
        : [linkId, organizationId, sprintId, fromTaskId, toTaskId, fromAnchor || null, toAnchor || null]
    );

    return NextResponse.json({ link: result.rows[0] });
  } catch (error) {
    console.error('Error saving link:', error);
    return NextResponse.json(
      { error: 'Failed to save link' },
      { status: 500 }
    );
  }
}

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
    const { searchParams } = new URL(request.url);
    const linkId = searchParams.get('linkId');

    if (isNaN(sprintId) || !linkId) {
      return NextResponse.json(
        { error: 'Invalid sprint ID or link ID' },
        { status: 400 }
      );
    }

    await query(
      onPrem
        ? 'DELETE FROM task_links WHERE sprint_id = $1 AND id = $2'
        : 'DELETE FROM task_links WHERE organization_id = $1 AND sprint_id = $2 AND id = $3',
      onPrem ? [sprintId, linkId] : [organizationId, sprintId, linkId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting link:', error);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}

