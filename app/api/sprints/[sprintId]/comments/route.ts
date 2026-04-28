import { NextRequest, NextResponse } from 'next/server';

import { requireTenantContext } from '@/lib/api-tenant';
import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { resolveParams } from '@/lib/nextjs-utils';
import {
  CommentSchema,
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
        task_id,
        assignee_id,
        text,
        position_x as x,
        position_y as y,
        day,
        part,
        width,
        height,
        created_at,
        updated_at
      FROM comments 
      WHERE ${onPrem ? 'sprint_id = $1' : 'organization_id = $1 AND sprint_id = $2'}
      ORDER BY created_at`,
      onPrem ? [sprintId] : [organizationId, sprintId]
    );

    return NextResponse.json({ comments: result.rows });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
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
    const validation = validateRequest(CommentSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { id, assigneeId, text, taskId, x, y, day, part, width, height } = validation.data;

    const commentId = id || undefined;

    const result = await query(
      onPrem
        ? `INSERT INTO comments (
             id, sprint_id, task_id, assignee_id, text,
             position_x, position_y, day, part, width, height
           ) VALUES (
             COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
           )
           RETURNING
             id,
             task_id,
             assignee_id,
             text,
             position_x as x,
             position_y as y,
             day,
             part,
             width,
             height,
             created_at,
             updated_at`
        : `INSERT INTO comments (
             id, organization_id, sprint_id, task_id, assignee_id, text,
             position_x, position_y, day, part, width, height
           ) VALUES (
             COALESCE($1, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
           )
           RETURNING
        id,
        task_id,
        assignee_id,
        text,
        position_x as x,
        position_y as y,
        day,
        part,
        width,
        height,
        created_at,
        updated_at`,
      onPrem
        ? [commentId, sprintId, taskId ?? null, assigneeId, text, x ?? null, y ?? null, day ?? null, part ?? null, width ?? 200, height ?? 100]
        : [commentId, organizationId, sprintId, taskId ?? null, assigneeId, text, x ?? null, y ?? null, day ?? null, part ?? null, width ?? 200, height ?? 100]
    );

    return NextResponse.json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Error saving comment:', error);
    return NextResponse.json(
      { error: 'Failed to save comment' },
      { status: 500 }
    );
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
    const onPrem = isOnPremMode();

    const { sprintId: sprintIdStr } = await resolveParams(params);
    const sprintId = parseInt(sprintIdStr, 10);
    const { searchParams } = new URL(request.url);
    const commentId = searchParams.get('commentId');

    if (isNaN(sprintId) || !commentId) {
      return NextResponse.json(
        { error: 'Invalid sprint ID or comment ID' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { text, x, y, width, height, assigneeId, taskId, day, part } = body;

    const result = await query(
      `UPDATE comments SET
        text = COALESCE($1, text),
        position_x = COALESCE($2, position_x),
        position_y = COALESCE($3, position_y),
        width = COALESCE($4, width),
        height = COALESCE($5, height),
        assignee_id = COALESCE($6, assignee_id),
        task_id = COALESCE($7, task_id),
        day = COALESCE($8, day),
        part = COALESCE($9, part),
        updated_at = CURRENT_TIMESTAMP
      WHERE ${onPrem ? 'sprint_id = $10 AND id = $11' : 'organization_id = $10 AND sprint_id = $11 AND id = $12'}
      RETURNING 
        id,
        task_id,
        assignee_id,
        text,
        position_x as x,
        position_y as y,
        day,
        part,
        width,
        height,
        created_at,
        updated_at`,
      onPrem
        ? [text, x, y, width, height, assigneeId, taskId ?? null, day ?? null, part ?? null, sprintId, commentId]
        : [text, x, y, width, height, assigneeId, taskId ?? null, day ?? null, part ?? null, organizationId, sprintId, commentId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ comment: result.rows[0] });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
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
    const commentId = searchParams.get('commentId');

    if (isNaN(sprintId) || !commentId) {
      return NextResponse.json(
        { error: 'Invalid sprint ID or comment ID' },
        { status: 400 }
      );
    }

    await query(
      onPrem
        ? 'DELETE FROM comments WHERE sprint_id = $1 AND id = $2'
        : 'DELETE FROM comments WHERE organization_id = $1 AND sprint_id = $2 AND id = $3',
      onPrem ? [sprintId, commentId] : [organizationId, sprintId, commentId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}

