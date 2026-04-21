import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { invalidateCache } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';

// Поля, которые Tracker принимает в теле _execute (комментарий, резолюция и др.)
interface TransitionBody {
  comment?: string;
  resolution?: string;
  [key: string]: unknown;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);
    const body = await request.json();
    const { transitionId } = body;

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    if (!transitionId) {
      return NextResponse.json(
        { error: 'transitionId is required' },
        { status: 400 }
      );
    }

    // Подготавливаем тело запроса: resolution, comment и прочие поля для экрана перехода
    const transitionBody: TransitionBody = { ...body };
    delete transitionBody.transitionId;

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    // Получаем информацию о задаче для определения спринтов
    const { data: issue } = await trackerApi.get(`/issues/${issueKey}`);
    const sprints = issue.sprint || [];
    const sprintIds = Array.isArray(sprints)
      ? sprints.map((s: string | { id: string }) =>
          typeof s === 'string' ? parseInt(s, 10) : parseInt(s.id, 10)
        ).filter((id: number) => !isNaN(id))
      : [];

    // Выполняем переход через transitions API (v3)
    const v3Url = `https://api.tracker.yandex.net/v3/issues/${issueKey}/transitions/${transitionId}/_execute`;
    await trackerApi.post(v3Url, transitionBody);

    // Инвалидируем кэш burndown для всех спринтов, содержащих эту задачу
    for (const sprintId of sprintIds) {
      invalidateCache.burndown(sprintId);
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const err = error as { response?: { status?: number; data?: { errorMessages?: string[] } } };
    const status = err?.response?.status;
    const data = err?.response?.data;
    console.error('Error updating issue status:', { status, data, message: (error as Error)?.message });
    if (status === 422 && data?.errorMessages) {
      return NextResponse.json(
        { error: 'Transition requires fields', errorMessages: data.errorMessages },
        { status: 422 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to update issue status', details: data },
      { status: status && status >= 400 && status < 600 ? status : 500 }
    );
  }
}

