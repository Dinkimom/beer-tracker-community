import { NextResponse } from 'next/server';
import { z } from 'zod';

import { TRACKER_UPSTREAM_FORWARD_STATUSES, handleApiError } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { apiCache, cacheKeys } from '@/lib/cache';
import { BoardIdQuerySchema, formatValidationError, validateRequest } from '@/lib/validation';

// Кэшируем список спринтов на 10 минут
const SPRINTS_CACHE_TTL = 10 * 60; // 10 минут в секундах

// Схема валидации для создания спринта
const CreateSprintSchema = z.object({
  name: z.string().min(1, 'Название спринта обязательно'),
  boardId: z.number().int().positive('ID доски должен быть положительным числом'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата должна быть в формате YYYY-MM-DD'),
});

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');

    // Валидация через Zod
    const validation = validateRequest(BoardIdQuerySchema, { boardId });
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { boardId: validatedBoardId } = validation.data;

    // Проверяем кэш
    const cacheKey = cacheKeys.sprints(Number(validatedBoardId));
    const cachedData = apiCache.get<unknown>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    // Если данных нет в кэше, делаем запрос к Tracker API
    const { data } = await trackerApi.get(`/boards/${validatedBoardId}/sprints`);

    // Сохраняем в кэш
    apiCache.set(cacheKey, data, SPRINTS_CACHE_TTL);

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'fetch sprints from Tracker', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

/**
 * Создание нового спринта
 * POST /v3/sprints
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(CreateSprintSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { name, boardId, startDate, endDate } = validation.data;

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    // Создаём спринт через Tracker API
    const { data } = await trackerApi.post('/sprints', {
      name,
      board: {
        id: boardId.toString(),
      },
      startDate,
      endDate,
    });

    // Инвалидируем кэш спринтов для этой доски
    const cacheKey = cacheKeys.sprints(boardId);
    apiCache.delete(cacheKey);

    return NextResponse.json({
      success: true,
      sprint: data,
    });
  } catch (error) {
    return handleApiError(error, 'create sprint', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
