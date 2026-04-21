import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { formatValidationError, validateRequest } from '@/lib/validation';

const CreateTodoSchema = z.object({
  text: z.string().max(1000).default(''),
});

/**
 * GET /api/features/[featureId]/grooming/todos
 * Получить список TODO
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);

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
       WHERE feature_id = $1
       ORDER BY display_order ASC, created_at ASC`,
      [featureId]
    );

    return NextResponse.json({ todos: result.rows });
  } catch (error) {
    console.error('Error fetching grooming todos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grooming todos' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/features/[featureId]/grooming/todos
 * Создать новый TODO
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(CreateTodoSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { text } = validation.data;

    // Получаем максимальный display_order для установки нового
    const maxOrderResult = await query(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order
       FROM feature_grooming_todos
       WHERE feature_id = $1`,
      [featureId]
    );
    const displayOrder = maxOrderResult.rows[0]?.next_order || 0;

    const result = await query(
      `INSERT INTO feature_grooming_todos (feature_id, text, display_order, completed)
       VALUES ($1, $2, $3, false)
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
      [featureId, text, displayOrder]
    );

    return NextResponse.json({ todo: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating grooming todo:', error);
    return NextResponse.json(
      { error: 'Failed to create grooming todo' },
      { status: 500 }
    );
  }
}

