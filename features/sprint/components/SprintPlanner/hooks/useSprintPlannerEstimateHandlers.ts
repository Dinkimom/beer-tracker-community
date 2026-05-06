import type { PhaseSegment, Task, TaskPosition } from '@/types';

import { useCallback } from 'react';

import { PARTS_PER_DAY } from '@/constants';
import { getSegmentEditorRangeAndCells } from '@/features/sprint/utils/occupancyUtils';
import { getTaskPoints, isEffectivelyQaTask } from '@/features/task/utils/taskUtils';
import { updateIssueWorkForPhase } from '@/lib/beerTrackerApi';
import { useRootStore } from '@/lib/layers';
import { timeslotsToStoryPoints } from '@/lib/pointsUtils';

export interface UseSprintPlannerEstimateHandlersParams {
  filteredTaskPositions: Map<string, TaskPosition>;
  qaTasksByOriginalId: Map<string, Task>;
  setTaskPositions: React.Dispatch<React.SetStateAction<Map<string, TaskPosition>>>;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  syncEstimates: boolean;
  tasksMap: Map<string, Task>;
  onTasksReload?: (options?: { showToast?: boolean }) => void;
  savePosition: (
    position: TaskPosition,
    isQa: boolean,
    devKey?: string,
    force?: boolean,
    options?: { recordHistory?: boolean }
  ) => Promise<void>;
}

/**
 * Оценки (SP/TP), сохранение позиций при ресайзе фаз и редактор отрезков.
 */
export function useSprintPlannerEstimateHandlers({
  filteredTaskPositions,
  onTasksReload,
  qaTasksByOriginalId,
  savePosition,
  setTaskPositions,
  setTasks,
  syncEstimates,
  tasksMap,
}: UseSprintPlannerEstimateHandlersParams) {
  const { sprintPlannerUi } = useRootStore();

  const handleUpdateEstimate = useCallback(
    (task: Task, newEstimate: number, isTestPoints: boolean, options?: { skipPositionSave?: boolean }) => {
      const targetId = isTestPoints && task.originalTaskId ? task.originalTaskId : task.id;
      const durationParts = Math.max(1, newEstimate);

      setTasks((prevTasks) =>
        prevTasks.map((t) => {
          if (t.id === targetId) {
            return { ...t, ...(isTestPoints ? { testPoints: newEstimate } : { storyPoints: newEstimate }) };
          }
          if (isTestPoints && t.originalTaskId === targetId) {
            return { ...t, testPoints: newEstimate };
          }
          return t;
        })
      );

      const positionUpdates: Array<{ taskId: string; isQa: boolean; devKey?: string }> = [];
      if (isTestPoints) {
        if (task.team === 'QA') {
          positionUpdates.push({
            taskId: task.id,
            isQa: true,
            devKey: task.originalTaskId ?? undefined,
          });
        } else {
          const qaTask = qaTasksByOriginalId.get(task.id);
          if (qaTask) {
            positionUpdates.push({ taskId: qaTask.id, isQa: true, devKey: task.id });
          }
        }
      } else {
        const devTaskId = task.team === 'QA' && task.originalTaskId ? task.originalTaskId : task.id;
        positionUpdates.push({ taskId: devTaskId, isQa: false });
      }

      const positionsToSave: { position: TaskPosition; isQa: boolean; devKey?: string }[] = [];
      for (const { taskId, isQa, devKey } of positionUpdates) {
        const pos = filteredTaskPositions.get(taskId);
        if (pos) {
          positionsToSave.push({
            position: { ...pos, duration: durationParts, plannedDuration: durationParts },
            isQa,
            devKey,
          });
        }
      }

      const skipPositionSave = options?.skipPositionSave ?? false;

      setTaskPositions((prev) => {
        const next = new Map(prev);
        for (const { taskId } of positionUpdates) {
          const p = next.get(taskId);
          if (p) {
            next.set(taskId, { ...p, duration: durationParts, plannedDuration: durationParts });
          }
        }
        return next;
      });

      if (!skipPositionSave) {
        positionsToSave.forEach(({ position, isQa, devKey }) => {
          const posWithSource = {
            ...(position as TaskPosition),
            __source: 'SprintPlanner.handleUpdateEstimate',
          } as TaskPosition & { __source: string };
          savePosition(posWithSource, isQa, devKey, true).catch((err) =>
            console.error('Error saving position after estimate update:', err)
          );
        });
      }
    },
    [setTasks, setTaskPositions, savePosition, filteredTaskPositions, qaTasksByOriginalId]
  );

  const handleEstimateUpdateSuccess = useCallback(() => {
    onTasksReload?.();
  }, [onTasksReload]);

  const handleSplitPhaseIntoSegments = useCallback(
    (task: Task) => {
      sprintPlannerUi.setContextMenu(null);
      sprintPlannerUi.setContextMenuTaskId(null);
      sprintPlannerUi.setSegmentEditTaskId(task.id);
    },
    [sprintPlannerUi]
  );

  const handleOccupancyPositionSave = useCallback(
    async (position: TaskPosition, isQa: boolean, devKey?: string) => {
      const fromSegmentEditor =
        (position as unknown as { __source?: string }).__source === 'SprintPlanner.onSegmentEditSave';

      const taskByPosition = tasksMap.get(position.taskId);
      const effectiveIsQa = isQa || !!(taskByPosition && isEffectivelyQaTask(taskByPosition));
      const devTask =
        effectiveIsQa && devKey ? tasksMap.get(devKey) : tasksMap.get(position.taskId);
      let currentEstimate: number | null = null;
      if (devTask) {
        currentEstimate = effectiveIsQa ? (devTask.testPoints ?? 0) : getTaskPoints(devTask);
      }

      const newSP = timeslotsToStoryPoints(position.duration);
      if (
        syncEstimates &&
        !fromSegmentEditor &&
        devTask &&
        currentEstimate !== null &&
        newSP !== currentEstimate
      ) {
        handleUpdateEstimate(devTask, newSP, effectiveIsQa, { skipPositionSave: true });
        const issueKey = effectiveIsQa && devKey ? devKey : position.taskId;
        updateIssueWorkForPhase(issueKey, newSP, effectiveIsQa).catch((err) =>
          console.error('Re-estimate on resize failed:', err)
        );
      }

      const positionWithSource = {
        ...position,
        __source: (position as unknown as { __source?: string }).__source ?? 'SprintPlanner.handleOccupancyPositionSave',
      } as TaskPosition & { __source: string };

      await savePosition(positionWithSource, isQa, devKey, true, { recordHistory: true });
    },
    [tasksMap, handleUpdateEstimate, savePosition, syncEstimates]
  );

  const handleSegmentEditSave = useCallback(
    (position: TaskPosition, segments: PhaseSegment[], isQa: boolean) => {
      const task = tasksMap.get(position.taskId);
      let positionFromSegments: TaskPosition & { __source: string };
      if (segments.length === 0) {
        const { rangeStartCell, totalCells } = getSegmentEditorRangeAndCells(position);
        positionFromSegments = {
          ...position,
          segments: [],
          startDay: Math.floor(rangeStartCell / PARTS_PER_DAY),
          startPart: rangeStartCell % PARTS_PER_DAY,
          duration: totalCells,
          __source: 'SprintPlanner.onSegmentEditSave',
        } as TaskPosition & { __source: string };
      } else {
        const effectiveDuration = segments.reduce((s, seg) => s + seg.duration, 0);
        positionFromSegments = {
          ...position,
          segments,
          duration: effectiveDuration,
          __source: 'SprintPlanner.onSegmentEditSave',
        } as TaskPosition & { __source: string };
      }
      const devKey = isQa && task?.team === 'QA' ? (task.originalTaskId ?? undefined) : undefined;
      void handleOccupancyPositionSave(positionFromSegments, isQa, devKey);
    },
    [tasksMap, handleOccupancyPositionSave]
  );

  return {
    handleEstimateUpdateSuccess,
    handleOccupancyPositionSave,
    handleSegmentEditSave,
    handleSplitPhaseIntoSegments,
    handleUpdateEstimate,
  };
}
