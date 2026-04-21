import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { CreateIssueSchema, formatValidationError, validateRequest } from '@/lib/validation';

/**
 * Создает новую задачу в Yandex Tracker
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(CreateIssueSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { summary, queue, sprintId, priority, type } = validation.data;

    const requestBody: {
      priority?: string;
      queue: string;
      sprint?: number;
      summary: string;
      type?: string;
    } = {
      summary,
      queue,
    };

    // Добавляем тип задачи, если указан
    if (type) {
      requestBody.type = type;
    }

    // Добавляем приоритет, если указан
    if (priority) {
      requestBody.priority = priority;
    }

    // Добавляем спринт, если указан
    if (sprintId) {
      requestBody.sprint = sprintId;
    }

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    const { data } = await trackerApi.post('/issues', requestBody);

    return NextResponse.json({
      key: data.key,
      id: data.id,
      self: data.self,
    });
  } catch (error) {
    console.error('Error creating issue:', error);
    return NextResponse.json(
      { error: 'Failed to create issue' },
      { status: 500 }
    );
  }
}
