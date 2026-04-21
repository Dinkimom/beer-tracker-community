/**
 * Burndown из нормализованного changelog: события → хронологический реплей → дневные точки SP/TP.
 *
 * Слои:
 * 1) Снимок на начало спринта (реплей записей строго до sprintStartTime).
 * 2) События в окне [sprintStart, sprintEnd] для линии (добавление/снятие со спринта, нетто-переоценка, переход в done).
 *    Дневной ченжлог для тултипа строится отдельно: каждое поле storyPoints/testPoints/status/sprint.
 * 3) Остаток на конец каждого календарного дня.
 */

import type { BurndownDayChangelogItem } from '@/lib/api/types';
import type { YtrackerBurndownChangelogEntry, YtrackerBurndownIssue } from '@/lib/ytrackerRawIssues';

import { sprintArrayContainsSprint } from '@/lib/burndown/sprintMembership';
import { mapStatus } from '@/utils/statusMapper';

export { sprintArrayContainsSprint } from '@/lib/burndown/sprintMembership';

export function toBurndownDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function isDoneStatus(statusKey: string | undefined): boolean {
  if (!statusKey) return false;
  return mapStatus(statusKey.toLowerCase()) === 'done';
}

/** Tracker отдаёт status как объект { key, id, ... } или редко строкой */
export function extractStatusKey(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null && 'key' in value) {
    const k = (value as { key?: unknown }).key;
    return typeof k === 'string' ? k : undefined;
  }
  return undefined;
}

export interface TaskState {
  inSprint: boolean;
  isDone: boolean;
  sp: number;
  tp: number;
}

export type BurndownEvent =
  | { type: 'added'; date: string; issueKey: string }
  | { type: 'closed'; date: string; issueKey: string }
  | { type: 'reestimated'; date: string; issueKey: string; deltaSP: number; deltaTP: number }
  | { type: 'removed'; date: string; issueKey: string };

export interface BurndownDataPoint {
  date: string;
  dateKey: string;
  remainingSP: number;
  remainingTP: number;
}

type BurndownChangelogField = NonNullable<YtrackerBurndownChangelogEntry['fields']>[number];

/** Применяет одно поле changelog к {@link TaskState} (снимок SP/TP/статус/спринт). */
export function applyFieldToTaskState(
  field: BurndownChangelogField | undefined,
  sprintName: string,
  sprintIdForMatch: string | undefined,
  state: TaskState
): void {
  if (!field?.field?.id) return;
  const fid = field.field.id;

  if (fid === 'status') {
    const toKey = extractStatusKey(field.to);
    if (toKey) state.isDone = isDoneStatus(toKey);
    return;
  }
  if (fid === 'storyPoints' || fid === 'story_points') {
    const v = field.to as number | null | undefined;
    if (typeof v === 'number') state.sp = v;
    return;
  }
  if (fid === 'testPoints' || fid === 'test_points') {
    const v = field.to as number | null | undefined;
    if (typeof v === 'number') state.tp = v;
    return;
  }
  if (fid === 'sprint') {
    const toHas = sprintArrayContainsSprint(field.to, sprintName, sprintIdForMatch);
    const fromHad = sprintArrayContainsSprint(field.from, sprintName, sprintIdForMatch);
    if (toHas && !fromHad) state.inSprint = true;
    if (fromHad && !toHas) state.inSprint = false;
  }
}

/**
 * Состояние на начало спринта: реплей записей changelog строго до sprintStartTime.
 * Если в истории нет поля sprint — считаем задачу в спринте.
 */
export function buildTaskStateAtSprintStart(
  yt: YtrackerBurndownIssue,
  sprintName: string,
  sprintIdForMatch: string | undefined,
  sprintStartTime: number
): TaskState {
  const raw = yt.rawChangelog ?? [];
  let hasSprintField = false;

  const state: TaskState = {
    inSprint: false,
    sp: yt.storyPoints ?? 0,
    tp: yt.testPoints ?? 0,
    isDone: isDoneStatus(extractStatusKey(yt.statusKey) ?? yt.statusKey),
  };

  for (const entry of raw) {
    const t = new Date(entry.updatedAt).getTime();
    if (t >= sprintStartTime) break;

    for (const field of entry.fields ?? []) {
      if (field?.field?.id === 'sprint') hasSprintField = true;
      applyFieldToTaskState(field, sprintName, sprintIdForMatch, state);
    }
  }

  if (!hasSprintField) state.inSprint = true;

  return state;
}

function parseChangelogEntryToEvents(
  entry: YtrackerBurndownChangelogEntry,
  issueKey: string,
  sprintName: string,
  sprintId?: string
): BurndownEvent[] {
  const events: BurndownEvent[] = [];
  const date = entry.updatedAt;
  const fields = entry.fields ?? [];

  let deltaSP = 0;
  let deltaTP = 0;

  for (const field of fields) {
    const fieldId = field?.field?.id;
    if (!fieldId) continue;

    if (fieldId === 'status') {
      const fromKey = extractStatusKey(field.from);
      const toKey = extractStatusKey(field.to);
      // IssueWorkflow / IssueUpdated: закрытие часто приходит одной записью с несколькими полями
      if (toKey && isDoneStatus(toKey) && (!fromKey || !isDoneStatus(fromKey))) {
        events.push({ type: 'closed', date, issueKey });
      }
      continue;
    }

    if (fieldId === 'storyPoints' || fieldId === 'story_points') {
      const from = (field.from as number | null | undefined) ?? 0;
      const to = (field.to as number | null | undefined) ?? 0;
      deltaSP += to - from;
    } else if (fieldId === 'testPoints' || fieldId === 'test_points') {
      const from = (field.from as number | null | undefined) ?? 0;
      const to = (field.to as number | null | undefined) ?? 0;
      deltaTP += to - from;
    } else if (fieldId === 'sprint') {
      const from = field.from;
      const to = field.to;
      const toHas = sprintArrayContainsSprint(to, sprintName, sprintId);
      const fromHad = sprintArrayContainsSprint(from, sprintName, sprintId);
      if (toHas && !fromHad) events.push({ type: 'added', date, issueKey });
      if (fromHad && !toHas) events.push({ type: 'removed', date, issueKey });
    }
  }

  if (deltaSP !== 0 || deltaTP !== 0) {
    events.push({ type: 'reestimated', date, issueKey, deltaSP, deltaTP });
  }

  return events;
}

function changelogEntrySortKey(entry: YtrackerBurndownChangelogEntry): string {
  return entry.id ?? entry.updatedAt;
}

/** События в окне спринта; порядок: время → id записи changelog → ключ задачи → порядок внутри записи */
export function collectBurndownEventsInSprintWindow(
  ytrackerIssues: YtrackerBurndownIssue[],
  sprintName: string,
  sprintIdForMatch: string | undefined,
  sprintStartTime: number,
  sprintEndTime: number
): BurndownEvent[] {
  const withSeq: { entryId: string; ev: BurndownEvent; seq: number }[] = [];
  let seq = 0;
  for (const yt of ytrackerIssues) {
    for (const entry of yt.rawChangelog ?? []) {
      const entryTime = new Date(entry.updatedAt).getTime();
      if (entryTime < sprintStartTime || entryTime > sprintEndTime) continue;
      const entryId = changelogEntrySortKey(entry);
      for (const ev of parseChangelogEntryToEvents(entry, yt.issueKey, sprintName, sprintIdForMatch)) {
        withSeq.push({ ev, seq: seq++, entryId });
      }
    }
  }
  withSeq.sort((a, b) => {
    const ta = new Date(a.ev.date).getTime();
    const tb = new Date(b.ev.date).getTime();
    if (ta !== tb) return ta - tb;
    if (a.entryId !== b.entryId) return a.entryId.localeCompare(b.entryId);
    if (a.ev.issueKey !== b.ev.issueKey) return a.ev.issueKey.localeCompare(b.ev.issueKey);
    return a.seq - b.seq;
  });
  return withSeq.map((x) => x.ev);
}

function cloneTaskStateMap(map: Map<string, TaskState>): Map<string, TaskState> {
  const next = new Map<string, TaskState>();
  for (const [k, v] of map) next.set(k, { ...v });
  return next;
}

function appendDailyChangelogItem(
  dailyChangelog: Record<string, BurndownDayChangelogItem[]>,
  dateKey: string,
  item: BurndownDayChangelogItem
): void {
  const list = dailyChangelog[dateKey] ?? [];
  list.push(item);
  dailyChangelog[dateKey] = list;
}

interface DailyChangelogFieldContext {
  dailyChangelog: Record<string, BurndownDayChangelogItem[]>;
  dateKey: string;
  issueKey: string;
  sprintIdForMatch: string | undefined;
  sprintName: string;
  state: TaskState;
  summary: string;
  taskState: Map<string, TaskState>;
}

function appendStoryPointsFieldToDailyChangelog(
  field: BurndownChangelogField,
  ctx: DailyChangelogFieldContext
): void {
  const from = (field.from as number | null | undefined) ?? 0;
  const to = (field.to as number | null | undefined) ?? 0;
  applyFieldToTaskState(field, ctx.sprintName, ctx.sprintIdForMatch, ctx.state);
  const { remainingSP, remainingTP } = sumRemainingOpenWork(ctx.taskState);
  appendDailyChangelogItem(ctx.dailyChangelog, ctx.dateKey, {
    type: 'story_points_change',
    issueKey: ctx.issueKey,
    summary: ctx.summary,
    change: to - from,
    changeTP: 0,
    remainingSP,
    remainingTP,
    pointsFrom: from,
    pointsTo: to,
  });
}

function appendTestPointsFieldToDailyChangelog(
  field: BurndownChangelogField,
  ctx: DailyChangelogFieldContext
): void {
  const from = (field.from as number | null | undefined) ?? 0;
  const to = (field.to as number | null | undefined) ?? 0;
  applyFieldToTaskState(field, ctx.sprintName, ctx.sprintIdForMatch, ctx.state);
  const { remainingSP, remainingTP } = sumRemainingOpenWork(ctx.taskState);
  appendDailyChangelogItem(ctx.dailyChangelog, ctx.dateKey, {
    type: 'test_points_change',
    issueKey: ctx.issueKey,
    summary: ctx.summary,
    change: 0,
    changeTP: to - from,
    remainingSP,
    remainingTP,
    pointsFrom: from,
    pointsTo: to,
  });
}

function appendStatusFieldToDailyChangelog(
  field: BurndownChangelogField,
  ctx: DailyChangelogFieldContext
): void {
  const fromKey = extractStatusKey(field.from);
  const toKey = extractStatusKey(field.to);
  applyFieldToTaskState(field, ctx.sprintName, ctx.sprintIdForMatch, ctx.state);
  const { remainingSP, remainingTP } = sumRemainingOpenWork(ctx.taskState);
  appendDailyChangelogItem(ctx.dailyChangelog, ctx.dateKey, {
    type: 'status_change',
    issueKey: ctx.issueKey,
    summary: ctx.summary,
    change: 0,
    changeTP: 0,
    remainingSP,
    remainingTP,
    statusFromKey: fromKey,
    statusToKey: toKey,
  });
}

function appendSprintFieldToDailyChangelog(
  field: BurndownChangelogField,
  ctx: DailyChangelogFieldContext
): void {
  const { dailyChangelog, dateKey, issueKey, sprintIdForMatch, sprintName, state, summary, taskState } =
    ctx;
  const to = field.to;
  const from = field.from;
  const toHas = sprintArrayContainsSprint(to, sprintName, sprintIdForMatch);
  const fromHad = sprintArrayContainsSprint(from, sprintName, sprintIdForMatch);
  const wasInSprint = state.inSprint;
  const spBefore = state.sp;
  const tpBefore = state.tp;

  if (toHas && !fromHad) {
    applyFieldToTaskState(field, sprintName, sprintIdForMatch, state);
    const { remainingSP, remainingTP } = sumRemainingOpenWork(taskState);
    appendDailyChangelogItem(dailyChangelog, dateKey, {
      type: 'added',
      issueKey,
      summary,
      change: wasInSprint ? 0 : spBefore,
      changeTP: wasInSprint ? 0 : tpBefore,
      remainingSP,
      remainingTP,
    });
  } else if (fromHad && !toHas) {
    const changeSp = wasInSprint ? 0 - spBefore : 0;
    const changeTp = wasInSprint ? 0 - tpBefore : 0;
    applyFieldToTaskState(field, sprintName, sprintIdForMatch, state);
    const { remainingSP, remainingTP } = sumRemainingOpenWork(taskState);
    appendDailyChangelogItem(dailyChangelog, dateKey, {
      type: 'removed',
      issueKey,
      summary,
      change: changeSp,
      changeTP: changeTp,
      remainingSP,
      remainingTP,
    });
  } else {
    applyFieldToTaskState(field, sprintName, sprintIdForMatch, state);
    const { remainingSP, remainingTP } = sumRemainingOpenWork(taskState);
    appendDailyChangelogItem(dailyChangelog, dateKey, {
      type: 'sprint_field_change',
      issueKey,
      summary,
      change: 0,
      changeTP: 0,
      remainingSP,
      remainingTP,
    });
  }
}

function appendDailyChangelogFieldsForEntry(
  entry: YtrackerBurndownChangelogEntry,
  issueKey: string,
  summary: string,
  taskState: Map<string, TaskState>,
  dailyChangelog: Record<string, BurndownDayChangelogItem[]>,
  sprintName: string,
  sprintIdForMatch: string | undefined
): void {
  const state = taskState.get(issueKey);
  if (!state) return;

  const dateKey = toBurndownDateKey(new Date(entry.updatedAt));
  const fieldCtx: DailyChangelogFieldContext = {
    dailyChangelog,
    dateKey,
    issueKey,
    sprintIdForMatch,
    sprintName,
    state,
    summary,
    taskState,
  };

  for (const field of entry.fields ?? []) {
    const fieldId = field?.field?.id;
    if (!fieldId) continue;

    if (fieldId === 'storyPoints' || fieldId === 'story_points') {
      appendStoryPointsFieldToDailyChangelog(field, fieldCtx);
      continue;
    }

    if (fieldId === 'testPoints' || fieldId === 'test_points') {
      appendTestPointsFieldToDailyChangelog(field, fieldCtx);
      continue;
    }

    if (fieldId === 'status') {
      appendStatusFieldToDailyChangelog(field, fieldCtx);
      continue;
    }

    if (fieldId === 'sprint') {
      appendSprintFieldToDailyChangelog(field, fieldCtx);
    }
  }
}

/**
 * Дневной ченжлог для тултипа: по каждому полю issue_logs в окне спринта (SP, TP, статус, sprint),
 * в глобальном порядке записей как у реплея burndown. Остаток — после пошагового применения полей к снимку состояния.
 */
export function buildDailyChangelogFromFieldStream(
  ytrackerIssues: YtrackerBurndownIssue[],
  taskStateAtStart: Map<string, TaskState>,
  sprintName: string,
  sprintIdForMatch: string | undefined,
  sprintStartTime: number,
  sprintEndTime: number,
  issueSummaries: Map<string, string>
): Record<string, BurndownDayChangelogItem[]> {
  const taskState = cloneTaskStateMap(taskStateAtStart);
  const dailyChangelog: Record<string, BurndownDayChangelogItem[]> = {};

  const rows: {
    entry: YtrackerBurndownChangelogEntry;
    issueKey: string;
    timeMs: number;
    entryId: string;
  }[] = [];
  for (const yt of ytrackerIssues) {
    for (const entry of yt.rawChangelog ?? []) {
      const t = new Date(entry.updatedAt).getTime();
      if (t < sprintStartTime || t > sprintEndTime) continue;
      rows.push({
        entry,
        issueKey: yt.issueKey,
        timeMs: t,
        entryId: changelogEntrySortKey(entry),
      });
    }
  }
  rows.sort((a, b) => {
    if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
    if (a.entryId !== b.entryId) return a.entryId.localeCompare(b.entryId);
    return a.issueKey.localeCompare(b.issueKey);
  });

  for (const { entry, issueKey } of rows) {
    const summary = issueSummaries.get(issueKey) ?? issueKey;
    appendDailyChangelogFieldsForEntry(
      entry,
      issueKey,
      summary,
      taskState,
      dailyChangelog,
      sprintName,
      sprintIdForMatch
    );
  }

  return dailyChangelog;
}

function sumRemainingOpenWork(taskState: Map<string, TaskState>): { remainingSP: number; remainingTP: number } {
  let remainingSP = 0;
  let remainingTP = 0;
  for (const s of taskState.values()) {
    if (s.inSprint && !s.isDone) {
      remainingSP += s.sp;
      remainingTP += s.tp;
    }
  }
  return { remainingSP, remainingTP };
}

/** Применяет одно событие burndown к состоянию задачи (мутация state). */
export function applyBurndownEvent(ev: BurndownEvent, state: TaskState): { change: number; changeTP: number; wasInSprint: boolean } {
  const wasInSprint = state.inSprint;
  let change = 0;
  let changeTP = 0;

  if (ev.type === 'closed') {
    if (state.isDone) {
      return { change: 0, changeTP: 0, wasInSprint };
    }
    state.isDone = true;
    // 0 - x вместо -x: при x === 0 иначе получается -0 в JS
    change = 0 - state.sp;
    changeTP = 0 - state.tp;
  } else if (ev.type === 'reestimated') {
    change = wasInSprint ? ev.deltaSP : 0;
    changeTP = wasInSprint ? ev.deltaTP : 0;
    state.sp += ev.deltaSP;
    state.tp += ev.deltaTP;
  } else if (ev.type === 'added') {
    state.inSprint = true;
    change = wasInSprint ? 0 : state.sp;
    changeTP = wasInSprint ? 0 : state.tp;
  } else if (ev.type === 'removed') {
    if (!wasInSprint) {
      return { change: 0, changeTP: 0, wasInSprint };
    }
    state.inSprint = false;
    change = 0 - state.sp;
    changeTP = 0 - state.tp;
  }

  return { change, changeTP, wasInSprint };
}

function enumerateSprintDays(startDate: Date, endDate: Date): string[] {
  const keys: string[] = [];
  const cur = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const last = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  while (cur <= last) {
    keys.push(toBurndownDateKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return keys;
}

export interface ComputeBurndownFromChangelogInput {
  issueSummaries: Map<string, string>;
  sprintEndDate: Date;
  sprintEndTime: number;
  sprintIdForMatch: string | undefined;
  sprintName: string;
  sprintStartDate: Date;
  sprintStartTime: number;
  ytrackerIssues: YtrackerBurndownIssue[];
}

export interface ComputeBurndownFromChangelogResult {
  currentSP: number;
  currentTP: number;
  dailyChangelog: Record<string, BurndownDayChangelogItem[]>;
  dataPoints: BurndownDataPoint[];
  initialSP: number;
  initialTP: number;
}

export function computeBurndownFromChangelog(input: ComputeBurndownFromChangelogInput): ComputeBurndownFromChangelogResult {
  const {
    ytrackerIssues,
    sprintName,
    sprintIdForMatch,
    sprintStartTime,
    sprintEndTime,
    sprintStartDate,
    sprintEndDate,
    issueSummaries,
  } = input;

  const taskStateAtStart = new Map<string, TaskState>();
  for (const yt of ytrackerIssues) {
    taskStateAtStart.set(yt.issueKey, buildTaskStateAtSprintStart(yt, sprintName, sprintIdForMatch, sprintStartTime));
  }

  let initialSP = 0;
  let initialTP = 0;
  for (const s of taskStateAtStart.values()) {
    if (s.inSprint && !s.isDone) {
      initialSP += s.sp;
      initialTP += s.tp;
    }
  }

  const events = collectBurndownEventsInSprintWindow(
    ytrackerIssues,
    sprintName,
    sprintIdForMatch,
    sprintStartTime,
    sprintEndTime
  );

  const eventsByDay = new Map<string, BurndownEvent[]>();
  for (const ev of events) {
    const dk = toBurndownDateKey(new Date(ev.date));
    const list = eventsByDay.get(dk) ?? [];
    list.push(ev);
    eventsByDay.set(dk, list);
  }

  const dailyChangelog = buildDailyChangelogFromFieldStream(
    ytrackerIssues,
    taskStateAtStart,
    sprintName,
    sprintIdForMatch,
    sprintStartTime,
    sprintEndTime,
    issueSummaries
  );

  const taskState = cloneTaskStateMap(taskStateAtStart);
  const dayKeys = enumerateSprintDays(sprintStartDate, sprintEndDate);
  const dataPoints: BurndownDataPoint[] = [];

  for (const dateKey of dayKeys) {
    const dayEvents = eventsByDay.get(dateKey) ?? [];
    for (const ev of dayEvents) {
      const state = taskState.get(ev.issueKey);
      if (!state) continue;
      applyBurndownEvent(ev, state);
    }

    const atEndOfDay = sumRemainingOpenWork(taskState);
    const d = new Date(`${dateKey}T12:00:00`);
    dataPoints.push({
      dateKey,
      date: new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString(),
      remainingSP: Math.max(0, atEndOfDay.remainingSP),
      remainingTP: Math.max(0, atEndOfDay.remainingTP),
    });
  }

  const todayKey = toBurndownDateKey(new Date());
  const firstKey = dayKeys[0];
  const lastKey = dayKeys[dayKeys.length - 1];
  let keyForCurrent = todayKey;
  if (firstKey && todayKey < firstKey) keyForCurrent = firstKey;
  if (lastKey && todayKey > lastKey) keyForCurrent = lastKey;

  const currentPoint =
    dataPoints.find((p) => p.dateKey === keyForCurrent) ?? dataPoints[dataPoints.length - 1];
  const currentSP = currentPoint?.remainingSP ?? 0;
  const currentTP = currentPoint?.remainingTP ?? 0;

  return {
    initialSP,
    initialTP,
    dailyChangelog,
    dataPoints,
    currentSP,
    currentTP,
  };
}
