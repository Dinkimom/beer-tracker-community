/**
 * Фазы таймлайна факта под свимлейном.
 * — Строка тестировщика (QA):
 *   · inProgress/review/defect/blocked — только «чисто QA» (0 СП, ТП > 0; при originalTaskId — исходная не dev+тест: СП, 0 СП+ТП+QA, не QA-платформа и исполнитель не QA).
 *   · иначе — воронка теста (в т.ч. дефект/заблокировано) + закрыто.
 *   Changelog [QA] подмешивается с dev по originalTaskId при необходимости.
 * — Строка разработчика: «В работе», «На ревью», дефект/заблокировано, «Закрыто» — без readyForTest / inTesting.
 * Отдельная полоса на каждую задачу и тип фазы; пересечения по времени — разные laneIndex.
 */

import type { StatusDuration } from '@/features/task/components/TaskTimeline/types';
import type { Developer, Task, TaskPosition } from '@/types';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import { OCCUPANCY_FACT_PHASE_GAP_PX } from '@/lib/planner-timeline';

export type SwimlaneInProgressFactSegment = StatusDuration & {
  laneIndex: number;
  taskId: string;
};

function normalizeStatusKey(key: string): string {
  return key.toLowerCase().replace(/\s+/g, '');
}

/**
 * [QA]-карточка имеет свой id (uuid), а changelog / durations в batch приходят по id исходной dev-задачи.
 * Для строки тестировщика подмешиваем фазы с dev-задачи (дедуп по статусу и границам времени).
 */
function dedupeStatusDurations(a: StatusDuration[], b: StatusDuration[]): StatusDuration[] {
  const seen = new Set<string>();
  const out: StatusDuration[] = [];
  for (const d of [...a, ...b]) {
    const k = `${normalizeStatusKey(d.statusKey)}|${d.startTimeMs}|${d.endTimeMs ?? 'open'}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(d);
  }
  out.sort((x, y) => x.startTimeMs - y.startTimeMs || (x.endTimeMs ?? 0) - (y.endTimeMs ?? 0));
  return out;
}

function resolveFactDurationsForSwimlaneTask(
  taskId: string,
  swimlaneAssigneeRole: Developer['role'],
  tasksMap: Map<string, Task>,
  durationsByTaskId: Map<string, StatusDuration[]>
): StatusDuration[] {
  const direct = durationsByTaskId.get(taskId) ?? [];
  if (swimlaneAssigneeRole !== 'tester') {
    return direct;
  }
  const task = tasksMap.get(taskId);
  const devId = task?.originalTaskId;
  if (!devId) {
    return direct;
  }
  const fromDev = durationsByTaskId.get(devId) ?? [];
  if (direct.length === 0) {
    return fromDev;
  }
  if (fromDev.length === 0) {
    return direct;
  }
  return dedupeStatusDurations(direct, fromDev);
}

/** Группа для слияния соседних интервалов внутри задачи */
type FactPhaseKind =
  | 'blocked'
  | 'closed'
  | 'defect'
  | 'inprogress'
  | 'intesting'
  | 'readyfortest'
  | 'review';

/** Только фазы воронки тестирования + закрыто (без inProgress / review) */
function factPhaseKindTestingFunnelOnly(statusKey: string): FactPhaseKind | null {
  const n = normalizeStatusKey(statusKey);
  if (n === 'closed') return 'closed';
  if (n === 'readyfortest' || n === 'readyfortesting') return 'readyfortest';
  if (n === 'intesting') return 'intesting';
  if (n === 'defect') return 'defect';
  if (n === 'blocked') return 'blocked';
  return null;
}

/**
 * Исходная dev-задача: на строке QA показываем только воронку теста (без inProgress/review из dev).
 * Срабатывает при СП, при связке 0 СП + ТП + QA инженер, либо при явной dev-задаче: платформа не QA
 * и исполнитель не QA (исполнитель ≠ поле QA инженера, если оно задано).
 */
function devOriginRequiresTestingFunnelOnlyOnQaSwimlane(dev: Task): boolean {
  if (dev.storyPoints != null && dev.storyPoints > 0) return true;
  const noSp = dev.storyPoints == null || dev.storyPoints === 0;
  const hasTp = dev.testPoints != null && dev.testPoints > 0;
  const hasQaEng = Boolean(dev.qaEngineer?.trim());
  if (noSp && hasTp && hasQaEng) return true;

  const platformNotQa = dev.team !== 'QA';
  const assigneeId = dev.assignee?.trim();
  const qaId = dev.qaEngineer?.trim();
  const assigneeNotQa =
    Boolean(assigneeId) && (!qaId || assigneeId !== qaId);
  return platformNotQa && assigneeNotQa;
}

/**
 * Чисто QA для колбас: 0 СП и ТП > 0 на карточке; если есть originalTaskId — исходная задача не должна
 * требовать «dev+тест» (СП, 0 СП + ТП + QA, платформа не QA и исполнитель не QA), иначе на строке QA только воронка.
 */
function isPureQaCardForFactTimeline(task: Task, tasksMap: Map<string, Task>): boolean {
  const noSp = task.storyPoints == null || task.storyPoints === 0;
  const hasTp = task.testPoints != null && task.testPoints > 0;
  if (!noSp || !hasTp) return false;
  const devId = task.originalTaskId;
  if (!devId) return true;
  const dev = tasksMap.get(devId);
  if (!dev) return false;
  if (devOriginRequiresTestingFunnelOnlyOnQaSwimlane(dev)) return false;
  return true;
}

function factPhaseKindForTesterSwimlane(
  statusKey: string,
  task: Task | undefined,
  tasksMap: Map<string, Task>
): FactPhaseKind | null {
  const n = normalizeStatusKey(statusKey);
  if (n === 'closed') return 'closed';

  if (!task) {
    return factPhaseKindTestingFunnelOnly(statusKey);
  }

  if (isPureQaCardForFactTimeline(task, tasksMap)) {
    if (n === 'inprogress') return 'inprogress';
    if (n === 'review' || n === 'inreview' || n === 'in_review') return 'review';
    if (n === 'readyfortest' || n === 'readyfortesting') return 'readyfortest';
    if (n === 'intesting') return 'intesting';
    if (n === 'defect') return 'defect';
    if (n === 'blocked') return 'blocked';
    return null;
  }

  return factPhaseKindTestingFunnelOnly(statusKey);
}

/** Строка разработчика: без колбас воронки тестирования */
function factPhaseKindForDeveloperSwimlane(statusKey: string): FactPhaseKind | null {
  const n = normalizeStatusKey(statusKey);
  if (n === 'closed') return 'closed';
  if (n === 'inprogress') return 'inprogress';
  if (n === 'review' || n === 'inreview' || n === 'in_review') return 'review';
  if (n === 'defect') return 'defect';
  if (n === 'blocked') return 'blocked';
  return null;
}

/** Ключ для цветов/перевода в UI */
function canonicalTimelineStatusKey(kind: FactPhaseKind): string {
  if (kind === 'review') return 'review';
  if (kind === 'closed') return 'closed';
  if (kind === 'readyfortest') return 'readyfortest';
  if (kind === 'intesting') return 'intesting';
  if (kind === 'defect') return 'defect';
  if (kind === 'blocked') return 'blocked';
  return 'inprogress';
}

/** Задачи на строке свимлейна (assignee в позиции = этот исполнитель), как в useSwimlaneLayout */
export function getTaskIdsOnSwimlaneRow(
  developerId: string,
  taskPositions: Map<string, TaskPosition>
): string[] {
  const ids: string[] = [];
  taskPositions.forEach((pos, taskId) => {
    if (pos.assignee === developerId) ids.push(taskId);
  });
  return ids;
}

interface RawIv {
  endMs: number;
  hasOpenEnd: boolean;
  kind: FactPhaseKind;
  startMs: number;
  statusName: string;
  taskId: string;
}

/** Слияние только внутри одной задачи и одного kind */
function mergeIntervalsWithinTask(intervals: RawIv[]): RawIv[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs);
  const merged: RawIv[] = [];
  for (const iv of sorted) {
    const last = merged[merged.length - 1];
    const sameKind = last && last.kind === iv.kind;
    if (!last || iv.startMs > last.endMs || !sameKind) {
      merged.push({ ...iv });
    } else {
      last.endMs = Math.max(last.endMs, iv.endMs);
      last.hasOpenEnd = last.hasOpenEnd || iv.hasOpenEnd;
      if (iv.statusName) last.statusName = iv.statusName;
    }
  }
  return merged;
}

/**
 * Для каждого интервала — индекс предыдущего интервала той же задачи по времени начала
 * (цепочка для стрелок «слева направо» внутри задачи).
 */
function computePrevSameTaskIndex(intervals: RawIv[]): (number | null)[] {
  const prev: (number | null)[] = new Array(intervals.length).fill(null);
  const byTask = new Map<string, number[]>();
  for (let i = 0; i < intervals.length; i++) {
    const tid = intervals[i]!.taskId;
    if (!byTask.has(tid)) byTask.set(tid, []);
    byTask.get(tid)!.push(i);
  }
  for (const indices of byTask.values()) {
    indices.sort(
      (ia, ib) =>
        intervals[ia]!.startMs - intervals[ib]!.startMs ||
        intervals[ia]!.endMs - intervals[ib]!.endMs
    );
    for (let k = 1; k < indices.length; k++) {
      prev[indices[k]!] = indices[k - 1]!;
    }
  }
  return prev;
}

/**
 * Назначает laneIndex: классическая раскладка без пересечений в одной дорожке,
 * но если возможно — продолжаем дорожку предыдущего по времени сегмента той же задачи,
 * чтобы стрелки между фазами одной задачи не уходили на другую строку.
 */
function assignLanes(intervals: RawIv[]): number[] {
  const prevSameTask = computePrevSameTaskIndex(intervals);
  const order = intervals
    .map((iv, i) => ({ iv, i }))
    .sort((a, b) => a.iv.startMs - b.iv.startMs || a.iv.endMs - b.iv.endMs);
  const laneByIndex = new Array<number>(intervals.length);
  const laneEnds: number[] = [];

  const feasibleLaneIndices = (iv: RawIv): number[] => {
    const out: number[] = [];
    for (let l = 0; l < laneEnds.length; l++) {
      if (iv.startMs >= laneEnds[l]!) out.push(l);
    }
    return out;
  };

  for (const { iv, i } of order) {
    const feas = feasibleLaneIndices(iv);
    const prevI = prevSameTask[i];
    let lane: number;

    if (prevI != null) {
      const preferred = laneByIndex[prevI]!;
      if (feas.includes(preferred)) {
        lane = preferred;
      } else if (feas.length > 0) {
        lane = feas[0]!;
      } else {
        lane = laneEnds.length;
      }
    } else if (feas.length > 0) {
      lane = feas[0]!;
    } else {
      lane = laneEnds.length;
    }

    if (lane === laneEnds.length) {
      laneEnds.push(iv.endMs);
    } else {
      laneEnds[lane] = iv.endMs;
    }
    laneByIndex[i] = lane;
  }
  return laneByIndex;
}

function defaultStatusNameForFactPhaseKind(kind: FactPhaseKind): string {
  switch (kind) {
    case 'review':
      return 'На ревью';
    case 'closed':
      return 'Закрыто';
    case 'readyfortest':
      return 'Готово к тестированию';
    case 'intesting':
      return 'В тестировании';
    case 'defect':
      return 'Дефект';
    case 'blocked':
      return 'Заблокировано';
    default:
      return 'В работе';
  }
}

function rawToStatusDuration(iv: RawIv, now: number): StatusDuration {
  const ongoing = iv.hasOpenEnd || iv.endMs >= now;
  const endMs = ongoing ? now : iv.endMs;
  const key = canonicalTimelineStatusKey(iv.kind);
  const name = iv.statusName?.trim() || defaultStatusNameForFactPhaseKind(iv.kind);
  return {
    statusKey: key,
    statusName: name,
    startTime: new Date(iv.startMs).toISOString(),
    startTimeMs: iv.startMs,
    endTime: ongoing ? null : new Date(iv.endMs).toISOString(),
    endTimeMs: endMs,
    durationMs: Math.max(0, endMs - iv.startMs),
  };
}

/**
 * Сегменты таймлайна факта для строки свимлейна исполнителя.
 * tasksMap нужен, чтобы для [QA]-карточки подтянуть changelog по originalTaskId.
 */
export function buildSwimlaneInProgressFactSegmentsForAssignee(
  developerId: string,
  swimlaneAssigneeRole: Developer['role'],
  taskPositions: Map<string, TaskPosition>,
  durationsByTaskId: Map<string, StatusDuration[]>,
  tasksMap: Map<string, Task>
): SwimlaneInProgressFactSegment[] {
  const taskIds = getTaskIdsOnSwimlaneRow(developerId, taskPositions);
  const now = Date.now();

  const perTaskMerged: RawIv[] = [];

  for (const tid of taskIds) {
    const list = resolveFactDurationsForSwimlaneTask(
      tid,
      swimlaneAssigneeRole,
      tasksMap,
      durationsByTaskId
    );
    if (!list.length) continue;
    const task = tasksMap.get(tid);
    const raw: RawIv[] = [];
    for (const d of list) {
      const kind =
        swimlaneAssigneeRole === 'tester'
          ? factPhaseKindForTesterSwimlane(d.statusKey, task, tasksMap)
          : factPhaseKindForDeveloperSwimlane(d.statusKey);
      if (!kind) continue;
      const open = d.endTime == null;
      const endMs = open ? now : d.endTimeMs;
      raw.push({
        startMs: d.startTimeMs,
        endMs,
        hasOpenEnd: open,
        taskId: tid,
        kind,
        statusName: d.statusName,
      });
    }
    for (const iv of mergeIntervalsWithinTask(raw)) {
      perTaskMerged.push(iv);
    }
  }

  if (perTaskMerged.length === 0) return [];

  const lanes = assignLanes(perTaskMerged);

  return perTaskMerged.map((iv, i) => {
    const base = rawToStatusDuration(iv, now);
    return {
      ...base,
      laneIndex: lanes[i]!,
      taskId: iv.taskId,
    } satisfies SwimlaneInProgressFactSegment;
  });
}

/** Число горизонтальных дорожек (минимум 1, если есть сегменты) */
export function getSwimlaneInProgressLaneCount(segments: SwimlaneInProgressFactSegment[]): number {
  if (segments.length === 0) return 0;
  return Math.max(1, ...segments.map((s) => s.laneIndex + 1));
}

/** Высота одной дорожки «колбасы» (px) */
export const SWIMLANE_IN_PROGRESS_LANE_ROW_HEIGHT = 22;
/** Отступ под нижней дорожкой факта до границы строки свимлейна */
export const SWIMLANE_IN_PROGRESS_FACT_BOTTOM_INSET_PX = 6;

export function getSwimlaneInProgressFactLayerHeightPx(segments: SwimlaneInProgressFactSegment[]): number {
  const n = getSwimlaneInProgressLaneCount(segments);
  if (n <= 0) return 0;
  const lanesHeight =
    n * SWIMLANE_IN_PROGRESS_LANE_ROW_HEIGHT + (n - 1) * OCCUPANCY_FACT_PHASE_GAP_PX;
  return lanesHeight + SWIMLANE_IN_PROGRESS_FACT_BOTTOM_INSET_PX;
}

function sortChangelogEntries(a: ChangelogEntry, b: ChangelogEntry): number {
  const ta = new Date(a.updatedAt).getTime();
  const tb = new Date(b.updatedAt).getTime();
  if (ta !== tb) return ta - tb;
  return (a.id || '').localeCompare(b.id || '');
}

function mergeChangelogEntriesUnion(a: ChangelogEntry[], b: ChangelogEntry[]): ChangelogEntry[] {
  if (b.length === 0) return [...a].sort(sortChangelogEntries);
  if (a.length === 0) return [...b].sort(sortChangelogEntries);
  const byId = new Map<string, ChangelogEntry>();
  for (const e of b) byId.set(e.id, e);
  for (const e of a) byId.set(e.id, e);
  return [...byId.values()].sort(sortChangelogEntries);
}

function mergeIssueCommentsUnion(a: IssueComment[], b: IssueComment[]): IssueComment[] {
  const sortC = (x: IssueComment, y: IssueComment) =>
    new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime() || x.id - y.id;
  if (b.length === 0) return [...a].sort(sortC);
  if (a.length === 0) return [...b].sort(sortC);
  const m = new Map<number, IssueComment>();
  for (const c of b) m.set(c.id, c);
  for (const c of a) m.set(c.id, c);
  return [...m.values()].sort(sortC);
}

/**
 * Changelog и комментарии для тултипа колбасы факта. Для [QA] с originalTaskId — объединение с dev-задачей.
 */
export function mergeIssueDataForSwimlaneFactTooltip(
  taskId: string,
  swimlaneAssigneeRole: Developer['role'],
  tasksMap: Map<string, Task>,
  changelogsByTaskId: Map<string, ChangelogEntry[]>,
  commentsByTaskId: Map<string, IssueComment[]>
): { changelog: ChangelogEntry[]; comments: IssueComment[] } {
  const directCl = changelogsByTaskId.get(taskId) ?? [];
  const directCm = commentsByTaskId.get(taskId) ?? [];
  if (swimlaneAssigneeRole !== 'tester') {
    return { changelog: directCl, comments: directCm };
  }
  const task = tasksMap.get(taskId);
  const devId = task?.originalTaskId;
  if (!devId) {
    return { changelog: directCl, comments: directCm };
  }
  const fromDevCl = changelogsByTaskId.get(devId) ?? [];
  const fromDevCm = commentsByTaskId.get(devId) ?? [];
  return {
    changelog: mergeChangelogEntriesUnion(directCl, fromDevCl),
    comments: mergeIssueCommentsUnion(directCm, fromDevCm),
  };
}
