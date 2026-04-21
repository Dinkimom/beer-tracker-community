/**
 * Нормализация changelog/issue для burndown и UI (источник сырья — Tracker API или экспорт).
 */

import type { ChangelogEntry } from '@/types/tracker';

import { issueDataSprintContains } from '@/lib/burndown/sprintMembership';
import { mapStatus } from '@/utils/statusMapper';

/** Нормализованная запись changelog (единый формат) */
interface NormalizedChangelogEntry {
  createdBy?: {
    display?: string;
    id?: string;
  };
  fields?: Array<{
    field: { id: string; display?: string };
    from?: { key?: string; display?: string; id?: string } | null;
    to?: { key?: string; display?: string; id?: string } | null;
  }>;
  id?: string;
  type?: string;
  updatedAt: string;
}

/** Нормализованные данные задачи */
interface NormalizedIssueData {
  key: string;
  statusKey: string;
  storyPoints: number;
  testPoints: number;
}

/** Одна запись changelog для парсинга в burndown (from/to могут быть number, array, object) */
export interface YtrackerBurndownChangelogEntry {
  fields?: Array<{
    field: { id: string; display?: string };
    from?: unknown;
    to?: unknown;
  }>;
  /** Стабильный id записи в Tracker (для порядка при одинаковом updatedAt) */
  id?: string;
  /** IssueUpdated, IssueWorkflow, … — для отладки / будущих правил */
  type?: string;
  updatedAt: string;
}

export interface YtrackerBurndownIssue {
  changelog: Array<{
    date: string;
    isDone: boolean;
  }>;
  /** По актуальному payload задачи: сейчас в этом спринте (если передан sprint при загрузке). */
  inCurrentSprint: boolean;
  issueKey: string;
  rawChangelog: YtrackerBurndownChangelogEntry[];
  statusKey: string;
  storyPoints: number;
  testPoints: number;
}

/**
 * Адаптер: приводит запись changelog к единому формату (camelCase).
 * Поддерживает camelCase и snake_case на входе.
 */
function adaptChangelogEntry(raw: unknown): NormalizedChangelogEntry | null {
  if (!raw || typeof raw !== 'object') return null;

  const entry = raw as Record<string, unknown>;
  const updatedAt =
    (entry.updatedAt as string) ?? (entry.updated_at as string) ?? '';
  if (!updatedAt) return null;

  const fields = entry.fields as NormalizedChangelogEntry['fields'];
  const id = (entry.id as string) ?? (entry.updatedAt as string) ?? '';
  const type = (entry.type as string) ?? 'IssueUpdate';

  // Извлекаем информацию об авторе изменения (updatedBy имеет приоритет, так как это тот, кто сделал изменение)
  const authorRaw = entry.updatedBy ?? entry.updated_by ?? entry.createdBy ?? entry.created_by ?? entry.author;
  const createdBy = authorRaw && typeof authorRaw === 'object' && authorRaw !== null
    ? {
        display: (authorRaw as Record<string, unknown>).display as string | undefined,
        id: (authorRaw as Record<string, unknown>).id as string | undefined,
      }
    : undefined;

  // Нормализуем поля - преобразуем структуру from/to если нужно
  const normalizedFields = Array.isArray(fields)
    ? fields.map((field) => {
        // Если from/to уже в правильном формате, оставляем как есть
        // Иначе преобразуем из простого объекта с key в объект с key, display, id
        const normalizedField = { ...field };
        if (normalizedField.from && typeof normalizedField.from === 'object' && normalizedField.from !== null) {
          const from = normalizedField.from as Record<string, unknown>;
          if (from.key && !from.display) {
            normalizedField.from = {
              key: from.key as string,
              display: from.key as string,
              id: from.id as string || from.key as string,
            };
          }
        }
        if (normalizedField.to && typeof normalizedField.to === 'object' && normalizedField.to !== null) {
          const to = normalizedField.to as Record<string, unknown>;
          if (to.key && !to.display) {
            normalizedField.to = {
              key: to.key as string,
              display: to.key as string,
              id: to.id as string || to.key as string,
            };
          }
        }
        return normalizedField;
      })
    : undefined;

  return {
    fields: normalizedFields,
    updatedAt,
    id,
    type,
    createdBy,
  };
}

/**
 * Адаптер: приводит issue_data к единому формату.
 * Поддерживает camelCase и snake_case на входе.
 */
function adaptIssueData(raw: unknown): NormalizedIssueData {
  if (!raw || typeof raw !== 'object') {
    return { key: '', storyPoints: 0, testPoints: 0, statusKey: '' };
  }

  const data = raw as Record<string, unknown>;
  const key =
    (data.key as string) || (data.id as string) || '';
  const storyPoints =
    (data.storyPoints as number) ?? (data.story_points as number) ?? 0;
  const testPoints =
    (data.testPoints as number) ?? (data.test_points as number) ?? 0;

  let statusKey = '';
  const status = data.status as Record<string, string> | undefined;
  if (status) {
    statusKey = status.key ?? status.display ?? '';
  }

  return { key, storyPoints, testPoints, statusKey };
}

function isDoneStatus(statusKey: string | undefined): boolean {
  if (!statusKey) return false;
  return mapStatus(statusKey.toLowerCase()) === 'done';
}

function processChangelogToDoneEvents(
  entries: NormalizedChangelogEntry[]
): Array<{ date: string; isDone: boolean }> {
  const events: Array<{ date: string; isDone: boolean }> = [];

  for (const entry of entries) {
    if (!entry.fields) continue;

    for (const field of entry.fields) {
      if (field?.field?.id === 'status') {
        const fromKey = field.from?.key;
        const toKey = field.to?.key;
        const fromIsDone = isDoneStatus(fromKey);
        const toIsDone = isDoneStatus(toKey);

        if (fromIsDone !== toIsDone) {
          events.push({ date: entry.updatedAt, isDone: toIsDone });
        }
      }
    }
  }

  return events;
}

/** Нормализует value (число или объект с key/display) в формат поля ChangelogEntry */
function toChangelogFieldValue(
  v: unknown
): { id: string; key: string; display: string } | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') {
    const s = String(v);
    return { id: s, key: s, display: s };
  }
  if (typeof v === 'object' && v !== null && 'key' in v) {
    const o = v as Record<string, unknown>;
    const key = String(o.key ?? o.display ?? '');
    return { id: String(o.id ?? key), key, display: String(o.display ?? key) };
  }
  return null;
}

/**
 * Преобразует NormalizedChangelogEntry в ChangelogEntry
 * Включает изменения статусов, storyPoints и testPoints (для отображения переоценок в таймлайне)
 */
function normalizeToChangelogEntry(entry: NormalizedChangelogEntry): ChangelogEntry | null {
  const allowedIds = new Set(['status', 'storyPoints', 'testPoints']);
  const relevantFields = entry.fields?.filter((f) => f?.field?.id && allowedIds.has(f.field.id));
  if (!relevantFields || relevantFields.length === 0) return null;

  const fields = relevantFields.map((field) => ({
    field: {
      id: field.field.id,
      display: field.field.display || field.field.id,
    },
    from: toChangelogFieldValue(field.from),
    to: toChangelogFieldValue(field.to),
  }));

  return {
    id: entry.id || entry.updatedAt,
    type: entry.type || 'IssueUpdate',
    updatedAt: entry.updatedAt,
    createdBy: entry.createdBy,
    fields,
  };
}

/**
 * Сырой массив issue_logs (ответ changelog Tracker) → записи для UI.
 */
export function changelogEntriesFromRawIssueLogs(rawLogs: unknown): ChangelogEntry[] {
  const arr = Array.isArray(rawLogs) ? rawLogs : [];
  const normalizedEntries = arr
    .map(adaptChangelogEntry)
    .filter((e): e is NormalizedChangelogEntry => e !== null)
    .sort(
      (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );
  return normalizedEntries
    .map(normalizeToChangelogEntry)
    .filter((e): e is ChangelogEntry => e !== null);
}

export interface FetchBurndownIssuesSprintContext {
  sprintId?: string;
  /** Название спринта как в Tracker (сопоставление с полем sprint в payload) */
  sprintName: string;
}

/**
 * Собирает {@link YtrackerBurndownIssue} из актуального payload задачи и сырого changelog (массив как у Tracker API).
 */
export function buildYtrackerBurndownIssueFromIssuePayloadAndLogs(
  issuePayload: unknown,
  rawLogs: unknown,
  sprint: FetchBurndownIssuesSprintContext | undefined,
  fallbackIssueKey: string
): YtrackerBurndownIssue {
  const issueData = adaptIssueData(issuePayload);
  const inCurrentSprint = sprint
    ? issueDataSprintContains(issuePayload, sprint.sprintName, sprint.sprintId)
    : true;
  const rawLogsArr = Array.isArray(rawLogs) ? rawLogs : [];
  const normalizedEntries = rawLogsArr
    .map(adaptChangelogEntry)
    .filter((e): e is NormalizedChangelogEntry => e !== null)
    .sort(
      (a, b) =>
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
    );
  const changelog = processChangelogToDoneEvents(normalizedEntries);
  const rawChangelog: YtrackerBurndownChangelogEntry[] = normalizedEntries.map((e) => ({
    id: e.id,
    type: e.type,
    updatedAt: e.updatedAt,
    fields: e.fields?.map((f) => ({
      field: f.field,
      from: (f as { from?: unknown }).from,
      to: (f as { to?: unknown }).to,
    })),
  }));

  return {
    issueKey: issueData.key || fallbackIssueKey,
    storyPoints: issueData.storyPoints,
    testPoints: issueData.testPoints,
    statusKey: issueData.statusKey,
    changelog,
    rawChangelog,
    inCurrentSprint,
  };
}
