'use client';

import { autorun } from 'mobx';
import { useSyncExternalStore } from 'react';

import { useRootStore } from '@/lib/layers';

/**
 * Готовность позиций для вкладки «Доска»: нет in-flight загрузки и стор отмечает этот спринт как
 * «успокоившийся» после последней волны fetch (см. TaskPositionsStore.loadSprint).
 * `null` / `undefined` — гейт не нужен (не доска или нет спринта).
 */
export function useTaskPositionsBoardGateReady(sprintId: number | null | undefined): boolean {
  const { taskPositions } = useRootStore();

  return useSyncExternalStore(
    (onStoreChange) => {
      return autorun(() => {
        void taskPositions.positionsLoadPending;
        void taskPositions.positionsSettledSprintId;
        onStoreChange();
      });
    },
    () => {
      if (sprintId == null) return true;
      return (
        !taskPositions.positionsLoadPending &&
        taskPositions.positionsSettledSprintId === sprintId
      );
    },
    () => false
  );
}
