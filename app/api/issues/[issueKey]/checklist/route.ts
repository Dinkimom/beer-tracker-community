import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, TRACKER_UPSTREAM_FORWARD_STATUSES } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { invalidateCache } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchIssueChecklist } from '@/lib/trackerApi';
import {
  AddChecklistItemSchema,
  UpdateChecklistOrderSchema,
  formatValidationError,
  validateRequest,
} from '@/lib/validation';

/**
 * Добавляет новый элемент в чеклист задачи
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(AddChecklistItemSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { text, checked = false } = validation.data;

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    const { data } = await trackerApi.post(
      `/issues/${issueKey}/checklistItems`,
      {
        text,
        checked,
      }
    );

    invalidateCache.issueFull(issueKey);
    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'add checklist item', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

/**
 * Получает список элементов чеклиста задачи
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    // Загружаем чеклист из Tracker API
    const trackerApi = await getTrackerApiFromRequest(request);
    const checklistItems = await fetchIssueChecklist(issueKey, trackerApi);

    return NextResponse.json(checklistItems);
  } catch (error) {
    return handleApiError(error, 'fetch checklist items', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

/**
 * Обновляет порядок элементов в чеклисте
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(UpdateChecklistOrderSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { items } = validation.data;

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    const { data } = await trackerApi.put(
      `/issues/${issueKey}/checklistItems`,
      items
    );

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error, 'update checklist order', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

/**
 * Удаляет все элементы чеклиста
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    await trackerApi.delete(`/issues/${issueKey}/checklistItems`);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'delete checklist', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
