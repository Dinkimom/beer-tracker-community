import type { Task, TaskPosition } from '@/types';

import { positionToEndCell, positionToStartCell } from '@/features/sprint/utils/occupancyUtils';
import { TASK_ARROWS_DEV_QA_LINK_PREFIX } from '@/features/swimlane/utils/task-arrows/taskArrowsHelpers';

export interface OccupancyTaskLink { fromTaskId: string; id: string; toTaskId: string }

/** Подпись позиций для зависимости: при схлопывании/изменении отрезков перерисовываем стрелки */
export function getOccupancyTaskPositionsSignature(
  taskPositions: Map<string, TaskPosition>
): string {
  const entries = Array.from(taskPositions.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, pos]) => `${id}:${positionToStartCell(pos)}-${positionToEndCell(pos)}`);
  return entries.join('|');
}

export function filterOccupancyUserTaskLinks(
  taskLinks: OccupancyTaskLink[],
  taskIdsOrder: string[],
  devToQaTaskId: Map<string, string>
): OccupancyTaskLink[] {
  return taskLinks.filter((link) => {
    const fromIdx = taskIdsOrder.indexOf(link.fromTaskId);
    const toIdx = taskIdsOrder.indexOf(link.toTaskId);
    if (fromIdx === -1 || toIdx === -1) return false;
    const qaOfFrom = devToQaTaskId.get(link.fromTaskId);
    const qaOfTo = devToQaTaskId.get(link.toTaskId);
    if (qaOfFrom === link.toTaskId) return false;
    if (qaOfTo === link.fromTaskId) return false;
    return true;
  });
}

export function buildOccupancyDevToQaLinks(
  taskLinks: Array<{ fromTaskId: string; toTaskId: string }>,
  devToQaTaskId: Map<string, string>,
  taskPositions: Map<string, TaskPosition>,
  taskIdsOrder: string[]
): OccupancyTaskLink[] {
  const existingPair = new Set(taskLinks.map((l) => `${l.fromTaskId}-${l.toTaskId}`));
  const out: OccupancyTaskLink[] = [];
  devToQaTaskId.forEach((qaTaskId, devTaskId) => {
    const bothInPlan = taskPositions.has(devTaskId) && taskPositions.has(qaTaskId);
    if (
      bothInPlan &&
      taskIdsOrder.indexOf(devTaskId) !== -1 &&
      taskIdsOrder.indexOf(qaTaskId) !== -1 &&
      !existingPair.has(`${devTaskId}-${qaTaskId}`)
    ) {
      out.push({
        id: `${TASK_ARROWS_DEV_QA_LINK_PREFIX}${devTaskId}`,
        fromTaskId: devTaskId,
        toTaskId: qaTaskId,
      });
    }
  });
  return out;
}

export function getOccupancyRowTaskIds(
  taskId: string,
  devToQaTaskId: Map<string, string>,
  taskPositions: Map<string, TaskPosition>,
  tasksMap: Map<string, Task>
): string[] {
  const inPlan = (id: string) => taskPositions.has(id);
  if (devToQaTaskId.has(taskId)) {
    const qaId = devToQaTaskId.get(taskId)!;
    return [taskId, qaId].filter(inPlan);
  }
  const task = tasksMap.get(taskId);
  if (task?.originalTaskId) {
    const devId = task.originalTaskId;
    return [devId, taskId].filter(inPlan);
  }
  return inPlan(taskId) ? [taskId] : [];
}

export function getRightmostTaskIdInRow(
  taskIds: string[],
  taskPositions: Map<string, TaskPosition>
): string | null {
  if (taskIds.length === 0) return null;
  let maxEnd = -1;
  let result: string | null = null;
  for (const id of taskIds) {
    const pos = taskPositions.get(id);
    if (!pos) continue;
    const end = positionToEndCell(pos);
    if (end > maxEnd) {
      maxEnd = end;
      result = id;
    }
  }
  return result;
}

export function getLeftmostTaskIdInRow(
  taskIds: string[],
  taskPositions: Map<string, TaskPosition>
): string | null {
  if (taskIds.length === 0) return null;
  let minStart = Infinity;
  let result: string | null = null;
  for (const id of taskIds) {
    const pos = taskPositions.get(id);
    if (!pos) continue;
    const start = positionToStartCell(pos);
    if (start < minStart) {
      minStart = start;
      result = id;
    }
  }
  return result;
}

export function resolveOccupancyArrowEndpoints(
  link: OccupancyTaskLink,
  isDevQALink: boolean,
  taskIdsOrder: string[],
  taskPositions: Map<string, TaskPosition>,
  getRowTaskIds: (taskId: string) => string[]
): {
  arrowEndTaskId: string;
  arrowStartTaskId: string;
  endAnchor: 'bottom' | 'left' | 'top';
  endElement: string;
} {
  const sourceRowIds = getRowTaskIds(link.fromTaskId);
  const targetRowIds = getRowTaskIds(link.toTaskId);
  const arrowStartTaskId = isDevQALink
    ? link.fromTaskId
    : (getRightmostTaskIdInRow(sourceRowIds, taskPositions) ?? link.fromTaskId);
  const arrowEndTaskId = isDevQALink
    ? link.toTaskId
    : (getLeftmostTaskIdInRow(targetRowIds, taskPositions) ?? link.toTaskId);

  if (isDevQALink) {
    return {
      arrowEndTaskId,
      arrowStartTaskId,
      endAnchor: 'left',
      endElement: `occupancy-start-${arrowEndTaskId}`,
    };
  }

  const startPos = taskPositions.get(arrowStartTaskId);
  const sourceEndCell = startPos != null ? positionToEndCell(startPos) : -1;
  const endPos = taskPositions.get(arrowEndTaskId);
  const targetStartCell = endPos != null ? positionToStartCell(endPos) : Infinity;
  const fromIdx = taskIdsOrder.indexOf(link.fromTaskId);
  const toIdx = taskIdsOrder.indexOf(link.toTaskId);
  const adjacent =
    sourceEndCell >= 0 &&
    targetStartCell < Infinity &&
    targetStartCell <= sourceEndCell + 1;
  if (adjacent) {
    return {
      arrowEndTaskId,
      arrowStartTaskId,
      endAnchor: toIdx > fromIdx ? 'top' : 'bottom',
      endElement: `occupancy-phase-${arrowEndTaskId}`,
    };
  }
  return {
    arrowEndTaskId,
    arrowStartTaskId,
    endAnchor: 'left',
    endElement: `occupancy-start-${arrowEndTaskId}`,
  };
}
