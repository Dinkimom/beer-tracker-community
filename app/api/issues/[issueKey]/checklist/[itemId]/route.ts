import { NextRequest, NextResponse } from 'next/server';

import { handleApiError, TRACKER_UPSTREAM_FORWARD_STATUSES } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { invalidateCache } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';
import { UpdateChecklistItemSchema, formatValidationError, validateRequest } from '@/lib/validation';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string; itemId: string }> | { issueKey: string; itemId: string } }
) {
  try {
    const { issueKey, itemId } = await resolveParams(params);

    if (!issueKey || !itemId) {
      return NextResponse.json(
        { error: 'issueKey and itemId are required' },
        { status: 400 }
      );
    }

    const body = await request.json();

    // Валидация через Zod
    const validation = validateRequest(UpdateChecklistItemSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { checked, text } = validation.data;
    const updateBody: { checked?: boolean; text?: string } = {};

    if (checked !== undefined) {
      updateBody.checked = checked;
    }
    if (text !== undefined) {
      updateBody.text = text;
    }

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    await trackerApi.patch(`/issues/${issueKey}/checklistItems/${itemId}`, updateBody);

    invalidateCache.issueFull(issueKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'update checklist item', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string; itemId: string }> | { issueKey: string; itemId: string } }
) {
  try {
    const { issueKey, itemId } = await resolveParams(params);

    if (!issueKey || !itemId) {
      return NextResponse.json(
        { error: 'issueKey and itemId are required' },
        { status: 400 }
      );
    }

    const trackerApi = await getTrackerApiFromRequest(request);

    await trackerApi.delete(`/issues/${issueKey}/checklistItems/${itemId}`);

    invalidateCache.issueFull(issueKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, 'delete checklist item', {
      forwardStatuses: TRACKER_UPSTREAM_FORWARD_STATUSES,
    });
  }
}
