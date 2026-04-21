import { NextRequest, NextResponse } from 'next/server';

import { pool, qualifyBeerTrackerTables } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { ReorderDiagramsSchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * POST /api/features/[featureId]/diagrams/reorder
 * Изменить порядок диаграмм
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(ReorderDiagramsSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { diagramIds } = validation.data;

    // Используем транзакцию для атомарности операции
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Обновляем display_order для каждой диаграммы
      // Выполняем запросы последовательно на одном клиенте в рамках транзакции,
      // поэтому осознанно используем await в цикле.

      for (let i = 0; i < diagramIds.length; i++) {
        await client.query(
          qualifyBeerTrackerTables(`UPDATE feature_diagrams
           SET display_order = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND feature_id = $3`),
          [i, diagramIds[i], featureId]
        );
      }

      await client.query('COMMIT');
      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reordering diagrams:', error);
    return NextResponse.json(
      { error: 'Failed to reorder diagrams' },
      { status: 500 }
    );
  }
}

