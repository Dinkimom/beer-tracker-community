import type { QueryParams } from '@/types';

import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { UpdateDiagramSchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * GET /api/features/[featureId]/diagrams/[diagramId]
 * Получить диаграмму по ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; diagramId: string }> | { featureId: string; diagramId: string } }
) {
  try {
    const { featureId, diagramId } = await resolveParams(params);

    const result = await query(
      `SELECT 
        id,
        name,
        content::text as content,
        display_order as "displayOrder",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM feature_diagrams
      WHERE id = $1 AND feature_id = $2`,
      [diagramId, featureId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ diagram: result.rows[0] });
  } catch (error) {
    console.error('Error fetching diagram:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diagram' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/features/[featureId]/diagrams/[diagramId]
 * Обновить диаграмму
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; diagramId: string }> | { featureId: string; diagramId: string } }
) {
  try {
    const { featureId, diagramId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(UpdateDiagramSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { name, content } = validation.data;

    const updates: string[] = [];
    const values: QueryParams = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (content !== undefined) {
      updates.push(`content = $${paramIndex}::jsonb`);
      values.push(JSON.stringify(content));
      paramIndex++;
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    values.push(diagramId, featureId);

    const result = await query(
      `UPDATE feature_diagrams
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramIndex} AND feature_id = $${paramIndex + 1}
       RETURNING 
         id,
         name,
         content::text as content,
         display_order as "displayOrder",
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      values
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ diagram: result.rows[0] });
  } catch (error) {
    console.error('Error updating diagram:', error);
    return NextResponse.json(
      { error: 'Failed to update diagram' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/features/[featureId]/diagrams/[diagramId]
 * Удалить диаграмму
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string; diagramId: string }> | { featureId: string; diagramId: string } }
) {
  try {
    const { featureId, diagramId } = await resolveParams(params);

    const result = await query(
      `DELETE FROM feature_diagrams
       WHERE id = $1 AND feature_id = $2
       RETURNING id`,
      [diagramId, featureId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Diagram not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting diagram:', error);
    return NextResponse.json(
      { error: 'Failed to delete diagram' },
      { status: 500 }
    );
  }
}

