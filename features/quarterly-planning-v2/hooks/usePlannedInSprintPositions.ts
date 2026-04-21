'use client';

import type { SprintInfo } from '@/features/sprint/components/SprintPlanner/occupancy/OccupancyView';
import type { TaskPosition } from '@/types';

import { useQuery } from '@tanstack/react-query';

import { PARTS_PER_DAY } from '@/constants';
import { fetchParentStatusesAndTypes } from '@/features/sprint/components/SprintPlanner/occupancy/hooks/useParentStatuses';
import {
  fetchSprintBatchTaskParents,
  fetchSprintPositionsBatch,
} from '@/lib/api/sprints';

import { WORKING_DAYS_PER_SPRINT } from '../utils/quarterSprints';

/** В компактном режиме одна колонка = одна неделя спринта (5 рабочих дней) */

const durationDays = (p: TaskPosition) => Math.max(1, Math.ceil(p.duration / PARTS_PER_DAY));
const endDay = (p: TaskPosition) => p.startDay + durationDays(p);

/** Объединяет только строго соседние позиции (касающиеся). Пересекающиеся не сливаем — их рисуем стаком. */
function mergeAdjacentOnly(positions: TaskPosition[]): TaskPosition[] {
  if (positions.length <= 1) return positions;
  const sorted = [...positions].sort((a, b) => a.startDay - b.startDay);
  const merged: TaskPosition[] = [];
  let cur = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i];
    const curEnd = endDay(cur);
    if (next.startDay === curEnd) {
      const nextEnd = endDay(next);
      cur.duration = (nextEnd - cur.startDay) * PARTS_PER_DAY;
    } else {
      merged.push(cur);
      cur = { ...next };
    }
  }
  merged.push(cur);
  return merged;
}

/** Максимальное число позиций, пересекающихся в одной точке (для высоты строки при отрисовке стаком). */
export function getPlannedInSprintMaxStack(positions: TaskPosition[]): number {
  if (positions.length <= 1) return positions.length;
  const events: { t: number; delta: number }[] = [];
  for (const p of positions) {
    events.push({ t: p.startDay, delta: 1 });
    events.push({ t: endDay(p), delta: -1 });
  }
  events.sort((a, b) => a.t - b.t || b.delta - a.delta);
  let stack = 0;
  let maxStack = 0;
  for (const e of events) {
    stack += e.delta;
    maxStack = Math.max(maxStack, stack);
  }
  return maxStack;
}


/**
 * Индекс уровня стека для каждой позиции (0 = нижний).
 * Пересекающиеся по таймслоту получают разные уровни для отрисовки стаком.
 * Порядок позиций должен соответствовать order (например, по startDay).
 */
export function getPlannedInSprintStackIndices(positions: TaskPosition[]): number[] {
  if (positions.length === 0) return [];
  const order = [...positions].sort((a, b) => a.startDay - b.startDay);
  const indices: number[] = [];
  for (let i = 0; i < order.length; i++) {
    const start = order[i].startDay;
    const usedLevels = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (endDay(order[j]) > start) usedLevels.add(indices[j]);
    }
    let level = 0;
    while (usedLevels.has(level)) level++;
    indices.push(level);
  }
  return indices;
}

/** Спринт считается текущим, если сегодня входит в [startDate, endDate]. */
function hasCurrentSprint(sprintInfos: SprintInfo[]): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return sprintInfos.some((s) => {
    const start = new Date(s.startDate);
    start.setHours(0, 0, 0, 0);
    const end = s.endDate ? new Date(s.endDate) : null;
    if (end) end.setHours(23, 59, 59, 999);
    return (
      today >= start &&
      (end == null || today <= end)
    );
  });
}

/**
 * Загружает «запланированное в спринт» для стори и эпиков.
 *
 * Стратегия: сначала все планы по спринтам (batch positions) и все задачи в этих спринтах
 * из Tracker (batch task-parents), затем сопоставление по story/epic. Так один запрос
 * по спринтам вместо N по стори/эпикам.
 * Прошедшие спринты кэшируются дольше, текущий — с коротким staleTime для актуальных данных.
 */
export function usePlannedInSprintPositions(
  _boardId: number | null,
  storyKeys: string[],
  epicKeys: string[],
  sprintInfos: SprintInfo[],
  storyKeyToEpicKey?: Map<string, string>
): {
  plannedInSprintPositions: Map<string, TaskPosition[]>;
  plannedInSprintMaxStack: Map<string, number>;
  isLoading: boolean;
} {
  const storyKeyToEpicKeyKey = storyKeyToEpicKey
    ? Array.from(storyKeyToEpicKey.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .join(',')
    : '';

  const isCurrentSprintIncluded = hasCurrentSprint(sprintInfos);
  const staleTime = isCurrentSprintIncluded
    ? 1000 * 30
    : 1000 * 60 * 10;

  const { data, isLoading } = useQuery({
    queryKey: [
      'planned-in-sprint-positions',
      storyKeys.slice().sort().join(','),
      epicKeys.slice().sort().join(','),
      sprintInfos.map((s) => s.id).join(','),
      storyKeyToEpicKeyKey,
    ],
    queryFn: async (): Promise<{
      positions: Map<string, TaskPosition[]>;
      maxStack: Map<string, number>;
    }> => {
      if (sprintInfos.length === 0) {
        return { positions: new Map(), maxStack: new Map() };
      }
      if (storyKeys.length === 0 && epicKeys.length === 0) {
        return { positions: new Map(), maxStack: new Map() };
      }

      const sprintIds = sprintInfos.map((s) => s.id as number);

      // 1. Все позиции по спринтам одним запросом
      const positionsPerSprint = await fetchSprintPositionsBatch(sprintIds);

      // 2. Все задачи в этих спринтах с родителем (story) — один запрос на наш API, внутри по спринтам к Tracker
      const taskIdToStoryKeyRaw = await fetchSprintBatchTaskParents(sprintIds);
      const taskIdToStoryKey = new Map(Object.entries(taskIdToStoryKeyRaw));

      // 3. taskId → epicKey через storyKey → epicKey (из плана)
      const taskIdToEpicKey = new Map<string, string>();
      const epicKeysSet = new Set(epicKeys);
      for (const [taskId, storyKey] of taskIdToStoryKey) {
        const epicKey = storyKeyToEpicKey?.get(storyKey);
        if (epicKey && epicKeysSet.has(epicKey)) {
          taskIdToEpicKey.set(taskId, epicKey);
        }
      }

      const storyKeysSet = new Set(storyKeys);

      const result = new Map<string, TaskPosition[]>();

      // 4. По позициям: если задача принадлежит стори/эпику из плана — добавляем позицию
      for (let sprintIdx = 0; sprintIdx < sprintInfos.length; sprintIdx++) {
        const positions = positionsPerSprint[sprintIdx] ?? [];
        const offset = sprintIdx * WORKING_DAYS_PER_SPRINT;
        for (const pos of positions) {
          const globalStartDay = offset + pos.startDay;
          const durationParts = pos.duration ?? PARTS_PER_DAY;
          const durationDays = Math.max(1, Math.ceil(durationParts / PARTS_PER_DAY));
          const position: TaskPosition = {
            taskId: pos.taskId,
            assignee: pos.assignee ?? '',
            startDay: globalStartDay,
            startPart: pos.startPart ?? 0,
            duration: durationDays * PARTS_PER_DAY,
            sourceTaskId: pos.taskId,
          };
          const parentKey = taskIdToStoryKey.get(pos.taskId);
          if (parentKey && storyKeysSet.has(parentKey)) {
            const list = result.get(parentKey) ?? [];
            list.push({ ...position, taskId: parentKey });
            result.set(parentKey, list);
          }
          if (parentKey && epicKeysSet.has(parentKey)) {
            const list = result.get(parentKey) ?? [];
            list.push({ ...position, taskId: parentKey });
            result.set(parentKey, list);
          }
          const epicKey = taskIdToEpicKey.get(pos.taskId);
          if (epicKey) {
            const list = result.get(epicKey) ?? [];
            list.push({ ...position, taskId: epicKey });
            result.set(epicKey, list);
          }
        }
      }

      // Статусы задач для раскраски «запланировано в спринт» по статусу (как фазы занятости)
      const sourceTaskIds = new Set<string>();
      for (const list of result.values()) {
        for (const p of list) {
          if (p.sourceTaskId) sourceTaskIds.add(p.sourceTaskId);
        }
      }
      const { statuses: statusesMap, summaries: summariesMap } =
        sourceTaskIds.size > 0
          ? await fetchParentStatusesAndTypes(Array.from(sourceTaskIds))
          : { statuses: new Map<string, string>(), summaries: new Map<string, string>() };
      for (const list of result.values()) {
        for (const p of list) {
          if (p.sourceTaskId) {
            const st = statusesMap.get(p.sourceTaskId);
            if (st) p.originalStatus = st;
            const summary = summariesMap.get(p.sourceTaskId);
            if (summary != null) p.sourceTaskSummary = summary;
          }
        }
      }

      const mergedResult = new Map<string, TaskPosition[]>();
      const maxStackResult = new Map<string, number>();
      for (const [key, list] of result) {
        const merged = mergeAdjacentOnly(list);
        mergedResult.set(key, merged);
        maxStackResult.set(key, getPlannedInSprintMaxStack(merged));
      }
      return { positions: mergedResult, maxStack: maxStackResult };
    },
    enabled: sprintInfos.length > 0 && (storyKeys.length > 0 || epicKeys.length > 0),
    staleTime,
  });

  const plannedInSprintPositions = data?.positions ?? new Map<string, TaskPosition[]>();
  const plannedInSprintMaxStack = data?.maxStack ?? new Map<string, number>();
  return { plannedInSprintPositions, plannedInSprintMaxStack, isLoading };
}
