/**
 * Обработчики dnd-kit для свимлейна (без React; состояние через SwimlaneDragStateApi).
 */

import type { DragContextRef, SwimlaneDragStateApi } from './swimlaneDragTypes';
import type { Task, TaskPosition } from '@/types';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';

import { WORKING_DAYS, PARTS_PER_DAY } from '@/constants';
import { getPositionEffectiveDuration } from '@/features/sprint/utils/occupancyUtils';
import { moveSwimlanePlanSegmentToStartCell } from '@/features/swimlane/utils/positionUtils';
import { parseSwimlaneTaskDraggableId } from '@/features/swimlane/utils/swimlaneDragIds';

import { extractAssigneeId, isValidCell } from './swimlaneDragCellUtils';
import { calculateCellFromDragEvent } from './swimlaneDragPositionCalculation';
import { getTaskDuration } from './swimlaneDragTaskDuration';

function taskExistsInDragContext(
  taskId: string,
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>
): boolean {
  return tasks.some((t) => t.id === taskId) || taskPositions.has(taskId);
}

function applySwimlaneDragEndPositionUpdate(params: {
  finalCell: { assigneeId: string; day: number; part: number };
  onPositionUpdate: (taskId: string, position: TaskPosition) => void;
  segmentIndex: number | null | undefined;
  taskId: string;
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
  totalCells: number;
}): void {
  const { finalCell, onPositionUpdate, segmentIndex, taskId, taskPositions, tasks, totalCells } =
    params;
  const { assigneeId, day, part } = finalCell;

  const existing = taskPositions.get(taskId);
  if (existing) {
    const newStart = day * PARTS_PER_DAY + part;

    const isMultiSegmentSwimlane = existing.segments != null && existing.segments.length > 1;

    if (isMultiSegmentSwimlane) {
      if (assigneeId !== existing.assignee) {
        return;
      }
      if (segmentIndex == null) {
        return;
      }
      const moved = moveSwimlanePlanSegmentToStartCell(existing, segmentIndex, newStart, totalCells);
      if (!moved) {
        return;
      }
      onPositionUpdate(taskId, moved);
    } else {
      const effectiveDuration = getPositionEffectiveDuration(existing);
      const maxStart = totalCells - effectiveDuration;
      if (newStart > maxStart) {
        return;
      }
      if (existing.segments?.length === 1) {
        const seg = existing.segments[0]!;
        onPositionUpdate(taskId, {
          ...existing,
          assignee: assigneeId,
          startDay: day,
          startPart: part,
          plannedStartDay: day,
          plannedStartPart: part,
          duration: seg.duration,
          plannedDuration: seg.duration,
          segments: [{ ...seg, startDay: day, startPart: part, duration: seg.duration }],
        });
      } else {
        onPositionUpdate(taskId, {
          ...existing,
          assignee: assigneeId,
          startDay: day,
          startPart: part,
        });
      }
    }
  } else {
    const calculatedDuration = getTaskDuration(taskId, taskPositions, tasks);
    onPositionUpdate(taskId, {
      taskId,
      assignee: assigneeId,
      startDay: day,
      startPart: part,
      duration: calculatedDuration,
    });
  }
}

export function createSwimlaneDragStartHandler(params: {
  dragState: SwimlaneDragStateApi;
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
}): (event: DragStartEvent) => void {
  const { tasks, taskPositions, dragState } = params;

  return (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    const { taskId } = parseSwimlaneTaskDraggableId(activeId);

    if (!taskExistsInDragContext(taskId, tasks, taskPositions)) {
      return;
    }

    if (dragState.isDraggingTask && dragState.activeTaskId !== taskId) {
      dragState.resetDragState();
    }

    dragState.beginDragSession(activeId, taskId);
  };
}

export function createSwimlaneDragOverHandler(params: {
  dragState: SwimlaneDragStateApi;
  swimlaneTimelineWorkingDays?: number;
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
}): (event: DragOverEvent) => void {
  const { tasks, taskPositions, dragState, swimlaneTimelineWorkingDays = WORKING_DAYS } = params;
  const workingDaysCount = Math.max(1, swimlaneTimelineWorkingDays);

  return (event: DragOverEvent) => {
    if (!dragState.isDraggingTask || !dragState.activeTaskId) {
      return;
    }

    const activeTaskId = dragState.activeTaskId;
    if (!taskExistsInDragContext(activeTaskId, tasks, taskPositions)) {
      dragState.resetDragState();
      return;
    }

    const cell = calculateCellFromDragEvent(
      event,
      event.active.id as string,
      taskPositions,
      tasks,
      dragState.mousePositionRef,
      workingDaysCount
    );

    dragState.setHoveredCell(cell);
  };
}

export interface SwimlaneDragEndHandlerParams {
  dragContextRef?: DragContextRef | null;
  dragState: SwimlaneDragStateApi;
  swimlaneTimelineWorkingDays?: number;
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
  onBacklogTaskDrop?: (taskId: string, assigneeId: string, day: number, part: number) => void;
  onPositionDelete: (taskId: string) => void;
  onPositionUpdate: (taskId: string, position: TaskPosition) => void;
  updateXarrow: () => void;
}

export function createSwimlaneDragEndHandler(
  params: SwimlaneDragEndHandlerParams
): (event: DragEndEvent) => void {
  const {
    tasks,
    taskPositions,
    onBacklogTaskDrop,
    onPositionDelete,
    onPositionUpdate,
    updateXarrow,
    dragState,
    dragContextRef,
    swimlaneTimelineWorkingDays = WORKING_DAYS,
  } = params;
  const workingDaysCount = Math.max(1, swimlaneTimelineWorkingDays);
  const totalCells = workingDaysCount * PARTS_PER_DAY;

  return (event: DragEndEvent) => {
    try {
      const { active, over } = event;

      if (!over) {
        return;
      }

      const activeId = active.id as string;
      const { taskId, segmentIndex } = parseSwimlaneTaskDraggableId(activeId);
      const overId = over.id as string;

      if (!taskExistsInDragContext(taskId, tasks, taskPositions)) {
        return;
      }

      const ctx = dragContextRef?.current ?? null;
      const pointerX = dragState.mousePositionRef.current?.x;
      const translatedRect = active.rect.current?.translated;
      const cardCenterX = translatedRect
        ? translatedRect.left + translatedRect.width / 2
        : null;
      const sidebarWidth = ctx?.sidebarWidth ?? 0;
      const isPointerInSidebar = pointerX != null && pointerX < sidebarWidth;
      const isCardCenterInSidebar = cardCenterX != null && cardCenterX < sidebarWidth;
      const isDropInSidebarByPosition =
        ctx?.isDragFromSidebar &&
        ctx.sidebarOpen &&
        ctx.sidebarWidth > 0 &&
        (isPointerInSidebar || isCardCenterInSidebar);

      if (overId === 'sidebar-unassigned' || isDropInSidebarByPosition) {
        onPositionDelete(taskId);
        requestAnimationFrame(() => {
          updateXarrow();
        });
        return;
      }

      const isTaskInPositions = taskPositions.has(taskId);
      const taskInTasks = tasks.find((t) => t.id === taskId);
      const isFromBacklog = !isTaskInPositions && !taskInTasks;

      if (isFromBacklog && onBacklogTaskDrop) {
        const assigneeId = extractAssigneeId(overId);
        if (!assigneeId) {
          return;
        }

        const cell = calculateCellFromDragEvent(
          event,
          activeId,
          taskPositions,
          tasks,
          dragState.mousePositionRef,
          workingDaysCount
        );

        if (cell && isValidCell(cell, workingDaysCount)) {
          onBacklogTaskDrop(taskId, cell.assigneeId, cell.day, cell.part);
        } else {
          onBacklogTaskDrop(taskId, assigneeId, 0, 0);
        }

        requestAnimationFrame(() => {
          updateXarrow();
        });
        return;
      }

      const cell = calculateCellFromDragEvent(
        event,
        activeId,
        taskPositions,
        tasks,
        dragState.mousePositionRef,
        workingDaysCount
      );

      const finalCell =
        dragState.hoveredCell && dragState.hoveredCell.assigneeId === cell?.assigneeId
          ? dragState.hoveredCell
          : cell;

      if (!finalCell || !isValidCell(finalCell, workingDaysCount)) {
        return;
      }

      applySwimlaneDragEndPositionUpdate({
        finalCell,
        onPositionUpdate,
        segmentIndex,
        taskId,
        taskPositions,
        tasks,
        totalCells,
      });

      requestAnimationFrame(() => {
        updateXarrow();
      });
    } finally {
      dragState.resetDragState();
    }
  };
}
