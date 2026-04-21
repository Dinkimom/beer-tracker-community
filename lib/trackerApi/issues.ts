/**
 * Tracker API: задачи, поиск, маппинг (только сервер).
 */

import type { TrackerIntegrationStored } from '@/lib/trackerIntegration';
import type { Task, Developer } from '@/types';
import type { ChecklistItem, SprintObject, TrackerIssue } from '@/types/tracker';
import type { AxiosInstance } from 'axios';

import {
  issuePayloadIsBacklogBySprint,
  issuePayloadMatchesStatusExclusion,
} from '@/lib/snapshots/backlogPayload';
import { applyTrackerIntegrationToTask } from '@/lib/trackerIntegration';
import { mapStatus } from '@/utils/statusMapper';

import { requireTrackerAxiosForApiRoute } from '../trackerAxiosFactory';

/**
 * Верхняя граница `perPage` для `POST /issues/_search` с `expand=links`.
 * Страницы 300+ часто получают 504 Gateway Timeout на стороне шлюза Трекера.
 */
export const TRACKER_ISSUES_SEARCH_PER_PAGE_CAP = 100;

/**
 * Дата/время для фильтров Tracker API v3 (как в теле задачи: `2017-07-18T13:33:44.291+0000`).
 */
export function formatTrackerApiDateTimeUtc(d: Date): string {
  return d.toISOString().replace(/\.(\d{3})Z$/, '.$1+0000');
}

function mapTeam(functionalTeam?: string): 'Back' | 'DevOps' | 'QA' | 'Web' {
  const teamStr = (functionalTeam || '').toLowerCase();

  if (teamStr.includes('backend') || teamStr.includes('back')) {
    return 'Back';
  }
  if (
    teamStr.includes('frontend') ||
    teamStr.includes('vue') ||
    teamStr.includes('angular')
  ) {
    return 'Web';
  }
  if (teamStr.includes('qa') || teamStr.includes('tester')) {
    return 'QA';
  }
  if (teamStr.includes('devops')) {
    return 'DevOps';
  }

  return 'Back';
}

function isSprintObject(value: unknown): value is SprintObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'display' in value
  );
}

function isSprintString(value: unknown): value is string {
  return typeof value === 'string';
}

function isSprintArray(value: unknown): value is Array<SprintObject | string> {
  return Array.isArray(value);
}

function normalizeSprintField(
  sprint: TrackerIssue['sprint']
): Array<{ display: string; id: string }> | undefined {
  if (!sprint) {
    return undefined;
  }

  if (isSprintArray(sprint)) {
    return sprint.map((s) => {
      if (isSprintString(s)) {
        return { id: s, display: s };
      }
      if (isSprintObject(s)) {
        return { id: s.id, display: s.display };
      }
      return { id: String(s), display: String(s) };
    });
  }

  if (isSprintObject(sprint)) {
    return [{ id: sprint.id, display: sprint.display }];
  }

  if (isSprintString(sprint)) {
    return [{ id: sprint, display: sprint }];
  }

  return undefined;
}

function parseIncidentSeverity(
  v: string | { display?: string; key?: string } | undefined
): string | undefined {
  if (!v) return undefined;
  return typeof v === 'string' ? v : v.display ?? v.key ?? undefined;
}

function mapTrackerIssueToTaskBase(issue: TrackerIssue): Task {
  const statusKey = issue.status?.key || issue.statusType?.key;
  const team = mapTeam(issue.functionalTeam);

  const parent = issue.parent
    ? {
        id: issue.parent.id,
        key: issue.parent.key,
        display: issue.parent.display,
        self: issue.parent.self,
      }
    : undefined;

  const epic = issue.epic
    ? {
        id: issue.epic.id,
        key: issue.epic.key,
        display: issue.epic.display,
        self: issue.epic.self,
      }
    : undefined;

  const sprints = normalizeSprintField(issue.sprint);

  return {
    id: issue.key,
    name: issue.summary,
    // Поле MergeRequestLink приходит из Tracker как кастомное поле
    MergeRequestLink: issue.MergeRequestLink,
    link: `https://tracker.yandex.ru/${issue.key}`,
    description: issue.description,
    createdAt: issue.createdAt,
    storyPoints:
      issue.storyPoints !== undefined && issue.storyPoints !== null
        ? issue.storyPoints
        : undefined,
    testPoints:
      issue.testPoints !== undefined && issue.testPoints !== null
        ? issue.testPoints
        : undefined,
    team,
    assignee: issue.assignee?.id,
    assigneeName: issue.assignee?.display,
    qaEngineer: issue.qaEngineer?.id,
    qaEngineerName: issue.qaEngineer?.display,
    status: statusKey ? mapStatus(statusKey) : undefined,
    originalStatus: statusKey,
    priority: issue.priority?.key || issue.priority?.display,
    type: issue.type?.key || issue.type?.display || 'task',
    parent,
    epic,
    functionalTeam: issue.functionalTeam || undefined,
    productTeam:
      issue.bizErpTeam && issue.bizErpTeam.length > 0 ? issue.bizErpTeam : undefined,
    stage: issue.stage || undefined,
    sprints,
    incidentSeverity: parseIncidentSeverity(
      (issue as { incidentSeverity?: string | { display?: string; key?: string } }).incidentSeverity
    ),
  };
}

/**
 * Issue → Task. Без `integration` — прежнее поведение; с конфигом организации — поверх базового маппинга.
 */
export function mapTrackerIssueToTask(
  issue: TrackerIssue,
  integration?: TrackerIntegrationStored | null
): Task {
  const base = mapTrackerIssueToTaskBase(issue);
  return applyTrackerIntegrationToTask(issue, base, integration ?? null);
}

const SEARCH_PER_PAGE = 300;

/**
 * Задачи с датой обновления в полуинтервале [since, until] (UTC).
 * В v3 для поля типа datetime нужен объект `{ from, to }`, а не строка диапазона (иначе 422).
 * Останавливается на maxIssues; при достижении лимита при наличии ещё страниц — truncated: true.
 */
export async function fetchIssuesUpdatedInRange(
  axiosInstance: AxiosInstance,
  since: Date,
  until: Date,
  options?: { maxIssues?: number; perPage?: number }
): Promise<{ issues: TrackerIssue[]; truncated: boolean }> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const maxIssues = options?.maxIssues ?? 10_000;
  const perPage = Math.min(
    Math.max(options?.perPage ?? TRACKER_ISSUES_SEARCH_PER_PAGE_CAP, 1),
    TRACKER_ISSUES_SEARCH_PER_PAGE_CAP
  );

  const collected: TrackerIssue[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data, headers } = await api.post<TrackerIssue[]>(
      `/issues/_search?expand=links&perPage=${perPage}&page=${page}`,
      {
        filter: {
          updatedAt: {
            from: formatTrackerApiDateTimeUtc(since),
            to: formatTrackerApiDateTimeUtc(until),
          },
        },
        order: '+updatedAt',
      }
    );
    const batch = data ?? [];
    for (const issue of batch) {
      if (collected.length >= maxIssues) {
        return { issues: collected, truncated: true };
      }
      collected.push(issue);
    }
    totalPages = headers['x-total-pages']
      ? parseInt(String(headers['x-total-pages']), 10)
      : 1;
    page += 1;
  } while (page <= totalPages);

  return { issues: collected, truncated: false };
}

export interface FetchAllIssuesOnBoardCheckpoint {
  boardId: number;
  page: number;
  totalIssues: number;
  totalPages: number;
}

/**
 * Все задачи на доске (query `boards: <id>`), с пагинацией. Для initial_full / full_rescan.
 */
export async function fetchAllIssuesOnBoard(
  boardId: number,
  axiosInstance: AxiosInstance,
  options?: {
    maxTotalIssues?: number;
    onCheckpoint?: (
      info: FetchAllIssuesOnBoardCheckpoint
    ) => Promise<void> | void;
    perPage?: number;
    queryExtra?: string;
  }
): Promise<{ issues: TrackerIssue[]; truncated: boolean }> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const maxTotal = options?.maxTotalIssues ?? Number.POSITIVE_INFINITY;
  if (maxTotal <= 0) {
    return { issues: [], truncated: true };
  }
  const perPage = Math.min(
    Math.max(options?.perPage ?? TRACKER_ISSUES_SEARCH_PER_PAGE_CAP, 1),
    TRACKER_ISSUES_SEARCH_PER_PAGE_CAP
  );
  const queryString =
    options?.queryExtra != null && options.queryExtra.trim() !== ''
      ? `boards: ${boardId} AND (${options.queryExtra})`
      : `boards: ${boardId}`;

  const collected: TrackerIssue[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data, headers } = await api.post<TrackerIssue[]>(
      `/issues/_search?expand=links&perPage=${perPage}&page=${page}`,
      { query: queryString }
    );
    const batch = data ?? [];
    totalPages = headers['x-total-pages']
      ? parseInt(String(headers['x-total-pages']), 10)
      : 1;

    for (const issue of batch) {
      if (collected.length >= maxTotal) {
        return { issues: collected, truncated: true };
      }
      collected.push(issue);
    }

    await options?.onCheckpoint?.({
      boardId,
      page,
      totalIssues: collected.length,
      totalPages,
    });

    page += 1;
  } while (page <= totalPages);

  return { issues: collected, truncated: false };
}

/**
 * Одна страница бэклога доски из Яндекс Трекера (`POST /issues/_search`, query language).
 * Как колонка «вне спринта» в UI: все типы на доске без спринта; не фильтруем по Type (story, epic и т.д. тоже).
 * Исключаем только closed (как снимки PG) и перепроверяем отсутствие спринта в payload.
 */
export async function fetchBoardBacklogIssuesPageFromTracker(
  boardId: number,
  axiosInstance: AxiosInstance,
  params: { page: number; perPage: number }
): Promise<{ issues: TrackerIssue[]; totalPages: number; totalCount: number }> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const perPage = Math.min(
    Math.max(params.perPage, 1),
    TRACKER_ISSUES_SEARCH_PER_PAGE_CAP
  );
  const page = Math.max(1, params.page);
  const queryString = `boards: ${boardId} AND Sprint: empty()`;
  const { data, headers } = await api.post<TrackerIssue[]>(
    `/issues/_search?expand=links&perPage=${perPage}&page=${page}`,
    { query: queryString }
  );
  const raw = data ?? [];
  const issues = raw.filter(
    (issue) =>
      issuePayloadMatchesStatusExclusion(issue) && issuePayloadIsBacklogBySprint(issue)
  );
  const totalPages = Math.max(1, parseInt(String(headers['x-total-pages'] ?? '1'), 10) || 1);
  const totalCount = parseInt(String(headers['x-total-count'] ?? String(issues.length)), 10) || issues.length;
  return { issues, totalPages, totalCount };
}

export async function fetchTrackerIssues(
  sprintId: number,
  axiosInstance?: AxiosInstance
): Promise<TrackerIssue[]> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const allIssues: TrackerIssue[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data, headers } = await api.post<TrackerIssue[]>(
      `/issues/_search?expand=links&perPage=${SEARCH_PER_PAGE}&page=${page}`,
      {
        filter: {
          sprint: [{ id: sprintId.toString() }],
        },
      }
    );
    allIssues.push(...(data ?? []));
    totalPages = headers['x-total-pages']
      ? parseInt(String(headers['x-total-pages']), 10)
      : 1;
    page += 1;
  } while (page <= totalPages);

  return allIssues;
}

/**
 * Все задачи (task/bug) в спринте с полем parent — для маппинга taskId → storyKey.
 * С пагинацией. Используем filter (как fetchTrackerIssues), тип отфильтруем на нашей стороне.
 */
export async function fetchTasksInSprintWithParents(
  sprintId: number,
  axiosInstance?: AxiosInstance
): Promise<TrackerIssue[]> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const allIssues: TrackerIssue[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data, headers } = await api.post<TrackerIssue[]>(
      `/issues/_search?expand=links&perPage=${SEARCH_PER_PAGE}&page=${page}`,
      {
        filter: {
          sprint: [{ id: sprintId.toString() }],
        },
      }
    );
    const taskOrBug = (data ?? []).filter(
      (issue) => issue.type?.key === 'task' || issue.type?.key === 'bug'
    );
    allIssues.push(...taskOrBug);
    totalPages = headers['x-total-pages']
      ? parseInt(String(headers['x-total-pages']), 10)
      : 1;
    page += 1;
  } while (page <= totalPages);

  return allIssues;
}

export async function fetchChildren(
  parentKey: string,
  boardId: number,
  axiosInstance?: AxiosInstance
): Promise<TrackerIssue[]> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const queryString = `boards: ${boardId} AND (type: task OR type: bug OR type: story) AND "Is Subtask For": ${parentKey}`;

  try {
    const allIssues: TrackerIssue[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const { data, headers } = await api.post<TrackerIssue[]>(
        `/issues/_search?expand=links&perPage=${SEARCH_PER_PAGE}&page=${page}`,
        { query: queryString }
      );
      allIssues.push(...data);
      totalPages = headers['x-total-pages']
        ? parseInt(String(headers['x-total-pages']), 10)
        : 1;
      page += 1;
    } while (page <= totalPages);

    return allIssues;
  } catch (error) {
    console.error('[fetchChildren] Error fetching children:', {
      parentKey,
      boardId,
      query: queryString,
      error: error instanceof Error ? error.message : String(error),
      response: (error as { response?: { data?: unknown } })?.response?.data,
    });
    throw error;
  }
}

export async function fetchEpicStories(
  epicKey: string,
  boardId: number,
  axiosInstance?: AxiosInstance
): Promise<TrackerIssue[]> {
  const api = requireTrackerAxiosForApiRoute(axiosInstance);
  const allIssues: TrackerIssue[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const { data, headers } = await api.post<TrackerIssue[]>(
      `/issues/_search?expand=links&perPage=${SEARCH_PER_PAGE}&page=${page}`,
      {
        query: `boards: ${boardId} AND type: story AND "Is Subtask For": ${epicKey}`,
      }
    );
    allIssues.push(...data);
    totalPages = headers['x-total-pages']
      ? parseInt(String(headers['x-total-pages']), 10)
      : 1;
    page += 1;
  } while (page <= totalPages);

  return allIssues;
}

export async function updateIssueAssignee(
  issueKey: string,
  assigneeId: string,
  axiosInstance?: AxiosInstance,
  isQa?: boolean,
  /** Если задано — вместо стандартных assignee / qaEngineer (кастомные поля из интеграции). */
  assigneePatch?: Record<string, unknown>
): Promise<boolean> {
  try {
    const api = requireTrackerAxiosForApiRoute(axiosInstance);
    const payload =
      assigneePatch ??
      (isQa ? { qaEngineer: { id: assigneeId } } : { assignee: { id: assigneeId } });
    await api.patch(`/issues/${issueKey}`, payload);
    return true;
  } catch (error) {
    const field = isQa ? 'qaEngineer' : 'assignee';
    console.error(`[updateIssueAssignee] Failed to update ${field} for ${issueKey}:`, error);
    return false;
  }
}

export function extractDevelopers(issues: TrackerIssue[]): Developer[] {
  const developersMap = new Map<
    string,
    { id: string; name: string; role: 'developer' | 'tester' }
  >();

  issues.forEach((issue) => {
    if (issue.assignee) {
      const assigneeId = issue.assignee.id;
      if (!developersMap.has(assigneeId)) {
        developersMap.set(assigneeId, {
          id: assigneeId,
          name: issue.assignee.display,
          role: 'developer',
        });
      }
    }

    if (issue.qaEngineer) {
      const qaEngineerId = issue.qaEngineer.id;
      if (!developersMap.has(qaEngineerId)) {
        developersMap.set(qaEngineerId, {
          id: qaEngineerId,
          name: issue.qaEngineer.display,
          role: 'tester',
        });
      }
    }
  });

  return Array.from(developersMap.values());
}

export async function fetchIssueFromTracker(
  issueKey: string,
  axiosInstance?: AxiosInstance
): Promise<TrackerIssue | null> {
  try {
    const api = requireTrackerAxiosForApiRoute(axiosInstance);
    const { data } = await api.get<TrackerIssue>(`/issues/${issueKey}`);
    return data ?? null;
  } catch (error) {
    console.error(`Failed to fetch issue ${issueKey} from Tracker:`, error);
    return null;
  }
}

export async function fetchIssueChecklist(
  issueKey: string,
  axiosInstance?: AxiosInstance
): Promise<ChecklistItem[]> {
  try {
    const api = requireTrackerAxiosForApiRoute(axiosInstance);
    const { data } = await api.get<ChecklistItem[]>(
      `/issues/${issueKey}/checklistItems`
    );
    return data || [];
  } catch (error) {
    console.error(`Failed to fetch checklist for issue ${issueKey}:`, error);
    return [];
  }
}
