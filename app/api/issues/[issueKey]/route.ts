import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/lib/api-error-handler';
import { requireTenantContext } from '@/lib/api-tenant';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { getRouteParam } from '@/lib/api-utils';
import { apiCache, cacheKeys } from '@/lib/cache';
import { findIssueSnapshot } from '@/lib/snapshots';
import { fetchIssueChecklist, fetchIssueFromTracker } from '@/lib/trackerApi';
import {
  IssueKeyParamSchema,
  UpdateIssueSchema,
  formatValidationError,
  validateRequest,
} from '@/lib/validation';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const issueKey = await getRouteParam(params, 'issueKey');

    const validation = validateRequest(IssueKeyParamSchema, { issueKey });

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const validIssueKey = validation.data.issueKey;

    const tenantResult = await requireTenantContext(request);
    if (!('ctx' in tenantResult)) {
      return tenantResult.response;
    }
    const organizationId = tenantResult.ctx.organizationId;

    const cacheKey = cacheKeys.issueDetail(organizationId, validIssueKey);
    const cachedData = apiCache.get<unknown>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const trackerApi = await getTrackerApiFromRequest(request);
    const snapshotRow = await findIssueSnapshot(organizationId, validIssueKey);
    let issue = snapshotRow?.payload ?? null;

    // Если снимка ещё нет (например, только что создана), запрашиваем напрямую из Tracker
    if (!issue) {
      issue = await fetchIssueFromTracker(validIssueKey, trackerApi);
      if (!issue) {
        return NextResponse.json(
          { error: 'Issue not found' },
          { status: 404 }
        );
      }
    }

    // Загружаем чеклист из Tracker API
    const checklistItems = await fetchIssueChecklist(validIssueKey, trackerApi);
    const checklistDone = checklistItems.filter(item => item.checked).length;
    const checklistTotal = checklistItems.length;

    const statusKey = issue.status?.key || issue.statusType?.key || null;

    const responseData = {
      description: issue.description || null,
      checklistItems,
      checklistDone,
      checklistTotal,
      status: issue.status || null,
      // Возвращаем полную информацию о задаче для обновления статуса
      key: issue.key,
      summary: issue.summary,
      statusKey,
      originalStatus: statusKey,
    };

    // Сохраняем в кэш
    apiCache.set(cacheKey, responseData, 60); // 1 минута

    return NextResponse.json(responseData);
  } catch (error) {
    return handleApiError(error, 'fetch issue');
  }
}

/**
 * Обновляет задачу (например, название, описание)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const issueKey = await getRouteParam(params, 'issueKey');

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(UpdateIssueSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { summary, description } = validation.data;
    const updateBody: { description?: string; summary?: string } = {};

    if (summary !== undefined) {
      updateBody.summary = summary;
    }
    if (description !== undefined) {
      updateBody.description = description;
    }

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    const { data } = await trackerApi.patch(`/issues/${issueKey}`, updateBody);

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating issue:', error);
    return NextResponse.json(
      { error: 'Failed to update issue' },
      { status: 500 }
    );
  }
}
