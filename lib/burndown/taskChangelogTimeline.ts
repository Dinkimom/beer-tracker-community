/**
 * Разбор raw changelog одной задачи в события по календарным дням
 * (добавление/снятие со спринта, переоценка SP/TP, смены статусов).
 * Логика полей согласована с {@link ./burndownFromChangelogReplay}.
 */

import type { YtrackerBurndownChangelogEntry, YtrackerBurndownIssue } from '@/lib/ytrackerRawIssues';

import { mapStatus } from '@/utils/statusMapper';

import {
  applyBurndownEvent,
  buildTaskStateAtSprintStart,
  type BurndownEvent,
  extractStatusKey,
  toBurndownDateKey,
  type TaskState,
} from './burndownFromChangelogReplay';
import { sprintArrayContainsSprint } from './sprintMembership';

export type TaskChangelogTimelineItem =
  { type: 'reestimated'; issueKey: string; deltaSP: number; deltaTP: number } | { type: 'sprint_added'; issueKey: string } | { type: 'sprint_removed'; issueKey: string } | { type: 'status_change'; issueKey: string; fromKey?: string; toKey?: string };

/**
 * Одна задача за календарный день: все события по времени (по записям changelog).
 * Итог дня для задачи — это упорядоченный {@link events}; для компактного вида см. rollup-функции.
 */
export interface TaskChangelogDayTaskRollup {
  events: TaskChangelogTimelineItem[];
  issueKey: string;
}

export interface TaskChangelogDay {
  /** YYYY-MM-DD */
  dateKey: string;
  /** По одной группе на задачу за день; порядок групп — по времени первой записи дня по задаче */
  tasks: TaskChangelogDayTaskRollup[];
}

export interface BuildTaskChangelogTimelineOptions {
  sprintId?: string;
  sprintName: string;
  windowEndMs?: number;
  /** Если задано — только записи с updatedAt в [windowStartMs, windowEndMs] */
  windowStartMs?: number;
}

/** Итоги по SP/TP после реплея событий таймлайна (для API и согласования с линией бёрндауна). */
export interface SprintTimelineTotals {
  doneSP: number;
  doneTP: number;
  remainingSP: number;
  remainingTP: number;
  totalSP: number;
  totalTP: number;
}

export interface ComputeSprintTimelineTotalsOptions extends BuildTaskChangelogTimelineOptions {
  /** Момент начала спринта — снимок changelog до него задаёт стартовое состояние (как в burndown). */
  sprintStartTime: number;
}

function isDoneStatusKey(statusKey: string | undefined): boolean {
  if (!statusKey) return false;
  return mapStatus(statusKey.toLowerCase()) === 'done';
}

function timelineItemToBurndownEvent(item: TaskChangelogTimelineItem): BurndownEvent | null {
  switch (item.type) {
    case 'sprint_added':
      return { type: 'added', date: '', issueKey: item.issueKey };
    case 'sprint_removed':
      return { type: 'removed', date: '', issueKey: item.issueKey };
    case 'reestimated':
      return {
        type: 'reestimated',
        date: '',
        issueKey: item.issueKey,
        deltaSP: item.deltaSP,
        deltaTP: item.deltaTP,
      };
    case 'status_change':
      if (!isDoneStatusKey(item.toKey)) return null;
      if (item.fromKey && isDoneStatusKey(item.fromKey)) return null;
      return { type: 'closed', date: '', issueKey: item.issueKey };
    default:
      return null;
  }
}

function sumSprintTotalsFromTaskStates(taskState: Map<string, TaskState>): SprintTimelineTotals {
  let totalSP = 0;
  let totalTP = 0;
  let doneSP = 0;
  let doneTP = 0;

  for (const s of taskState.values()) {
    if (!s.inSprint) continue;
    totalSP += s.sp;
    totalTP += s.tp;
    if (s.isDone) {
      doneSP += s.sp;
      doneTP += s.tp;
    }
  }

  return {
    totalSP,
    totalTP,
    doneSP,
    doneTP,
    remainingSP: totalSP - doneSP,
    remainingTP: totalTP - doneTP,
  };
}

interface ChangelogRow {
  dateKey: string;
  entryId: string;
  issueKey: string;
  items: TaskChangelogTimelineItem[];
  timeMs: number;
}

function changelogEntrySortKeyForMerge(entry: YtrackerBurndownChangelogEntry): string {
  return entry.id ?? entry.updatedAt;
}

/**
 * Сравнение записей changelog между задачами: время → ключ задачи → id записи
 * (согласовано с порядком в {@link ./burndownFromChangelogReplay.collectBurndownEventsInSprintWindow}).
 */
function compareTimelineRows(a: ChangelogRow, b: ChangelogRow): number {
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  if (a.issueKey !== b.issueKey) return a.issueKey.localeCompare(b.issueKey);
  return a.entryId.localeCompare(b.entryId);
}

/**
 * Все «сырые» строки changelog в окне: глобальный хронологический порядок (как для реплея burndown).
 */
export function collectSprintChangelogRows(
  issues: YtrackerBurndownIssue[],
  options: BuildTaskChangelogTimelineOptions
): ChangelogRow[] {
  const { sprintName, sprintId, windowStartMs, windowEndMs } = options;
  const rows: ChangelogRow[] = [];

  for (const issue of issues) {
    const raw = [...(issue.rawChangelog ?? [])].sort(sortKeyEntry);
    for (const entry of raw) {
      const t = entryTimeMs(entry);
      if (windowStartMs != null && t < windowStartMs) continue;
      if (windowEndMs != null && t > windowEndMs) continue;

      const items = parseChangelogEntryToTimelineItems(entry, issue.issueKey, sprintName, sprintId);
      if (items.length === 0) continue;

      const dateKey = toBurndownDateKey(new Date(entry.updatedAt));
      rows.push({
        dateKey,
        timeMs: t,
        issueKey: issue.issueKey,
        entryId: changelogEntrySortKeyForMerge(entry),
        items,
      });
    }
  }

  rows.sort(compareTimelineRows);
  return rows;
}

/**
 * Группирует строки по дням и задачам: в каждом дне у каждой задачи ровно один {@link TaskChangelogDayTaskRollup},
 * внутри — события в порядке времени (несколько записей changelog за день идут подряд).
 */
export function groupChangelogRowsIntoTaskDays(rows: ChangelogRow[]): TaskChangelogDay[] {
  const dayOrder: string[] = [];
  const seenDay = new Set<string>();
  interface Acc { events: TaskChangelogTimelineItem[]; firstMs: number; }
  const byDay = new Map<string, Map<string, Acc>>();

  for (const row of rows) {
    if (!seenDay.has(row.dateKey)) {
      seenDay.add(row.dateKey);
      dayOrder.push(row.dateKey);
    }
    let taskMap = byDay.get(row.dateKey);
    if (!taskMap) {
      taskMap = new Map();
      byDay.set(row.dateKey, taskMap);
    }
    const prev = taskMap.get(row.issueKey);
    if (!prev) {
      taskMap.set(row.issueKey, {
        firstMs: row.timeMs,
        events: [...row.items],
      });
    } else {
      prev.firstMs = Math.min(prev.firstMs, row.timeMs);
      prev.events.push(...row.items);
    }
  }

  return dayOrder.map((dateKey) => {
    const taskMap = byDay.get(dateKey)!;
    const tasks: TaskChangelogDayTaskRollup[] = [...taskMap.entries()]
      .map(([issueKey, acc]) => ({
        issueKey,
        firstMs: acc.firstMs,
        events: acc.events,
      }))
      .sort((a, b) => a.firstMs - b.firstMs || a.issueKey.localeCompare(b.issueKey))
      .map(({ issueKey, events }) => ({ issueKey, events }));
    return { dateKey, tasks };
  });
}

/**
 * Сводит все переоценки за день по одной задаче в одну запись (сумма дельт); позиция — у первой переоценки в цепочке дня.
 * Порядок относительно статуса/спринта не меняет итоговые SP/TP после применения всех дельт.
 */
export function rollupTaskDayReestimatesToOne(events: TaskChangelogTimelineItem[]): TaskChangelogTimelineItem[] {
  let netSP = 0;
  let netTP = 0;
  let firstReestimateIndex = -1;
  const issueKey = events[0]?.issueKey ?? '';

  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'reestimated') {
      if (firstReestimateIndex < 0) firstReestimateIndex = i;
      netSP += e.deltaSP;
      netTP += e.deltaTP;
    }
  }

  const out: TaskChangelogTimelineItem[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'reestimated') {
      if (i === firstReestimateIndex && (netSP !== 0 || netTP !== 0)) {
        out.push({ type: 'reestimated', issueKey, deltaSP: netSP, deltaTP: netTP });
      }
      continue;
    }
    out.push(e);
  }
  return out;
}

/**
 * Цепочка смен статуса за день сводится к одному переходу: от первого from до последнего to.
 */
export function rollupTaskDayStatusChainToOne(events: TaskChangelogTimelineItem[]): TaskChangelogTimelineItem[] {
  const statuses = events.filter(
    (e): e is Extract<TaskChangelogTimelineItem, { type: 'status_change' }> => e.type === 'status_change'
  );
  if (statuses.length <= 1) return events;

  const issueKey = statuses[0].issueKey;
  const fromKey = statuses[0].fromKey;
  const toKey = statuses[statuses.length - 1].toKey;

  const out: TaskChangelogTimelineItem[] = [];
  let inserted = false;
  for (const e of events) {
    if (e.type === 'status_change') {
      if (!inserted) {
        out.push({ type: 'status_change', issueKey, fromKey, toKey });
        inserted = true;
      }
      continue;
    }
    out.push(e);
  }
  return out;
}

/**
 * Компактный «итог дня» по задаче: одна нетто-переоценка + один переход статуса (если были), спринт — как в исходном порядке.
 */
export function rollupTaskDayEventsForEndOfDayView(events: TaskChangelogTimelineItem[]): TaskChangelogTimelineItem[] {
  return rollupTaskDayStatusChainToOne(rollupTaskDayReestimatesToOne(events));
}

/**
 * Сводит SP/TP «всего» и «сделано» по тем же правилам, что реплей burndown:
 * события применяются в **глобальном** хронологическом порядке (как {@link collectSprintChangelogRows}), не по группам дня.
 */
export function computeSprintTimelineTotals(
  issues: YtrackerBurndownIssue[],
  options: ComputeSprintTimelineTotalsOptions
): SprintTimelineTotals {
  const { sprintName, sprintId, sprintStartTime } = options;

  const taskState = new Map<string, TaskState>();
  for (const yt of issues) {
    taskState.set(yt.issueKey, buildTaskStateAtSprintStart(yt, sprintName, sprintId, sprintStartTime));
  }

  const rows = collectSprintChangelogRows(issues, options);
  for (const row of rows) {
    for (const item of row.items) {
      const ev = timelineItemToBurndownEvent(item);
      if (!ev) continue;
      const state = taskState.get(ev.issueKey);
      if (!state) continue;
      applyBurndownEvent(ev, state);
    }
  }

  return sumSprintTotalsFromTaskStates(taskState);
}

/**
 * Одна запись changelog → список событий (без группировки по дням).
 */
export function parseChangelogEntryToTimelineItems(
  entry: YtrackerBurndownChangelogEntry,
  issueKey: string,
  sprintName: string,
  sprintId: string | undefined
): TaskChangelogTimelineItem[] {
  const items: TaskChangelogTimelineItem[] = [];
  const fields = entry.fields ?? [];
  let deltaSP = 0;
  let deltaTP = 0;

  for (const field of fields) {
    const fieldId = field?.field?.id;
    if (!fieldId) continue;

    if (fieldId === 'status') {
      const fromKey = extractStatusKey(field.from);
      const toKey = extractStatusKey(field.to);
      items.push({ type: 'status_change', issueKey, fromKey, toKey });
      continue;
    }

    if (fieldId === 'storyPoints' || fieldId === 'story_points') {
      const from = (field.from as number | null | undefined) ?? 0;
      const to = (field.to as number | null | undefined) ?? 0;
      deltaSP += to - from;
      continue;
    }

    if (fieldId === 'testPoints' || fieldId === 'test_points') {
      const from = (field.from as number | null | undefined) ?? 0;
      const to = (field.to as number | null | undefined) ?? 0;
      deltaTP += to - from;
      continue;
    }

    if (fieldId === 'sprint') {
      const from = field.from;
      const to = field.to;
      const toHas = sprintArrayContainsSprint(to, sprintName, sprintId);
      const fromHad = sprintArrayContainsSprint(from, sprintName, sprintId);
      if (toHas && !fromHad) items.push({ type: 'sprint_added', issueKey });
      if (fromHad && !toHas) items.push({ type: 'sprint_removed', issueKey });
    }
  }

  if (deltaSP !== 0 || deltaTP !== 0) {
    items.push({ type: 'reestimated', issueKey, deltaSP, deltaTP });
  }

  return items;
}

function entryTimeMs(entry: YtrackerBurndownChangelogEntry): number {
  return new Date(entry.updatedAt).getTime();
}

function sortKeyEntry(a: YtrackerBurndownChangelogEntry, b: YtrackerBurndownChangelogEntry): number {
  const ta = entryTimeMs(a);
  const tb = entryTimeMs(b);
  if (ta !== tb) return ta - tb;
  const ida = a.id ?? a.updatedAt;
  const idb = b.id ?? b.updatedAt;
  return ida.localeCompare(idb);
}

/**
 * По ченжлогу задачи — упорядоченный массив «день → по задачам за день».
 * У каждой задачи за день одна группа {@link TaskChangelogDayTaskRollup} с событиями по времени.
 */
export function buildTaskChangelogTimelineByDay(
  issue: YtrackerBurndownIssue,
  options: BuildTaskChangelogTimelineOptions
): TaskChangelogDay[] {
  const rows = collectSprintChangelogRows([issue], options);
  return groupChangelogRowsIntoTaskDays(rows);
}

/**
 * По массиву задач с `rawChangelog` — как {@link buildTaskChangelogTimelineByDay}, но все задачи;
 * внутри дня порядок групп — по времени первой записи по задаче.
 */
export function buildSprintChangelogTimelineByDay(
  issues: YtrackerBurndownIssue[],
  options: BuildTaskChangelogTimelineOptions
): TaskChangelogDay[] {
  const rows = collectSprintChangelogRows(issues, options);
  return groupChangelogRowsIntoTaskDays(rows);
}
