'use client';

import type { StoryPhasePosition } from '../types';
import type { SprintInfo } from '@/features/sprint/components/SprintPlanner/occupancy/OccupancyView';
import type { Task, TaskPosition } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { useMemo } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';

import { filterSprintsByQuarter } from '../utils/quarterSprints';

import { usePlannedInSprintPositions } from './usePlannedInSprintPositions';

/**
 * Преобразует позицию стори (по спринту/дню) в глобальный TaskPosition для occupancy.
 */
function storyPhaseToTaskPosition(
  storyKey: string,
  phase: StoryPhasePosition
): TaskPosition {
  const startDay = phase.sprintIndex * WORKING_DAYS + phase.startDay;
  const duration = phase.durationDays * PARTS_PER_DAY;
  return {
    taskId: storyKey,
    startDay,
    startPart: 0,
    duration,
    assignee: '',
  };
}

/**
 * Преобразует TaskPosition (глобальные день/длительность) обратно в StoryPhasePosition.
 */
function taskPositionToStoryPhase(position: TaskPosition): StoryPhasePosition {
  const sprintIndex = Math.floor(position.startDay / WORKING_DAYS);
  const startDay = position.startDay % WORKING_DAYS;
  const durationDays = Math.max(1, Math.ceil(position.duration / PARTS_PER_DAY));
  return { sprintIndex, startDay, durationDays };
}

/**
 * Строит Task-подобный объект из стори для отображения в occupancy (эпик = родитель, стори = строки).
 */
function storyToTaskLike(
  storyKey: string,
  storyName: string,
  epicKey: string,
  epicName: string,
  originalStatus?: string,
  type?: string,
  priority?: string
): Task {
  return {
    id: storyKey,
    name: storyName,
    link: '#',
    originalStatus,
    type,
    priority,
    parent: {
      id: epicKey,
      display: epicName,
      key: epicKey,
    },
    team: 'Back',
  };
}

/**
 * Строит Task без родителя — попадёт в группу «Без родителя» в occupancy.
 */
function taskLikeNoParent(
  id: string,
  name: string,
  originalStatus?: string,
  type?: string,
  priority?: string
): Task {
  return {
    id,
    name,
    link: '#',
    originalStatus,
    type,
    priority,
    team: 'Back',
  };
}

/** Данные по эпику для построения строк (имя, статус, тип, приоритет). */
export interface EpicDetails {
  epicKey: string;
  epicName: string;
  epicOriginalStatus?: string;
  epicPriority?: string;
  epicType?: string;
}

export interface UseEpicStoriesOccupancyDataParams {
  boardId: number | null;
  /** Данные по каждому эпику (имя, статус, тип, приоритет) — по epicKey */
  epicDetailsMap: Map<string, EpicDetails>;
  /** Все эпики из плана — по каждому загружаются стори и строятся строки таймлайна */
  planEpicKeys: string[];
  quarter: 1 | 2 | 3 | 4;
  sprints: SprintListItem[];
  storyPhases: Record<string, StoryPhasePosition>;
  year: number;
  onStoryPhaseChange: (storyKey: string, position: StoryPhasePosition | null) => void;
}

export interface UseEpicStoriesOccupancyDataResult {
  isLoading: boolean;
  /** Сроки по эпикам (агрегат фаз стори) для отображения в строке эпика */
  parentKeyToPlanPhase: Map<string, TaskPosition>;
  plannedInSprintMaxStack: Map<string, number>;
  /** Позиции «запланировано в спринт» по storyKey/epicKey */
  plannedInSprintPositions: Map<string, TaskPosition[]>;
  sprintInfos: SprintInfo[];
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
  handlePositionSave: (position: TaskPosition, _isQa: boolean, _devTaskKey?: string) => Promise<void>;
}

/**
 * Данные для отображения занятости эпика по стори (эпик = группа, стори = строки с фазами).
 * Стори загружаются через usePlanEpicsWithStories; позиции берутся из storyPhases.
 */
export function useEpicStoriesOccupancyData({
  boardId,
  epicDetailsMap,
  planEpicKeys,
  quarter,
  sprints,
  storyPhases,
  year,
  onStoryPhaseChange,
}: UseEpicStoriesOccupancyDataParams): UseEpicStoriesOccupancyDataResult {
  const epicsWithStories: Array<{
    epicKey: string;
    epicName: string;
    stories: Array<{ key: string; name: string; originalStatus?: string; type?: string; priority?: string }>;
  }> = [];
  const isLoading = false;

  const sprintInfos = useMemo((): SprintInfo[] => {
    const quarterSprints = filterSprintsByQuarter(sprints, year, quarter);
    return quarterSprints.map((s) => ({
      id: s.id,
      name: s.name,
      startDate: s.startDate,
      endDate: s.endDate,
    }));
  }, [sprints, year, quarter]);

  const storyKeys = useMemo(
    () => epicsWithStories.flatMap((e) => e.stories.map((s) => s.key)),
    [epicsWithStories]
  );
  const storyKeyToEpicKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const epic of epicsWithStories) {
      for (const story of epic.stories) {
        map.set(story.key, epic.epicKey);
      }
    }
    return map;
  }, [epicsWithStories]);
  const { plannedInSprintPositions, plannedInSprintMaxStack } = usePlannedInSprintPositions(
    boardId,
    storyKeys,
    planEpicKeys,
    sprintInfos,
    storyKeyToEpicKey
  );

  const tasks = useMemo((): Task[] => {
    if (planEpicKeys.length === 0) return [];
    const result: Task[] = [];
    for (const epicKey of planEpicKeys) {
      const epicData = epicsWithStories.find((e) => e.epicKey === epicKey);
      const details = epicDetailsMap.get(epicKey);
      const name = details?.epicName ?? epicData?.epicName ?? epicKey;
      if (!epicData) {
        result.push(
          taskLikeNoParent(
            epicKey,
            name,
            details?.epicOriginalStatus,
            details?.epicType,
            details?.epicPriority
          )
        );
        continue;
      }
      if (epicData.stories.length === 0) {
        result.push(
          taskLikeNoParent(
            epicKey,
            name,
            details?.epicOriginalStatus,
            details?.epicType,
            details?.epicPriority
          )
        );
      } else {
        for (const s of epicData.stories) {
          result.push(
            storyToTaskLike(s.key, s.name, epicKey, name, s.originalStatus, s.type, s.priority)
          );
        }
      }
    }
    return result;
  }, [planEpicKeys, epicsWithStories, epicDetailsMap]);

  const taskPositions = useMemo(() => {
    const map = new Map<string, TaskPosition>();
    const defaultPhase: StoryPhasePosition = { sprintIndex: 0, startDay: 0, durationDays: 3 };
    tasks.forEach((t) => {
      const phase = storyPhases[t.id] ?? defaultPhase;
      map.set(t.id, storyPhaseToTaskPosition(t.id, phase));
    });
    return map;
  }, [storyPhases, tasks]);

  /** Сроки по эпикам: агрегат фаз всех стори эпика для отображения в строке эпика в occupancy */
  const parentKeyToPlanPhase = useMemo((): Map<string, TaskPosition> => {
    const map = new Map<string, TaskPosition>();
    for (const epic of epicsWithStories) {
      const positions = epic.stories
        .map((s) => taskPositions.get(s.key))
        .filter((p): p is TaskPosition => p != null);
      if (positions.length === 0) continue;
      const startDays = positions.map((p) => p.startDay);
      const endDays = positions.map((p) => p.startDay + p.duration / PARTS_PER_DAY);
      const minStart = Math.min(...startDays);
      const maxEnd = Math.max(...endDays);
      map.set(epic.epicKey, {
        taskId: epic.epicKey,
        startDay: minStart,
        startPart: 0,
        duration: (maxEnd - minStart) * PARTS_PER_DAY,
        assignee: '',
      });
    }
    return map;
  }, [epicsWithStories, taskPositions]);

  const handlePositionSave = useMemo(
    () =>
      async (
        position: TaskPosition,
        _isQa: boolean,
        _devTaskKey?: string
      ): Promise<void> => {
        const phase = taskPositionToStoryPhase(position);
        onStoryPhaseChange(position.taskId, phase);
        await Promise.resolve();
      },
    [onStoryPhaseChange]
  );

  return {
    handlePositionSave,
    isLoading,
    parentKeyToPlanPhase,
    plannedInSprintMaxStack,
    plannedInSprintPositions,
    sprintInfos,
    tasks,
    taskPositions,
  };
}
