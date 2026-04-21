import type { Task, TaskPosition } from '@/types';

import { PARTS_PER_DAY } from '@/constants';
import { getOrderedPlanSegments } from '@/features/swimlane/utils/positionUtils';
import { getPositionSegmentRanges } from '@/lib/planner-timeline';

interface TaskWithPosition {
  position: TaskPosition;
  task: Task;
}

interface Interval {
  end: number;
  start: number;
}

/**
 * Проверяет, пересекаются ли два интервала
 */
function intersects(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start;
}

function rangesIntersectCells(
  a: { endCell: number; startCell: number },
  b: { endCell: number; startCell: number }
): boolean {
  return a.startCell < b.endCell && a.endCell > b.startCell;
}

function taskPositionsIntersectInTime(a: TaskPosition, b: TaskPosition): boolean {
  const ra = getPositionSegmentRanges(a);
  const rb = getPositionSegmentRanges(b);
  for (const ia of ra) {
    for (const ib of rb) {
      if (rangesIntersectCells(ia, ib)) return true;
    }
  }
  return false;
}

/**
 * Распределяет интервалы по слоям так, чтобы пересекающиеся интервалы
 * находились в разных слоях
 */
function distributeToLayers(intervals: Array<{ end: number, id: string; start: number; }>) {
  const layers: Array<Array<typeof intervals[0]>> = [];

  intervals.forEach((interval) => {
    let placed = false;

    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const hasIntersection = layer.some((existing) =>
        intersects({ start: interval.start, end: interval.end }, { start: existing.start, end: existing.end })
      );

      if (!hasIntersection) {
        layer.push(interval);
        placed = true;
        break;
      }
    }

    if (!placed) {
      layers.push([interval]);
    }
  });

  return layers;
}

/**
 * Распределяет задачи по слоям для избежания визуального пересечения
 * (учитывает несколько отрезков занятости у одной задачи).
 */
export function distributeTasksToLayers(tasksWithPositions: TaskWithPosition[]): Map<string, number> {
  const items = tasksWithPositions.map(({ task, position }) => ({
    id: task.id,
    position,
  }));
  const layers: Array<Array<(typeof items)[0]>> = [];

  items.forEach((item) => {
    let placed = false;
    for (let layerIndex = 0; layerIndex < layers.length; layerIndex++) {
      const layer = layers[layerIndex];
      const hasConflict = layer.some((other) =>
        taskPositionsIntersectInTime(item.position, other.position)
      );
      if (!hasConflict) {
        layer.push(item);
        placed = true;
        break;
      }
    }
    if (!placed) {
      layers.push([item]);
    }
  });

  const layerMap = new Map<string, number>();
  layers.forEach((layer, layerIndex) => {
    layer.forEach(({ id }) => {
      layerMap.set(id, layerIndex);
    });
  });
  return layerMap;
}

/**
 * Вычисляет бейзлайны (отклонения от плана) для задач
 */
export function calculateBaselines(
  tasksWithPositions: TaskWithPosition[],
  currentCell: number
): Array<{ end: number, start: number; taskId: string; }> {
  const baselines: Array<{ end: number, start: number; taskId: string; }> = [];

  tasksWithPositions.forEach(({ task, position }) => {
    if (task.status !== 'in-progress' && task.status !== 'todo') return;
    const segments = getOrderedPlanSegments(position);
    for (const seg of segments) {
      const startCell = seg.startDay * PARTS_PER_DAY + seg.startPart;
      const plannedEndCell = startCell + seg.duration;
      if (plannedEndCell < currentCell) {
        baselines.push({
          taskId: task.id,
          start: plannedEndCell,
          end: currentCell,
        });
      }
    }
  });

  return baselines;
}

/**
 * Распределяет бейзлайны по слоям
 */
export function distributeBaselinesToLayers(
  baselines: Array<{ end: number, start: number; taskId: string; }>
): Map<string, number> {
  const intervals = baselines.map((baseline) => ({
    id: baseline.taskId,
    start: baseline.start,
    end: baseline.end,
  }));

  const layers = distributeToLayers(intervals);
  const layerMap = new Map<string, number>();

  layers.forEach((layer, layerIndex) => {
    layer.forEach(({ id }) => {
      layerMap.set(id, layerIndex);
    });
  });

  return layerMap;
}

