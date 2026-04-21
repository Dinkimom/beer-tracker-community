'use client';

import type { GetTaskInfoFn } from '@/lib/layers/data/taskPositionsTypes';
import type { TaskPosition } from '@/types';
import type { MutableRefObject } from 'react';

import { useEffect } from 'react';

import { useDataSyncAssigneesStorage } from '@/hooks/useLocalStorage';
import { useRootStore } from '@/lib/layers';

export type { GetTaskInfoFn } from '@/lib/layers/data/taskPositionsTypes';

/**
 * Позиции задач на спринте: источник правды — MobX `TaskPositionsStore`, синхронизация с API.
 */
export function useTaskPositionsApi(
  sprintId: number | null,
  getTaskInfo?: GetTaskInfoFn | MutableRefObject<GetTaskInfoFn | undefined>
): [
  Map<string, TaskPosition>,
  (positions: Map<string, TaskPosition> | ((prev: Map<string, TaskPosition>) => Map<string, TaskPosition>)) => void,
  (position: TaskPosition, isQa?: boolean, devTaskKey?: string, immediate?: boolean) => Promise<void>,
  (taskId: string) => Promise<void>
] {
  const { taskPositions: positionsStore } = useRootStore();
  const [syncAssignees] = useDataSyncAssigneesStorage();

  useEffect(() => {
    positionsStore.setSyncAssigneesFlag(syncAssignees);
  }, [syncAssignees, positionsStore]);

  useEffect(() => {
    positionsStore.setResolveGetTaskInfo(() => {
      if (typeof getTaskInfo === 'function') {
        return getTaskInfo;
      }
      return getTaskInfo?.current;
    });
  }, [getTaskInfo, positionsStore]);

  useEffect(() => {
    positionsStore.loadSprint(sprintId).then(() => {
      /* ошибки и stale-ответы обрабатываются в TaskPositionsStore.loadSprint */
    });
  }, [positionsStore, sprintId]);

  return [
    positionsStore.positions as Map<string, TaskPosition>,
    (updater) => positionsStore.setPositionsWithSave(updater),
    (position, isQa, devTaskKey, immediate) =>
      positionsStore.savePosition(position, isQa, devTaskKey, immediate),
    (taskId) => positionsStore.deletePosition(taskId),
  ];
}
