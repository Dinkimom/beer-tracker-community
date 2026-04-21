import { NextRequest, NextResponse } from 'next/server';

import { invalidateCache } from '@/lib/cache';
import { pool, qualifyBeerTrackerTables } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { ReorderDocumentsSchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * POST /api/features/[featureId]/documents/reorder
 * Изменить порядок документов
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(ReorderDocumentsSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { documentIds } = validation.data;

    // Используем транзакцию для атомарности операции
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Обновляем display_order для каждого документа
      // Выполняем запросы последовательно на одном клиенте в рамках транзакции,
      // поэтому осознанно используем await в цикле.

      for (let i = 0; i < documentIds.length; i++) {
        await client.query(
          qualifyBeerTrackerTables(`UPDATE feature_documents
           SET display_order = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND feature_id = $3`),
          [i, documentIds[i], featureId]
        );
      }

      await client.query('COMMIT');

      // Инвалидируем кэш документов фичи
      invalidateCache.feature(featureId);

      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error reordering documents:', error);
    return NextResponse.json(
      { error: 'Failed to reorder documents' },
      { status: 500 }
    );
  }
}

