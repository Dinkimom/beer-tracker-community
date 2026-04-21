import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { invalidateCache } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';
import { buildIssueWorkEstimatePatch } from '@/lib/trackerIntegration/buildIssueWorkPatch';
import { loadTrackerIntegrationForRequest } from '@/lib/trackerIntegration/loadIntegrationForRequest';

// Интерфейс для данных обновления
interface UpdateData {
  storyPoints?: number | null;
  testPoints?: number | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);
    const body = await request.json();
    const { storyPoints, testPoints } = body;

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    // Подготавливаем данные для обновления
    const estimates: UpdateData = {};

    if (storyPoints !== undefined) {
      estimates.storyPoints = storyPoints;
    }

    if (testPoints !== undefined) {
      estimates.testPoints = testPoints;
    }

    if (estimates.storyPoints === undefined && estimates.testPoints === undefined) {
      return NextResponse.json(
        { error: 'storyPoints or testPoints is required' },
        { status: 400 }
      );
    }

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);
    const integration = await loadTrackerIntegrationForRequest(request);
    const patchBody = buildIssueWorkEstimatePatch(integration, estimates);

    // Получаем информацию о задаче для определения спринтов
    const { data: issue } = await trackerApi.get(`/issues/${issueKey}`);
    const sprints = issue.sprint || [];
    const sprintIds = Array.isArray(sprints)
      ? sprints.map((s: string | { id: string }) =>
          typeof s === 'string' ? parseInt(s, 10) : parseInt(s.id, 10)
        ).filter((id: number) => !isNaN(id))
      : [];

    // Обновляем задачу (имена полей — из интеграции или storyPoints / testPoints)
    await trackerApi.patch(`/issues/${issueKey}`, patchBody);

    // Инвалидируем кэш burndown для всех спринтов, содержащих эту задачу
    // (изменение story points/test points влияет на burndown)
    for (const sprintId of sprintIds) {
      invalidateCache.burndown(sprintId);
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Error updating issue work:', error);
    return NextResponse.json(
      { error: 'Failed to update issue work' },
      { status: 500 }
    );
  }
}
