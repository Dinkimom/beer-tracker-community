/**
 * Хук для обработки изменения размера задач
 */

import type { TaskPosition } from '@/types';

import { useCallback } from 'react';

import { WORKING_DAYS, PARTS_PER_DAY } from '@/constants';
import { getMaxDuration, resizeSwimlanePlanSegment } from '@/features/swimlane/utils/positionUtils';
import { DELAYS } from '@/utils/constants';

interface UseTaskResizeProps {
  /** Всего ячеек таймлайна свимлейна (рабочие дни × части дня) */
  timelineTotalCells?: number;
  /**
   * Коллбэк после изменения длительности задачи.
   * `updatedPosition` — актуальная позиция после ресайза.
   */
  onAfterResize?: (
    taskId: string,
    newDuration: number,
    updatedPosition: TaskPosition
  ) => void;
  setTaskPositions: (updater: (prev: Map<string, TaskPosition>) => Map<string, TaskPosition>) => void;
  updateXarrow: () => void;
}

export interface TaskResizeParams {
  newDuration: number;
  newStartCell?: number;
  /** Индекс отрезка в getOrderedPlanSegments — при ресайзе карточки с несколькими отрезками */
  planSegmentIndex?: number;
}

/**
 * Хук для обработки изменения размера задачи
 */
export function useTaskResize({
  setTaskPositions,
  updateXarrow,
  onAfterResize,
  timelineTotalCells = WORKING_DAYS * PARTS_PER_DAY,
}: UseTaskResizeProps) {
  const handleTaskResize = useCallback(
    (taskId: string, params: TaskResizeParams) => {
      if (params.newDuration < 1) return;

      let finalDurationForCallback: number | null = null;
      let outgoingPosition: TaskPosition | null = null;

      setTaskPositions((prev) => {
        const newPositions = new Map(prev);
        const position = newPositions.get(taskId);
        if (!position) return prev;

        const totalCells = timelineTotalCells;

        if (
          params.planSegmentIndex !== undefined &&
          position.segments &&
          position.segments.length > 0
        ) {
          const newDuration = Math.max(1, params.newDuration);
          const resized = resizeSwimlanePlanSegment(
            position,
            params.planSegmentIndex,
            newDuration,
            params.newStartCell,
            totalCells
          );
          if (!resized) return prev;
          const withPlanned: TaskPosition = {
            ...resized,
            plannedDuration: resized.duration,
            plannedStartDay: resized.startDay,
            plannedStartPart: resized.startPart,
          };
          newPositions.set(taskId, withPlanned);
          outgoingPosition = withPlanned;
          finalDurationForCallback = resized.duration;
          return newPositions;
        }

        const newPosition = { ...position };
        if (newPosition.segments && newPosition.segments.length > 0) {
          newPosition.segments = [];
        }

        if (params.newStartCell !== undefined) {
          const newStartCell = Math.max(0, Math.min(params.newStartCell, totalCells - 1));
          const newDay = Math.floor(newStartCell / PARTS_PER_DAY);
          const newPart = newStartCell % PARTS_PER_DAY;

          newPosition.startDay = newDay;
          newPosition.startPart = newPart;
          newPosition.plannedStartDay = newDay;
          newPosition.plannedStartPart = newPart;
        }

        const maxDuration = getMaxDuration(newPosition, totalCells);
        const newDuration = Math.min(Math.max(1, params.newDuration), maxDuration);

        newPosition.duration = newDuration;
        newPosition.plannedDuration = newDuration;

        newPositions.set(taskId, newPosition);
        outgoingPosition = newPosition;
        finalDurationForCallback = newDuration;
        return newPositions;
      });
      setTimeout(() => updateXarrow(), DELAYS.IMMEDIATE);

      if (finalDurationForCallback != null && outgoingPosition != null) {
        onAfterResize?.(taskId, finalDurationForCallback, outgoingPosition);
      }
    },
    [setTaskPositions, updateXarrow, onAfterResize, timelineTotalCells]
  );

  return {
    handleTaskResize,
  };
}
