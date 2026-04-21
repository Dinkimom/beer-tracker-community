import type { QueryParams } from '@/types';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { formatValidationError, validateRequest } from '@/lib/validation';

const UpdateTodoSchema = z.object({
  assignee: z.string().max(255).nullable().optional(),
  completed: z.boolean().optional(),
  deadline: z.string().nullable().optional(),
  text: z.string().min(1).max(1000).optional(),
});

/**
 * GET /api/features/[featureId]/grooming/todos/[todoId]
 * Получить TODO
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; todoId: string }> | { featureId: string; todoId: string } }
) {
  try {
    const { featureId, todoId } = await resolveParams(params);

    const result = await query(
      `SELECT 
         id,
         feature_id as "featureId",
         text,
         deadline,
         assignee,
         completed,
         display_order as "displayOrder",
         created_at as "createdAt",
         updated_at as "updatedAt"
       FROM feature_grooming_todos
       WHERE id = $1 AND feature_id = $2`,
      [todoId, featureId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ todo: result.rows[0] });
  } catch (error) {
    console.error('Error fetching grooming todo:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grooming todo' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/features/[featureId]/grooming/todos/[todoId]
 * Обновить TODO
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; todoId: string }> | { featureId: string; todoId: string } }
) {
  try {
    const { featureId, todoId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(UpdateTodoSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const updates = validation.data;
    const updateFields: string[] = [];
    const updateValues: QueryParams = [];
    let paramIndex = 1;

    if (updates.text !== undefined) {
      updateFields.push(`text = $${paramIndex++}`);
      updateValues.push(updates.text);
    }

    if (updates.deadline !== undefined) {
      updateFields.push(`deadline = $${paramIndex++}`);
      updateValues.push(updates.deadline || null);
    }

    if (updates.assignee !== undefined) {
      updateFields.push(`assignee = $${paramIndex++}`);
      updateValues.push(updates.assignee || null);
    }

    if (updates.completed !== undefined) {
      updateFields.push(`completed = $${paramIndex++}`);
      updateValues.push(updates.completed);
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
    updateValues.push(todoId, featureId);

    const result = await query(
      `UPDATE feature_grooming_todos
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex} AND feature_id = $${paramIndex + 1}
       RETURNING 
         id,
         feature_id as "featureId",
         text,
         deadline,
         assignee,
         completed,
         display_order as "displayOrder",
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      updateValues
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ todo: result.rows[0] });
  } catch (error) {
    console.error('Error updating grooming todo:', error);
    return NextResponse.json(
      { error: 'Failed to update grooming todo' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/features/[featureId]/grooming/todos/[todoId]
 * Удалить TODO
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; todoId: string }> | { featureId: string; todoId: string } }
) {
  try {
    const { featureId, todoId } = await resolveParams(params);

    const result = await query(
      `DELETE FROM feature_grooming_todos
       WHERE id = $1 AND feature_id = $2
       RETURNING id`,
      [todoId, featureId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Todo not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting grooming todo:', error);
    return NextResponse.json(
      { error: 'Failed to delete grooming todo' },
      { status: 500 }
    );
  }
}

