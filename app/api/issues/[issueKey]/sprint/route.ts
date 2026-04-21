import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { invalidateCache } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';
import {
  AddIssueToSprintSchema,
  UpdateIssueSprintSchema,
  formatValidationError,
  validateRequest,
} from '@/lib/validation';

/**
 * Инвалидирует кэш burndown для массива спринтов
 * Принимает спринты в формате: строки (ID) или объекты с id
 */
function invalidateBurndownForSprints(
  sprints: Array<string | { id: string }>
): void {
  for (const sprint of sprints) {
    const sprintId = typeof sprint === 'string'
      ? parseInt(sprint, 10)
      : parseInt(sprint.id, 10);

    if (!isNaN(sprintId)) {
      invalidateCache.burndown(sprintId);
    }
  }
}

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
    const validation = validateRequest(AddIssueToSprintSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { sprintId } = validation.data;

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    // Получаем текущую задачу и новый спринт параллельно
    const [issueResponse, newSprintResponse] = await Promise.all([
      trackerApi.get(`/issues/${issueKey}`),
      trackerApi.get(`/sprints/${sprintId}`),
    ]);

    const issue = issueResponse.data;
    const newSprint = newSprintResponse.data;

    // Получаем текущие спринты задачи
    const currentSprints = issue.sprint || [];
    const currentSprintIds = currentSprints.map((s: { id: string }) => s.id);

    // Если задача уже в новом спринте, ничего не делаем
    if (currentSprintIds.includes(sprintId.toString())) {
      return NextResponse.json({ success: true });
    }

    // Получаем информацию о доске нового спринта
    const newSprintBoardId = newSprint.board?.id;

    // Если есть текущие спринты, проверяем их доски
    let sprintsToKeep: Array<{ id: string }> = [];

    if (currentSprintIds.length > 0 && newSprintBoardId) {
      // Получаем информацию о всех текущих спринтах параллельно
      const sprintInfoPromises = currentSprintIds.map(async (sprintIdStr: string) => {
        try {
          const { data: sprint } = await trackerApi.get(`/sprints/${sprintIdStr}`);
          return { id: sprintIdStr, boardId: sprint.board?.id };
        } catch {
          return { id: sprintIdStr, boardId: null };
        }
      });

      const sprintInfos = await Promise.all(sprintInfoPromises);

      // Оставляем только спринты с других досок
      sprintsToKeep = sprintInfos
        .filter((info) => info.boardId !== newSprintBoardId)
        .map((info) => ({ id: info.id }));
    }

    // Добавляем новый спринт
    sprintsToKeep.push({ id: sprintId.toString() });

    // Обновляем спринты задачи
    await trackerApi.patch(`/issues/${issueKey}`, {
      sprint: sprintsToKeep,
    });

    // Инвалидируем кэш burndown для всех затронутых спринтов
    invalidateBurndownForSprints([...sprintsToKeep, ...currentSprintIds]);
    if (typeof newSprintBoardId === 'number' && !Number.isNaN(newSprintBoardId)) {
      invalidateCache.backlog(newSprintBoardId);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating issue sprint:', error);
    return NextResponse.json(
      { error: 'Failed to update issue sprint' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueKey: string }> | { issueKey: string } }
) {
  try {
    const { issueKey } = await resolveParams(params);
    const searchParams = request.nextUrl.searchParams;
    const sprintId = searchParams.get('sprintId');

    if (!issueKey) {
      return NextResponse.json(
        { error: 'issueKey is required' },
        { status: 400 }
      );
    }

    if (!sprintId) {
      return NextResponse.json(
        { error: 'sprintId is required' },
        { status: 400 }
      );
    }

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    let backlogBoardIdFromRemovedSprint: number | undefined;
    try {
      const { data: removedSprint } = await trackerApi.get(`/sprints/${sprintId}`);
      const bid = removedSprint.board?.id;
      if (typeof bid === 'number' && !Number.isNaN(bid)) {
        backlogBoardIdFromRemovedSprint = bid;
      }
    } catch {
      /* доска не нужна для patch, только для сброса кэша бэклога */
    }

    // Получаем текущую задачу
    const { data: issue } = await trackerApi.get(`/issues/${issueKey}`);

    // Получаем текущие спринты задачи и удаляем указанный
    const currentSprints = issue.sprint || [];
    const updatedSprints = currentSprints
      .filter((s: { id: string }) => s.id !== sprintId.toString())
      .map((s: { id: string }) => ({ id: s.id }));

    // Обновляем спринты задачи
    await trackerApi.patch(`/issues/${issueKey}`, {
      sprint: updatedSprints,
    });

    // Инвалидируем кэш burndown для удаленного спринта и оставшихся спринтов
    invalidateBurndownForSprints([sprintId, ...updatedSprints]);
    if (backlogBoardIdFromRemovedSprint != null) {
      invalidateCache.backlog(backlogBoardIdFromRemovedSprint);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing issue from sprint:', error);
    return NextResponse.json(
      { error: 'Failed to remove issue from sprint' },
      { status: 500 }
    );
  }
}

export async function PATCH(
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
    const validation = validateRequest(UpdateIssueSprintSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: formatValidationError(validation.error),
        },
        { status: 400 }
      );
    }

    const { sprint } = validation.data;

    // Type guard для проверки типа спринта
    const normalizeSprintId = (s: unknown): { id: string } => {
      if (typeof s === 'string' || typeof s === 'number') {
        return { id: String(s) };
      }
      if (typeof s === 'object' && s !== null && 'id' in s) {
        return { id: String((s as { id: unknown }).id) };
      }
      // Fallback для неожиданных форматов
      throw new Error(`Invalid sprint format: ${JSON.stringify(s)}`);
    };

    // Преобразуем массив спринтов в формат { id: string }[]
    const sprintIds = sprint.map(normalizeSprintId);

    // Создаем Tracker API клиент с токеном из headers
    const trackerApi = await getTrackerApiFromRequest(request);

    // Получаем текущие спринты задачи для инвалидации кэша
    const { data: issue } = await trackerApi.get(`/issues/${issueKey}`);
    const currentSprints = issue.sprint || [];
    const currentSprintIds = currentSprints.map((s: { id: string }) => s.id);

    // Обновляем спринты задачи
    await trackerApi.patch(`/issues/${issueKey}`, {
      sprint: sprintIds,
    });

    // Инвалидируем кэш burndown для всех затронутых спринтов
    invalidateBurndownForSprints([...currentSprintIds, ...sprintIds]);

    const sprintIdsForBoards = new Set<string>([
      ...currentSprintIds,
      ...sprintIds.map((s) => s.id),
    ]);
    const backlogBoards = new Set<number>();
    for (const sid of sprintIdsForBoards) {
      try {
        const { data: sp } = await trackerApi.get(`/sprints/${sid}`);
        const bid = sp.board?.id;
        if (typeof bid === 'number' && !Number.isNaN(bid)) {
          backlogBoards.add(bid);
        }
      } catch {
        /* ignore */
      }
    }
    for (const bid of backlogBoards) {
      invalidateCache.backlog(bid);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating issue sprint:', error);
    return NextResponse.json(
      { error: 'Failed to update issue sprint' },
      { status: 500 }
    );
  }
}
