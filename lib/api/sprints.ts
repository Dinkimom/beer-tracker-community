import type { BurndownDayChangelogItem, OccupancyTaskOrder } from './types';
import type { SprintScoreResponse } from '@/app/api/sprints/[sprintId]/score/route';
import type { SprintTimelineTotals } from '@/lib/burndown/taskChangelogTimeline';
import type {
  BacklogResponse,
  Comment,
  SprintCommentsResponse,
  SprintLinksResponse,
  SprintPositionsResponse,
  SprintsResponse,
  SprintTasksResponse,
  TaskLink,
  TaskPosition,
} from '@/types';

import { getPlannerBeerTrackerApi } from '../plannerBeerTrackerApiOverride';

/**
 * Получает позиции задач в спринте
 */
export async function fetchSprintPositions(sprintId: number): Promise<TaskPosition[]> {
  try {
    const { data }: { data: SprintPositionsResponse } = await getPlannerBeerTrackerApi().get(
      `/sprints/${sprintId}/positions`
    );
    return (data.positions || []).map((pos) => ({
      taskId: pos.task_id,
      assignee: pos.assignee_id,
      startDay: pos.start_day,
      startPart: pos.start_part,
      duration: pos.duration,
      plannedStartDay: pos.planned_start_day ?? undefined,
      plannedStartPart: pos.planned_start_part ?? undefined,
      plannedDuration: pos.planned_duration ?? undefined,
      segments: pos.segments?.map((s) => ({
        startDay: s.start_day,
        startPart: s.start_part,
        duration: s.duration,
      })),
    }));
  } catch (error) {
    console.error(`Failed to fetch positions for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Сохраняет позицию задачи в спринте
 */
export async function saveTaskPosition(
  sprintId: number,
  position: {
    assigneeId: string;
    duration: number;
    devTaskKey?: string;
    isQa?: boolean;
    plannedDuration?: number | null;
    plannedStartDay?: number | null;
    plannedStartPart?: number | null;
    startDay: number;
    startPart: number;
    taskId: string;
    segments?: Array<{ startDay: number; startPart: number; duration: number }>;
  }
): Promise<boolean> {
  try {
    await getPlannerBeerTrackerApi().post(`/sprints/${sprintId}/positions`, position);
    return true;
  } catch (error) {
    console.error(`Failed to save position for task ${position.taskId}:`, error);
    return false;
  }
}

/**
 * Батч сохранение позиций задач в спринте
 * Позволяет сохранить множество позиций одним запросом
 */
export async function saveTaskPositionsBatch(
  sprintId: number,
  positions: Array<{
    assigneeId: string;
    devTaskKey?: string;
    duration: number;
    isQa?: boolean;
    plannedDuration?: number | null;
    plannedStartDay?: number | null;
    plannedStartPart?: number | null;
    startDay: number;
    startPart: number;
    taskId: string;
    segments?: Array<{ startDay: number; startPart: number; duration: number }>;
  }>
): Promise<{ count: number; success: boolean }> {
  try {
    const { data } = await getPlannerBeerTrackerApi().post(
      `/sprints/${sprintId}/positions/batch`,
      { positions }
    );
    return { success: true, count: data.count || positions.length };
  } catch (error) {
    console.error(`Failed to save batch positions for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Загружает позиции по всем указанным спринтам одним запросом.
 * Возвращает массив массивов в том же порядке, что и sprintIds.
 */
export async function fetchSprintPositionsBatch(
  sprintIds: number[]
): Promise<TaskPosition[][]> {
  if (sprintIds.length === 0) return [];
  try {
    const { data } = await getPlannerBeerTrackerApi().get<{
      bySprint: Array<{
        sprintId: number;
        positions: SprintPositionsResponse['positions'];
      }>;
    }>(`/sprints/batch/positions?sprintIds=${sprintIds.join(',')}`);
    return (data.bySprint ?? []).map(({ positions }) =>
      (positions || []).map((pos) => ({
        taskId: pos.task_id,
        assignee: pos.assignee_id,
        startDay: pos.start_day,
        startPart: pos.start_part,
        duration: pos.duration,
        plannedStartDay: pos.planned_start_day ?? undefined,
        plannedStartPart: pos.planned_start_part ?? undefined,
        plannedDuration: pos.planned_duration ?? undefined,
        segments: (pos as { segments?: Array<{ start_day: number; start_part: number; duration: number }> }).segments?.map((s) => ({
          startDay: s.start_day,
          startPart: s.start_part,
          duration: s.duration,
        })),
      }))
    );
  } catch (error) {
    console.error('Failed to fetch batch positions:', error);
    throw error;
  }
}

/**
 * Загружает маппинг taskId → storyKey для всех задач в указанных спринтах.
 * Один запрос вместо N по стори/эпикам.
 */
export async function fetchSprintBatchTaskParents(
  sprintIds: number[]
): Promise<Record<string, string>> {
  if (sprintIds.length === 0) return {};
  try {
    const { data } = await getPlannerBeerTrackerApi().get<{ taskIdToStoryKey: Record<string, string> }>(
      `/sprints/batch/task-parents?sprintIds=${sprintIds.join(',')}`
    );
    return data?.taskIdToStoryKey ?? {};
  } catch (error) {
    console.error('Failed to fetch batch task parents:', error);
    throw error;
  }
}

/**
 * Получает связи задач в спринте
 */
export async function fetchSprintLinks(sprintId: number): Promise<TaskLink[]> {
  try {
    const { data }: { data: SprintLinksResponse } = await getPlannerBeerTrackerApi().get(
      `/sprints/${sprintId}/links`
    );
    return (data.links || []).map((link) => ({
      id: link.id,
      fromTaskId: link.from_task_id,
      toTaskId: link.to_task_id,
      fromAnchor: link.from_anchor as 'bottom' | 'left' | 'right' | 'top' | undefined,
      toAnchor: link.to_anchor as 'bottom' | 'left' | 'right' | 'top' | undefined,
    }));
  } catch (error) {
    console.error(`Failed to fetch links for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Сохраняет связь между задачами в спринте
 */
export async function saveTaskLink(
  sprintId: number,
  link: {
    fromAnchor?: string | null;
    fromTaskId: string;
    id: string;
    toAnchor?: string | null;
    toTaskId: string;
  }
): Promise<boolean> {
  try {
    await getPlannerBeerTrackerApi().post(`/sprints/${sprintId}/links`, link);
    return true;
  } catch (error) {
    console.error(`Failed to save link ${link.id}:`, error);
    return false;
  }
}

/**
 * Батч сохранение связей между задачами в спринте
 * Позволяет сохранить множество связей одним запросом
 */
export async function saveTaskLinksBatch(
  sprintId: number,
  links: Array<{
    fromAnchor?: string | null;
    fromTaskId: string;
    id: string;
    toAnchor?: string | null;
    toTaskId: string;
  }>
): Promise<{ count: number; success: boolean }> {
  try {
    const { data } = await getPlannerBeerTrackerApi().post(
      `/sprints/${sprintId}/links/batch`,
      { links }
    );
    return { success: true, count: data.count || links.length };
  } catch (error) {
    console.error(`Failed to save batch links for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Удаляет связь между задачами в спринте
 */
export async function deleteTaskLink(sprintId: number, linkId: string): Promise<boolean> {
  try {
    await getPlannerBeerTrackerApi().delete(`/sprints/${sprintId}/links?linkId=${linkId}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete link ${linkId}:`, error);
    return false;
  }
}

/**
 * Получает комментарии в спринте
 */
export async function fetchSprintComments(sprintId: number): Promise<Comment[]> {
  try {
    const { data }: { data: SprintCommentsResponse } = await getPlannerBeerTrackerApi().get(
      `/sprints/${sprintId}/comments`
    );
    return (data.comments || []).map((comment) => ({
      id: comment.id,
      assigneeId: comment.assignee_id,
      text: comment.text,
      taskId: comment.task_id ?? undefined,
      x: comment.x ?? 0,
      y: comment.y ?? 0,
      day: comment.day ?? 0,
      part: comment.part ?? 0,
      width: comment.width,
      height: comment.height,
      createdAt: comment.created_at ?? undefined,
    }));
  } catch (error) {
    console.error(`Failed to fetch comments for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Сохраняет комментарий в спринте
 */
export async function saveComment(
  sprintId: number,
  comment: {
    assigneeId: string;
    day?: number | null;
    height: number;
    id?: string;
    part?: number | null;
    text: string;
    taskId?: string | null;
    width: number;
    x?: number | null;
    y?: number | null;
  },
  isUpdate: boolean = false
): Promise<Comment | boolean> {
  try {
    if (isUpdate) {
      try {
        await getPlannerBeerTrackerApi().put(
          `/sprints/${sprintId}/comments?commentId=${comment.id}`,
          comment
        );
      } catch (putError: unknown) {
        const status = (putError as { response?: { status?: number } })?.response?.status;
        if (status === 404) {
          const created = await postCommentAndReturn(sprintId, comment);
          return created ?? true;
        }
        throw putError;
      }
      return true;
    }
    const created = await postCommentAndReturn(sprintId, comment);
    return created ?? true;
  } catch (error) {
    console.error(`Failed to save comment ${comment.id ?? '(new)'}:`, error);
    return false;
  }
}

/** POST комментария без id; возвращает созданный комментарий с id с бэка */
async function postCommentAndReturn(
  sprintId: number,
  comment: {
    assigneeId: string;
    day?: number | null;
    height: number;
    id?: string;
    part?: number | null;
    text: string;
    taskId?: string | null;
    width: number;
    x?: number | null;
    y?: number | null;
  }
): Promise<Comment | null> {
  const { data } = await getPlannerBeerTrackerApi().post<{ comment: CommentFromApi }>(
    `/sprints/${sprintId}/comments`,
    {
      assigneeId: comment.assigneeId,
      text: comment.text,
      taskId: comment.taskId ?? null,
      x: comment.x ?? null,
      y: comment.y ?? null,
      day: comment.day ?? null,
      part: comment.part ?? null,
      width: comment.width,
      height: comment.height,
    }
  );
  if (!data?.comment) return null;
  const c = data.comment;
  return {
    id: c.id,
    assigneeId: c.assignee_id,
    text: c.text,
    taskId: c.task_id ?? undefined,
    x: c.x ?? 0,
    y: c.y ?? 0,
    day: c.day ?? 0,
    part: c.part ?? 0,
    width: c.width,
    height: c.height,
    createdAt: c.created_at ?? undefined,
  };
}

interface CommentFromApi {
  assignee_id: string;
  created_at?: string | null;
  day: number | null;
  height: number;
  id: string;
  part: number | null;
  task_id?: string | null;
  text: string;
  width: number;
  x: number | null;
  y: number | null;
}


/**
 * Удаляет комментарий из спринта
 */
export async function deleteComment(sprintId: number, commentId: string): Promise<boolean> {
  try {
    await getPlannerBeerTrackerApi().delete(`/sprints/${sprintId}/comments?commentId=${commentId}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete comment ${commentId}:`, error);
    return false;
  }
}

/**
 * Обновляет статус спринта
 */
export async function updateSprintStatus(
  sprintId: number,
  status: 'archived' | 'draft' | 'in_progress' | 'released',
  version?: number
): Promise<{ error?: string; sprint?: SprintsResponse; success: boolean }> {
  try {
    const { data: result } = await getPlannerBeerTrackerApi().patch(
      `/sprints/${sprintId}/status`,
      { status, version }
    );
    return { success: true, sprint: result.sprint };
  } catch (error) {
    console.error(`Failed to update sprint ${sprintId} status:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Получает задачи спринта.
 * @param statusFilter — для вкладки «Занятость»: all | active | completed (опционально)
 */
export async function fetchSprintTasks(
  sprintId: number,
  boardId?: number,
  statusFilter?: 'active' | 'all' | 'completed'
): Promise<SprintTasksResponse> {
  try {
    const params = new URLSearchParams({ sprintId: String(sprintId) });
    if (boardId != null) params.set('boardId', String(boardId));
    if (statusFilter && statusFilter !== 'all') params.set('statusFilter', statusFilter);
    const { data } = await getPlannerBeerTrackerApi().get(`/tracker?${params.toString()}`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch tasks for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Удаляет позицию задачи в спринте
 */
export async function deleteTaskPosition(sprintId: number, taskId: string): Promise<boolean> {
  try {
    await getPlannerBeerTrackerApi().delete(`/sprints/${sprintId}/positions?taskId=${taskId}`);
    return true;
  } catch (error) {
    console.error(`Failed to delete position for task ${taskId} in sprint ${sprintId}:`, error);
    return false;
  }
}

/**
 * Очищает все позиции в спринте
 */
export async function clearSprintPositions(sprintId: number): Promise<boolean> {
  try {
    await getPlannerBeerTrackerApi().delete(`/sprints/${sprintId}/positions/clear`);
    return true;
  } catch (error) {
    console.error(`Failed to clear positions in sprint ${sprintId}:`, error);
    return false;
  }
}

/**
 * Очищает все связи в спринте
 */
export async function clearSprintLinks(sprintId: number): Promise<boolean> {
  try {
    await getPlannerBeerTrackerApi().delete(`/sprints/${sprintId}/links/clear`);
    return true;
  } catch (error) {
    console.error(`Failed to clear links in sprint ${sprintId}:`, error);
    return false;
  }
}

/**
 * Получает порядок стори и задач для вкладки «Занятость»
 */
export async function fetchOccupancyTaskOrder(
  sprintId: number
): Promise<OccupancyTaskOrder | null> {
  try {
    const { data } = await getPlannerBeerTrackerApi().get<{ order: OccupancyTaskOrder | null }>(
      `/sprints/${sprintId}/occupancy-task-order`
    );
    return data?.order ?? null;
  } catch (error) {
    console.error(`Failed to fetch occupancy task order for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Получает оценку спринта по командам (цели, SP, QA, итоговая оценка)
 */
export async function fetchSprintScore(sprintId: number): Promise<SprintScoreResponse> {
  try {
    const { data } = await getPlannerBeerTrackerApi().get<SprintScoreResponse>(
      `/sprints/${sprintId}/score`
    );
    return {
      rows: data?.rows ?? [],
      testingFlowMode: data?.testingFlowMode ?? 'unknown',
    };
  } catch (error) {
    console.error(`Failed to fetch sprint score for sprint ${sprintId}:`, error);
    return { rows: [], testingFlowMode: 'unknown' };
  }
}

/**
 * Сохраняет порядок стори и задач для вкладки «Занятость»
 */
export async function saveOccupancyTaskOrder(
  sprintId: number,
  order: OccupancyTaskOrder
): Promise<void> {
  try {
    await getPlannerBeerTrackerApi().put(`/sprints/${sprintId}/occupancy-task-order`, order);
  } catch (error) {
    console.error(`Failed to save occupancy task order for sprint ${sprintId}:`, error);
    throw error;
  }
}

/**
 * Получает задачи бэклога для доски
 */
export async function fetchBacklog(
  boardId: number,
  page: number = 1,
  perPage: number = 50
): Promise<BacklogResponse> {
  try {
    const { data } = await getPlannerBeerTrackerApi().get(
      `/backlog?boardId=${boardId}&page=${page}&perPage=${perPage}`
    );
    return data;
  } catch (error) {
    console.error(`Failed to fetch backlog for board ${boardId}:`, error);
    throw error;
  }
}

/**
 * Получает данные burn-down chart для спринта
 * @param sprintId - ID спринта
 * @param boardId - ID доски (опционально)
 */
export async function fetchBurndownData(
  sprintId: number,
  boardId?: number
): Promise<{
  currentSP: number;
  currentTP: number;
  dataPoints: Array<{
    date: string;
    dateKey: string;
    remainingSP: number;
    remainingTP: number;
  }>;
  dailyChangelog: Record<string, BurndownDayChangelogItem[]>;
  initialSP: number;
  initialTP: number;
  testingFlowMode: 'embedded_in_dev' | 'standalone_qa_tasks' | 'unknown';
  sprintInfo: {
    endDate: string;
    name: string;
    startDate: string;
  };
  sprintTimelineTotals: SprintTimelineTotals;
} | null> {
  try {
    const params = boardId ? { boardId } : {};
    const { data } = await getPlannerBeerTrackerApi().get(`/sprints/${sprintId}/burndown`, {
      params,
    });
    return data;
  } catch (error) {
    console.error(`Failed to fetch burndown data for sprint ${sprintId}:`, error);
    return null;
  }
}
