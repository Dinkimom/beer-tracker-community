import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';

/** PATCH: обновить цель (text и/или checked) */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;

    const { id } = await resolveParams(context.params);
    if (!id) {
      return NextResponse.json({ error: 'Goal id is required' }, { status: 400 });
    }

    const body = await request.json() as { text?: string; checked?: boolean };
    const updates: string[] = [];
    const values: Array<boolean | number | string | null | undefined> = [];
    let paramIndex = 1;

    if (typeof body.text === 'string') {
      updates.push(`text = $${paramIndex}`);
      values.push(body.text.trim());
      paramIndex += 1;
    }
    if (typeof body.checked === 'boolean') {
      updates.push(`done = $${paramIndex}`);
      values.push(body.checked);
      paramIndex += 1;
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Provide text and/or checked' }, { status: 400 });
    }

    values.push(organizationId, id);
    const result = await query(
      `UPDATE sprint_goals
       SET ${updates.join(', ')}
       WHERE organization_id = $${paramIndex} AND id = $${paramIndex + 1}
       RETURNING id, text, done`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    const row = result.rows[0] as { id: string; text: string; done: boolean };
    return NextResponse.json({
      success: true,
      item: {
        id: String(row.id),
        text: row.text ?? '',
        checked: Boolean(row.done),
        checklistItemType: 'standard' as const,
      },
    });
  } catch (error) {
    console.error('Error updating sprint goal:', error);
    return NextResponse.json(
      { error: 'Failed to update sprint goal' },
      { status: 500 }
    );
  }
}

/** DELETE: удалить цель */
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;

    const { id } = await resolveParams(context.params);
    if (!id) {
      return NextResponse.json({ error: 'Goal id is required' }, { status: 400 });
    }

    const result = await query(
      'DELETE FROM sprint_goals WHERE organization_id = $1 AND id = $2 RETURNING id',
      [organizationId, id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, notFound: true });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting sprint goal:', error);
    return NextResponse.json(
      { error: 'Failed to delete sprint goal' },
      { status: 500 }
    );
  }
}
