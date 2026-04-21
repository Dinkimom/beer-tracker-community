import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { formatValidationError, validateRequest } from '@/lib/validation';

const UpdateDiagramSchema = z.object({
  content: z.string(),
});

/**
 * GET /api/features/[featureId]/grooming/diagram
 * Получить диаграмму груминга
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);

    const result = await query(
      `SELECT content::text as content, created_at as "createdAt", updated_at as "updatedAt"
       FROM feature_grooming_diagrams
       WHERE feature_id = $1`,
      [featureId]
    );

    if (result.rows.length === 0) {
      // Если диаграммы нет, возвращаем пустую
      return NextResponse.json({ diagram: null });
    }

    return NextResponse.json({ diagram: result.rows[0] });
  } catch (error) {
    console.error('Error fetching grooming diagram:', error);
    return NextResponse.json(
      { error: 'Failed to fetch grooming diagram' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/features/[featureId]/grooming/diagram
 * Создать или обновить диаграмму груминга
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);
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

    const { content } = validation.data;

    // Проверяем, существует ли диаграмма
    const existingResult = await query(
      `SELECT id FROM feature_grooming_diagrams WHERE feature_id = $1`,
      [featureId]
    );

    let result;
    if (existingResult.rows.length > 0) {
      // Обновляем существующую
      result = await query(
        `UPDATE feature_grooming_diagrams
         SET content = $1::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE feature_id = $2
         RETURNING content, created_at as "createdAt", updated_at as "updatedAt"`,
        [content, featureId]
      );
    } else {
      // Создаем новую
      result = await query(
        `INSERT INTO feature_grooming_diagrams (feature_id, content)
         VALUES ($1, $2::jsonb)
         RETURNING content, created_at as "createdAt", updated_at as "updatedAt"`,
        [featureId, content]
      );
    }

    return NextResponse.json({ diagram: result.rows[0] });
  } catch (error) {
    console.error('Error saving grooming diagram:', error);
    return NextResponse.json(
      { error: 'Failed to save grooming diagram' },
      { status: 500 }
    );
  }
}

