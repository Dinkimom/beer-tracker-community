import { NextRequest, NextResponse } from 'next/server';

import { apiCache, cacheKeys, invalidateCache } from '@/lib/cache';
import { pool, qualifyBeerTrackerTables, query } from '@/lib/db';
import { resolveParams } from '@/lib/nextjs-utils';
import { UpdateFeatureSchema, formatValidationError, validateRequest } from '@/lib/validation';

// Кэшируем фичу на 5 минут
const FEATURE_CACHE_TTL = 5 * 60; // 5 минут в секундах

/**
 * GET /api/features/[featureId]
 * Получить фичу по ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);

    // Проверяем кэш
    const cacheKey = cacheKeys.feature(featureId);
    const cachedData = apiCache.get<{ feature: unknown }>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const result = await query(
      `SELECT 
        id,
        board_id as "boardId",
        name,
        description,
        status,
        responsible_by_platform as "responsibleByPlatform",
        tasks,
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM features
      WHERE id = $1`,
      [featureId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }

    const responseData = { feature: result.rows[0] };

    // Сохраняем в кэш
    apiCache.set(cacheKey, responseData, FEATURE_CACHE_TTL);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching feature:', error);
    return NextResponse.json(
      { error: 'Failed to fetch feature' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/features/[featureId]
 * Обновить фичу
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);

    // Если это ключ трекера (например NW-5380), не обновляем через БД
    // Эпики и стори из трекера управляются трекером, а не нашей БД
    const isTrackerKey = /^[A-Z]+-\d+$/.test(featureId);
    if (isTrackerKey) {
      return NextResponse.json(
        { error: 'Tracker keys cannot be updated through this endpoint' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(UpdateFeatureSchema, body);
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
    const updateValues: unknown[] = [];
    let paramIndex = 1;

    // Динамически строим запрос на основе переданных полей
    if (updates.name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      updateValues.push(updates.name);
    }

    if (updates.description !== undefined) {
      updateFields.push(`description = $${paramIndex++}`);
      updateValues.push(updates.description);
    }

    if (updates.status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      updateValues.push(updates.status);
    }

    if (updates.responsibleByPlatform !== undefined) {
      updateFields.push(`responsible_by_platform = $${paramIndex++}::jsonb`);
      updateValues.push(JSON.stringify(updates.responsibleByPlatform));
    }

    if (updates.tasks !== undefined) {
      updateFields.push(`tasks = $${paramIndex++}::jsonb`);
      updateValues.push(JSON.stringify(updates.tasks));
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Добавляем featureId в конец параметров
    updateValues.push(featureId);

    const result = await query(
      `UPDATE features 
       SET ${updateFields.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING 
         id,
         board_id as "boardId",
         name,
         description,
         status,
         responsible_by_platform as "responsibleByPlatform",
         tasks,
         created_at as "createdAt",
         updated_at as "updatedAt"`,
      updateValues as (boolean | number | string | null | undefined)[]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }

    // Инвалидируем кэш фичи
    invalidateCache.feature(featureId);

    return NextResponse.json({ feature: result.rows[0] });
  } catch (error) {
    console.error('Error updating feature:', error);
    return NextResponse.json(
      { error: 'Failed to update feature' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/features/[featureId]
 * Удалить фичу
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ featureId: string }> | { featureId: string } }
) {
  try {
    const { featureId } = await resolveParams(params);

    // Используем транзакцию для удаления связанных данных
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Удаляем документы
      await client.query(
        qualifyBeerTrackerTables('DELETE FROM feature_documents WHERE feature_id = $1'),
        [featureId]
      );

      // Удаляем диаграммы
      await client.query(
        qualifyBeerTrackerTables('DELETE FROM feature_diagrams WHERE feature_id = $1'),
        [featureId]
      );

      // Удаляем саму фичу
      const result = await client.query(
        qualifyBeerTrackerTables('DELETE FROM features WHERE id = $1 RETURNING id'),
        [featureId]
      );

      await client.query('COMMIT');

      if (result.rows.length === 0) {
        return NextResponse.json(
          { error: 'Feature not found' },
          { status: 404 }
        );
      }

      // Инвалидируем кэш фичи
      invalidateCache.feature(featureId);

      return NextResponse.json({ success: true });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error deleting feature:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature' },
      { status: 500 }
    );
  }
}

