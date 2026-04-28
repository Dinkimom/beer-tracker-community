import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';

/** GET: список целей по sprintId, goalType */
export async function GET(request: NextRequest) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;
    const onPrem = isOnPremMode();

    const { searchParams } = new URL(request.url);
    const sprintIdStr = searchParams.get('sprintId');
    const goalType = searchParams.get('goalType'); // 'delivery' | 'discovery'

    const sprintId = sprintIdStr ? parseInt(sprintIdStr, 10) : NaN;

    if (isNaN(sprintId) || !goalType || !['delivery', 'discovery'].includes(goalType)) {
      return NextResponse.json(
        { error: 'sprintId and goalType (delivery|discovery) are required' },
        { status: 400 }
      );
    }

    const result = await query(
      `SELECT id, text, done
       FROM sprint_goals
       WHERE ${onPrem ? 'sprint_id = $1 AND goal_type = $2' : 'organization_id = $1 AND sprint_id = $2 AND goal_type = $3'}
       ORDER BY created_at ASC`,
      onPrem ? [sprintId, goalType] : [organizationId, sprintId, goalType]
    );

    const checklistItems = result.rows.map((row: { id: string; text: string; done: boolean }) => ({
      id: String(row.id),
      text: row.text ?? '',
      checked: Boolean(row.done),
      checklistItemType: 'standard' as const,
    }));

    const checklistDone = checklistItems.filter((i) => i.checked).length;
    const checklistTotal = checklistItems.length;

    return NextResponse.json({
      checklistItems,
      checklistDone,
      checklistTotal,
    });
  } catch (error) {
    console.error('Error fetching sprint goals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sprint goals' },
      { status: 500 }
    );
  }
}

/** POST: создать цель */
export async function POST(request: NextRequest) {
  try {
    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;
    const onPrem = isOnPremMode();

    const body = await request.json();
    const { sprintId, goalType, text, team } = body as {
      sprintId: number;
      goalType: 'delivery' | 'discovery';
      text: string;
      team?: string;
    };

    if (
      typeof sprintId !== 'number' ||
      !goalType ||
      !['delivery', 'discovery'].includes(goalType) ||
      typeof text !== 'string' ||
      !text.trim()
    ) {
      return NextResponse.json(
        { error: 'sprintId, goalType and text are required' },
        { status: 400 }
      );
    }

    const insert = await query(
      onPrem
        ? `INSERT INTO sprint_goals (sprint_id, team, text, goal_type, done)
           VALUES ($1, $2, $3, $4, false)
           RETURNING id, text, done`
        : `INSERT INTO sprint_goals (organization_id, sprint_id, team, text, goal_type, done)
           VALUES ($1, $2, $3, $4, $5, false)
           RETURNING id, text, done`,
      onPrem
        ? [sprintId, team ?? null, text.trim(), goalType]
        : [organizationId, sprintId, team ?? null, text.trim(), goalType]
    );

    const row = insert.rows[0] as { id: string; text: string; done: boolean };
    const item = {
      id: String(row.id),
      text: row.text ?? '',
      checked: Boolean(row.done),
      checklistItemType: 'standard' as const,
    };

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error('Error creating sprint goal:', error);
    return NextResponse.json(
      { error: 'Failed to create sprint goal' },
      { status: 500 }
    );
  }
}
