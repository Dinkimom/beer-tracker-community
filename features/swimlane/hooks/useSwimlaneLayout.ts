/**
 * Хук для расчета layout свимлейна (слои, позиции, высота)
 */

import type { Task, TaskPosition } from '@/types';

import { useMemo } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';
import { isTaskDone } from '@/features/sprint/utils/sprintMetrics';
import {
  distributeTasksToLayers,
  calculateBaselines,
  distributeBaselinesToLayers,
} from '@/features/swimlane/utils/layerUtils';
import { useSwimlaneCardFieldsStorage } from '@/hooks/useLocalStorage';
import { positionToStartCell } from '@/lib/planner-timeline';
import { getTaskStoryPoints, getTaskTestPoints } from '@/lib/pointsUtils';
import { getCurrentSprintCell } from '@/utils/dateUtils';

interface UseSwimlaneLayoutProps {
  developerId: string;
  sprintStartDate: Date;
  sprintTimelineWorkingDays?: number;
  taskPositions: Map<string, TaskPosition>;
  /** Карта всех задач: по ней определяем, что реально лежит в свимлейне (по позициям на доске). */
  tasksMap: Map<string, Task>;
}

/** Задачи в свимлейне = только те, у кого в taskPositions assignee совпадает с developerId (то, что лежит на строке). */
export function useSwimlaneLayout({
  developerId,
  sprintStartDate,
  sprintTimelineWorkingDays = WORKING_DAYS,
  taskPositions,
  tasksMap,
}: UseSwimlaneLayoutProps) {
  const [swimlaneCardFields] = useSwimlaneCardFieldsStorage();

  // Нельзя useMemo([taskPositions, …]): taskPositions — тот же observable.map, при DnD мутирует на месте,
  // ссылка не меняется — positionedTasks оставался со старыми координатами (занятость жила отдельным путём).
  const positionedTasks: Array<{ task: Task; position: TaskPosition }> = [];
  taskPositions.forEach((position, taskId) => {
    if (position.assignee !== developerId) return;
    const task = tasksMap.get(taskId);
    if (!task) return;
    positionedTasks.push({ task, position });
  });
  positionedTasks.sort(
    (a, b) => positionToStartCell(a.position) - positionToStartCell(b.position)
  );

  const totalSP = positionedTasks.reduce((sum, { task }) => sum + getTaskStoryPoints(task), 0);
  const totalTP = positionedTasks.reduce((sum, { task }) => sum + getTaskTestPoints(task), 0);

  let completedSP = 0;
  let completedTP = 0;
  for (const { task } of positionedTasks) {
    if (!isTaskDone(task)) continue;
    completedSP += getTaskStoryPoints(task);
    completedTP += getTaskTestPoints(task);
  }
  const percentSP = totalSP > 0 ? Math.round((completedSP / totalSP) * 100) : 0;
  const percentTP = totalTP > 0 ? Math.round((completedTP / totalTP) * 100) : 0;

  const currentCell = useMemo(() => {
    return getCurrentSprintCell(sprintStartDate, PARTS_PER_DAY, sprintTimelineWorkingDays);
  }, [sprintStartDate, sprintTimelineWorkingDays]);

  const baselines = calculateBaselines(positionedTasks, currentCell);
  const taskLayerMap = distributeTasksToLayers(positionedTasks);
  const baselineLayerMap = distributeBaselinesToLayers(baselines);

  const maxTaskLayers =
    Math.max(...Array.from(taskLayerMap.values()), -1) + 1 || 1;
  const maxBaselineLayers =
    Math.max(...Array.from(baselineLayerMap.values()), -1) + 1 || 0;

  const hasBaselineOverlaps = maxBaselineLayers > 1;
  const hasTaskOverlaps = maxTaskLayers > 1;

  const baseHeight = swimlaneCardFields.showParent ? 85 : 70;
  const layerHeight = baseHeight;
  const totalHeight = hasTaskOverlaps ? baseHeight * maxTaskLayers : baseHeight;
  const baselineLayerHeight = hasBaselineOverlaps && maxBaselineLayers > 0
    ? totalHeight / maxBaselineLayers
    : totalHeight;

  return {
    positionedTasks,
    totalSP,
    totalTP,
    completedSP,
    completedTP,
    percentSP,
    percentTP,
    currentCell,
    baselines,
    taskLayerMap,
    baselineLayerMap,
    maxTaskLayers,
    maxBaselineLayers,
    hasBaselineOverlaps,
    hasTaskOverlaps,
    baseHeight,
    layerHeight,
    totalHeight,
    baselineLayerHeight,
  };
}

