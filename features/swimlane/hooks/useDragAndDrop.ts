/**
 * Хук для управления drag and drop операциями
 */

import type { DragContextRef } from './useDragAndDrop/hooks/useDragEnd';
import type { Task, TaskPosition } from '@/types';

import { useMemo } from 'react';

import { getOrderedPlanSegments } from '@/features/swimlane/utils/positionUtils';
import { parseSwimlaneTaskDraggableId } from '@/features/swimlane/utils/swimlaneDragIds';
import { getTaskDuration } from '@/lib/layers/application/swimlaneDrag';

import { useDragEnd } from './useDragAndDrop/hooks/useDragEnd';
import { useDragOver } from './useDragAndDrop/hooks/useDragOver';
import { useDragStart } from './useDragAndDrop/hooks/useDragStart';
import { useDragState } from './useDragAndDrop/hooks/useDragState';

interface UseDragAndDropProps {
  dragContextRef?: DragContextRef | null;
  /** Рабочих дней в таймлайне свимлейна (длина спринта) */
  swimlaneTimelineWorkingDays?: number;
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
  onBacklogTaskDrop?: (taskId: string, assigneeId: string, day: number, part: number) => void;
  onPositionDelete: (taskId: string) => void;
  onPositionUpdate: (taskId: string, position: TaskPosition) => void;
  updateXarrow: () => void;
}

export function useDragAndDrop({
  tasks,
  taskPositions,
  onPositionUpdate,
  onPositionDelete,
  updateXarrow,
  onBacklogTaskDrop,
  dragContextRef,
  swimlaneTimelineWorkingDays,
}: UseDragAndDropProps) {
  const { dragUi, dragStateApi } = useDragState(taskPositions.size);

  const { handleDragStart } = useDragStart({
    tasks,
    taskPositions,
    dragState: dragStateApi,
  });

  const { handleDragOver } = useDragOver({
    tasks,
    taskPositions,
    dragState: dragStateApi,
    swimlaneTimelineWorkingDays,
  });

  const { handleDragEnd } = useDragEnd({
    tasks,
    taskPositions,
    onBacklogTaskDrop,
    onPositionDelete,
    onPositionUpdate,
    updateXarrow,
    dragState: dragStateApi,
    dragContextRef,
    swimlaneTimelineWorkingDays,
  });

  /**
   * Длительность для превью (подсветка ячеек, бейзлайн): при перетаскивании отрезка —
   * длина этого отрезка в частях дня, иначе эффективная длина позиции (как раньше).
   */
  const activeTaskDuration = useMemo(() => {
    if (!dragUi.activeTaskId) return null;
    const pos = taskPositions.get(dragUi.activeTaskId);
    if (
      dragUi.activeDraggableId &&
      pos?.segments &&
      pos.segments.length > 0
    ) {
      const { segmentIndex } = parseSwimlaneTaskDraggableId(dragUi.activeDraggableId);
      if (segmentIndex != null) {
        const ordered = getOrderedPlanSegments(pos);
        const seg = ordered[segmentIndex];
        if (seg) return seg.duration;
      }
    }
    return getTaskDuration(dragUi.activeTaskId, taskPositions, tasks);
  }, [dragUi.activeTaskId, dragUi.activeDraggableId, taskPositions, tasks]);

  return {
    activeTaskId: dragUi.activeTaskId,
    activeDraggableId: dragUi.activeDraggableId,
    isDraggingTask: dragUi.isDraggingTask,
    hoveredCell: dragUi.hoveredCell,
    activeTaskDuration,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    resetDragState: dragStateApi.resetDragState,
  };
}
