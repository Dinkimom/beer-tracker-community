import { NextRequest, NextResponse } from 'next/server';

import { apiCache, cacheKeys, invalidateCache } from '@/lib/cache';
import { query } from '@/lib/db';
import { CreateFeatureSchema, formatValidationError, validateRequest } from '@/lib/validation';

// Кэшируем фичи на 5 минут
const FEATURES_CACHE_TTL = 5 * 60; // 5 минут в секундах

/**
 * GET /api/features
 * Получить все фичи для доски
 * Query параметр: boardId (обязательный)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const boardIdParam = searchParams.get('boardId');

    if (!boardIdParam) {
      return NextResponse.json(
        { error: 'boardId query parameter is required' },
        { status: 400 }
      );
    }

    const boardId = parseInt(boardIdParam, 10);
    if (isNaN(boardId)) {
      return NextResponse.json(
        { error: 'Invalid boardId format' },
        { status: 400 }
      );
    }

    // Проверяем кэш
    const cacheKey = cacheKeys.features(boardId);
    const cachedData = apiCache.get<{ features: unknown[] }>(cacheKey);

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
      WHERE board_id = $1
      ORDER BY updated_at DESC, created_at DESC`,
      [boardId]
    );

    const responseData = { features: result.rows };

    // Сохраняем в кэш
    apiCache.set(cacheKey, responseData, FEATURES_CACHE_TTL);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching features:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/features
 * Создать новую фичу
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(CreateFeatureSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { boardId, name, description, status, responsibleByPlatform } = validation.data;

    const result = await query(
      `INSERT INTO features (board_id, name, description, status, responsible_by_platform, tasks)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
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
      [
        boardId,
        name,
        description || '',
        status || 'draft',
        JSON.stringify(responsibleByPlatform || {}),
        JSON.stringify([]), // Пустой массив задач по умолчанию
      ]
    );

    // Инвалидируем кэш фич для доски
    invalidateCache.features(boardId);

    return NextResponse.json({ feature: result.rows[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating feature:', error);
    return NextResponse.json(
      { error: 'Failed to create feature' },
      { status: 500 }
    );
  }
}

