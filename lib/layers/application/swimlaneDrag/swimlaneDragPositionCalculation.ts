/**
 * Вычисление целевой ячейки по событию dnd-kit и DOM.
 */

import type { CellPosition } from './swimlaneDragTypes';
import type { Task, TaskPosition } from '@/types';
import type { DragEndEvent, DragOverEvent } from '@dnd-kit/core';
import type { MutableRefObject } from 'react';

import { WORKING_DAYS } from '@/constants';
import { parseSwimlaneTaskDraggableId } from '@/features/swimlane/utils/swimlaneDragIds';
import { calculateCellFromElement, calculateCellFromMouse } from '@/lib/swimlane/swimlaneCellFromGeometry';

import { extractAssigneeId, extractCellFromId, isValidCell } from './swimlaneDragCellUtils';
import { getMouseX } from './swimlaneDragMouseUtils';
import { getTaskDuration } from './swimlaneDragTaskDuration';

function escapeSelectorAttr(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function tryCellFromElementInSwimlane(
  assigneeId: string,
  swimlaneElement: HTMLElement,
  activeElement: HTMLElement,
  workingDaysCount: number
): CellPosition | null {
  try {
    const cardRect = activeElement.getBoundingClientRect();
    const swimlaneRect = swimlaneElement.getBoundingClientRect();
    const cell = calculateCellFromElement(cardRect, swimlaneRect, swimlaneElement, workingDaysCount);
    if (cell && isValidCell({ assigneeId, ...cell }, workingDaysCount)) {
      return { assigneeId, ...cell };
    }
  } catch (error) {
    console.warn('Error calculating cell from element:', error);
  }
  return null;
}

function tryCellFromMousePosition(
  assigneeId: string,
  swimlaneElement: HTMLElement,
  mouseX: number,
  taskId: string,
  taskPositions: Map<string, TaskPosition>,
  tasks: Task[],
  workingDaysCount: number
): CellPosition | null {
  try {
    const taskDuration = getTaskDuration(taskId, taskPositions, tasks);
    const swimlaneRect = swimlaneElement.getBoundingClientRect();
    const cell = calculateCellFromMouse(
      mouseX,
      swimlaneRect,
      taskDuration,
      swimlaneElement,
      workingDaysCount
    );

    if (cell && isValidCell({ assigneeId, ...cell }, workingDaysCount)) {
      return { assigneeId, ...cell };
    }
  } catch (error) {
    console.warn('Error calculating cell from mouse:', error);
  }
  return null;
}

/**
 * Вычисляет позицию ячейки из события перетаскивания
 * @param draggableActiveId — id активного элемента dnd-kit (в т.ч. `taskId::segmentIndex`)
 */
export function calculateCellFromDragEvent(
  event: DragEndEvent | DragOverEvent,
  draggableActiveId: string,
  taskPositions: Map<string, TaskPosition>,
  tasks: Task[],
  mousePositionRef: MutableRefObject<{ x: number; y: number } | null>,
  workingDaysCount: number = WORKING_DAYS
): CellPosition | null {
  const { taskId } = parseSwimlaneTaskDraggableId(draggableActiveId);
  const { over } = event;

  if (!over) {
    return null;
  }

  const overId = over.id as string;

  if (overId === 'sidebar-unassigned') {
    return null;
  }

  const assigneeId = extractAssigneeId(overId);
  if (!assigneeId) {
    return null;
  }

  let swimlaneElement: HTMLElement | null = null;
  try {
    swimlaneElement = document.querySelector(
      `[data-swimlane="${assigneeId}"]`
    ) as HTMLElement | null;
  } catch (error) {
    console.warn('Error querying swimlane element:', error);
    return null;
  }

  if (!swimlaneElement) {
    return null;
  }

  const isTaskInPositions = taskPositions.has(taskId);
  let activeElement: HTMLElement | null = null;
  try {
    activeElement = document.querySelector(
      `[data-draggable-id="${escapeSelectorAttr(draggableActiveId)}"]`
    ) as HTMLElement | null;
  } catch (error) {
    console.warn('Error querying active element:', error);
  }
  const isElementInSwimlane = isTaskInPositions && activeElement && swimlaneElement.contains(activeElement);

  if (isElementInSwimlane && activeElement) {
    const fromElement = tryCellFromElementInSwimlane(
      assigneeId,
      swimlaneElement,
      activeElement,
      workingDaysCount
    );
    if (fromElement) {
      return fromElement;
    }
  }

  const mouseX = getMouseX(mousePositionRef, event);
  if (mouseX === null) {
    if (!isTaskInPositions && !isElementInSwimlane) {
      return null;
    }

    const cellFromId = extractCellFromId(overId);
    return cellFromId && isValidCell(cellFromId, workingDaysCount) ? cellFromId : null;
  }

  const fromMouse = tryCellFromMousePosition(
    assigneeId,
    swimlaneElement,
    mouseX,
    taskId,
    taskPositions,
    tasks,
    workingDaysCount
  );
  if (fromMouse) {
    return fromMouse;
  }

  if (isElementInSwimlane) {
    const cellFromId = extractCellFromId(overId);
    return cellFromId && isValidCell(cellFromId, workingDaysCount) ? cellFromId : null;
  }

  return null;
}
