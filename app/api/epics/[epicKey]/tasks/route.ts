import { NextRequest, NextResponse } from 'next/server';

import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { apiCache, cacheKeys } from '@/lib/cache';
import { resolveParams } from '@/lib/nextjs-utils';
import { fetchChildren, mapTrackerIssueToTask } from '@/lib/trackerApi';

// Кэшируем задачи эпика на 3 минуты
const EPIC_TASKS_CACHE_TTL = 3 * 60; // 3 минуты в секундах

/**
 * GET /api/epics/[epicKey]/tasks
 * Получить все дочерние задачи эпика (как для стори — через Tracker API).
 * Возвращает: задачи напрямую под эпиком + задачи под стори эпика.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ epicKey: string }> | { epicKey: string } }
) {
  try {
    const { epicKey } = await resolveParams(params);

    if (!epicKey) {
      return NextResponse.json(
        { error: 'epicKey is required' },
        { status: 400 }
      );
    }

    const boardIdParam = request.nextUrl.searchParams.get('boardId');
    const boardId = boardIdParam ? parseInt(boardIdParam, 10) : null;

    if (!boardId) {
      const cacheKey = cacheKeys.epicTasks(epicKey);
      const cachedData = apiCache.get<{ tasks: unknown[] }>(cacheKey);
      if (cachedData) {
        return NextResponse.json(cachedData);
      }
      return NextResponse.json(
        { error: 'boardId is required' },
        { status: 400 }
      );
    }

    const cacheKey = cacheKeys.epicTasks(epicKey, boardId);
    const cachedData = apiCache.get<{ tasks: unknown[] }>(cacheKey);

    if (cachedData) {
      return NextResponse.json(cachedData);
    }

    const trackerApiInstance = await getTrackerApiFromRequest(request);
    const issues = await fetchChildren(epicKey, boardId, trackerApiInstance);

    const directTaskIssues = issues.filter(
      (issue) => issue.type?.key === 'task' || issue.type?.key === 'bug'
    );
    const storyIssues = issues.filter((issue) => issue.type?.key === 'story');

    const tasksFromStories: Awaited<ReturnType<typeof mapTrackerIssueToTask>>[] = [];
    for (const story of storyIssues) {
      const storyKey = story.key;
      if (!storyKey) continue;
      try {
        const storyChildren = await fetchChildren(
          storyKey,
          boardId,
          trackerApiInstance
        );
        const storyTaskIssues = storyChildren.filter(
          (issue) => issue.type?.key === 'task' || issue.type?.key === 'bug'
        );
        tasksFromStories.push(...storyTaskIssues.map((issue) => mapTrackerIssueToTask(issue)));
      } catch {
        // ignore per-story errors
      }
    }

    const directTasks = directTaskIssues.map((issue) => mapTrackerIssueToTask(issue));
    const tasks = [...directTasks, ...tasksFromStories];

    const responseData = { tasks };
    apiCache.set(cacheKey, responseData, EPIC_TASKS_CACHE_TTL);

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Error fetching epic tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch epic tasks' },
      { status: 500 }
    );
  }
}
