import { NextRequest, NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { CreateDiagramSchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * GET /api/features/[featureId]/diagrams
 * Получить все диаграммы фичи
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
        name,
        content::text as content,
        display_order as "displayOrder",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM feature_diagrams
      WHERE feature_id = $1
      ORDER BY display_order ASC, created_at ASC`,
      [featureId]
    );

    return NextResponse.json({ diagrams: result.rows });
  } catch (error) {
    console.error('Error fetching diagrams:', error);
    return NextResponse.json(
      { error: 'Failed to fetch diagrams' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/features/[featureId]/diagrams
 * Создать новую диаграмму
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(CreateDiagramSchema, body);
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

    // Получаем максимальный display_order для установки нового
    const maxOrderResult = await query(
      `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order
       FROM feature_diagrams
       WHERE feature_id = $1`,
      [featureId]
    );
    const displayOrder = maxOrderResult.rows[0]?.next_order || 0;

    const result = await query(
      `INSERT INTO feature_diagrams (feature_id, name, content, display_order)
       VALUES ($1, $2, $3::jsonb, $4)
       RETURNING 
         id,
         name,
         content::text as content,
         display_order as "displayOrder",
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      [featureId, name, JSON.stringify(content), displayOrder]
    );

    return NextResponse.json({ diagram: result.rows[0] });
  } catch (error) {
    console.error('Error creating diagram:', error);
    return NextResponse.json(
      { error: 'Failed to create diagram' },
      { status: 500 }
    );
  }
}

