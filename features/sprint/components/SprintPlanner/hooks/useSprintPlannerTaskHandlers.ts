/**
 * Хук для обработчиков операций с задачами в SprintPlanner
 */

import type { Developer, Task, TaskPosition } from '@/types';

import { useCallback } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';
import { useTaskResize } from '@/features/task/hooks/useTaskResize';
import { calculateOccupiedIntervals, findNextAvailableCell } from '@/features/task/utils/autoAssignTasks/utils/intervalUtils';
import { getTaskPoints, isEffectivelyQaTask } from '@/features/task/utils/taskUtils';
import { useDataSyncEstimatesStorage } from '@/hooks/useLocalStorage';
import { addIssueToSprint, updateIssueWorkForPhase } from '@/lib/beerTrackerApi';
import { storyPointsToTimeslots, timeslotsToStoryPoints } from '@/lib/pointsUtils';
import { DELAYS } from '@/utils/constants';

interface UseSprintPlannerTaskHandlersProps {
  backlogTaskRef: React.MutableRefObject<{
    getTask: (taskId: string) => Task | undefined;
    removeTask: (taskId: string) => void;
  } | null>;
  developers: Developer[];
  filteredTaskPositions?: Map<string, TaskPosition>;
  qaTaskManagement?: {
    createQATask: (devTaskId: string, qaTasksMap: Map<string, Task>, tasks: Task[]) => void;
  };
  qaTasksByOriginalId: Map<string, Task>;
  qaTasksMap: Map<string, Task>;
  selectedSprintId: number | null;
  /** Рабочих дней в таймлайне (длина спринта) */
  sprintTimelineWorkingDays?: number;
  tasks: Task[];
  tasksMap: Map<string, Task>;
  debouncedUpdateXarrow: () => void;
  deletePosition: (taskId: string) => Promise<void>;
  /** Нет qaEngineer на dev-задаче — открыть пикер QA (anchor с кнопки +) */
  onRequestQaEngineerPicker?: (devTaskId: string, anchorRect: DOMRect) => void;
  savePosition: (position: TaskPosition, isQa: boolean, devTaskKey?: string) => Promise<void>;
  setTaskPositions: (updater: (prev: Map<string, TaskPosition>) => Map<string, TaskPosition>) => void;
  setTasks: (updater: (prev: Task[]) => Task[]) => void;
}

export function useSprintPlannerTaskHandlers({
  backlogTaskRef,
  developers,
  filteredTaskPositions,
  qaTaskManagement,
  onRequestQaEngineerPicker,
  qaTasksByOriginalId,
  qaTasksMap,
  selectedSprintId,
  sprintTimelineWorkingDays = WORKING_DAYS,
  setTaskPositions,
  setTasks,
  tasks,
  tasksMap,
  debouncedUpdateXarrow,
  deletePosition,
  savePosition,
}: UseSprintPlannerTaskHandlersProps) {
  const [syncEstimates] = useDataSyncEstimatesStorage();
  // Хук для обработки изменения размера задач
  const timelineTotalCells = sprintTimelineWorkingDays * PARTS_PER_DAY;

  const { handleTaskResize } = useTaskResize({
    setTaskPositions,
    timelineTotalCells,
    updateXarrow: debouncedUpdateXarrow,
    onAfterResize: (taskId, newDuration, updatedPosition) => {
      const task = tasksMap.get(taskId) || qaTasksByOriginalId.get(taskId);
      if (!task) return;

      const effectiveIsQa = isEffectivelyQaTask(task);
      const devTask =
        effectiveIsQa && task.originalTaskId
          ? tasksMap.get(task.originalTaskId) ?? task
          : task;

      const currentEstimate =
        devTask == null
          ? null
          : effectiveIsQa
            ? devTask.testPoints ?? 0
            : getTaskPoints(devTask);

      const newSP = timeslotsToStoryPoints(newDuration);

      if (devTask && currentEstimate !== null && currentEstimate !== newSP) {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id === devTask.id) {
              return effectiveIsQa
                ? { ...t, testPoints: newSP }
                : { ...t, storyPoints: newSP };
            }
            if (effectiveIsQa && t.originalTaskId === devTask.id) {
              return { ...t, testPoints: newSP };
            }
            return t;
          })
        );

        const issueKey = effectiveIsQa
          ? (devTask.team === 'QA' ? (devTask.originalTaskId ?? devTask.id) : devTask.id)
          : devTask.id;

        if (syncEstimates) {
          updateIssueWorkForPhase(issueKey, newSP, effectiveIsQa).catch((error) => {
            console.error('Re-estimate on swimlane resize failed:', error);
          });
        }
      }

      const isQaPhase = effectiveIsQa && task.team === 'QA';
      const updatedPos: TaskPosition & { __source: string } = {
        ...updatedPosition,
        __source: 'useSprintPlannerTaskHandlers.handleTaskResize',
      };
      savePosition(
        updatedPos,
        isQaPhase,
        isQaPhase ? task.originalTaskId : undefined
      ).catch((error) => {
        console.error('Error saving position after swimlane resize:', error);
      });
    },
  });

  // Обработчик перетаскивания задачи из бэклога на свимлейн
  const handleBacklogTaskDrop = useCallback(
    (taskId: string, assigneeId: string, day: number, part: number) => {
      if (!selectedSprintId) {
        return;
      }

      const backlogTask = backlogTaskRef.current?.getTask(taskId);
      if (!backlogTask) {
        return;
      }

      // 1. Сразу обновляем локальный стейт - добавляем задачу в tasks
      setTasks((prev) => {
        if (prev.find(t => t.id === taskId)) {
          return prev;
        }
        return [...prev, backlogTask];
      });

      // 2. Сразу добавляем задачу в позиции
      const calculatedDuration = Math.max(1, storyPointsToTimeslots(getTaskPoints(backlogTask)));
      const isQa = backlogTask.team === 'QA';
      const position: TaskPosition = {
        taskId,
        assignee: assigneeId,
        startDay: day,
        startPart: part,
        duration: calculatedDuration,
        plannedStartDay: day,
        plannedStartPart: part,
        plannedDuration: calculatedDuration,
      };
      setTaskPositions((prev) => {
        const newPositions = new Map(prev);
        newPositions.set(taskId, position);
        return newPositions;
      });
      // Сохраняем позицию через API (асинхронно)
      if (selectedSprintId) {
        const positionWithSource: TaskPosition & { __source: string } = {
          ...position,
          __source: 'useSprintPlannerTaskHandlers.handleBacklogTaskDrop',
        };
        savePosition(positionWithSource, isQa, isQa ? backlogTask.originalTaskId : undefined).catch((error) => {
          console.error('Error saving position:', error);
        });
      }

      // 3. Удаляем задачу из бэклога
      backlogTaskRef.current?.removeTask(taskId);

      // 4. Обновляем стрелки после обновления DOM
      setTimeout(() => debouncedUpdateXarrow(), DELAYS.IMMEDIATE);

      // 5. Асинхронно отправляем API запрос (не ждем ответа)
      addIssueToSprint(taskId, selectedSprintId).catch((error) => {
        console.error('Error adding backlog task to sprint:', error);
      });
    },
    [selectedSprintId, setTasks, setTaskPositions, savePosition, debouncedUpdateXarrow, backlogTaskRef]
  );

  // Обработчик обновления позиции задачи при перетаскивании
  const handlePositionUpdate = useCallback(
    (taskId: string, position: TaskPosition) => {
      setTaskPositions((prev) => {
        const newPositions = new Map(prev);

        // При перетаскивании обновляем planned позиции на новые значения
        // чтобы baseline пересчитывался относительно нового плана
        const updatedPosition: TaskPosition = {
          ...position,
          plannedStartDay: position.startDay,
          plannedStartPart: position.startPart,
          plannedDuration: position.duration,
        };

        newPositions.set(taskId, updatedPosition);
        return newPositions;
      });

      // Определяем, является ли задача QA
      const task = tasksMap.get(taskId) || qaTasksByOriginalId.get(taskId);
      const isQa = task?.team === 'QA' || false;

      // Сохраняем позицию через API (асинхронно)
      if (selectedSprintId) {
        // При перетаскивании обновляем planned позиции на новые значения
        const updatedPosition: TaskPosition & { __source: string } = {
          ...position,
          plannedStartDay: position.startDay,
          plannedStartPart: position.startPart,
          plannedDuration: position.duration,
          __source: 'useSprintPlannerTaskHandlers.handlePositionUpdate',
        };
        savePosition(updatedPosition, isQa, isQa ? task?.originalTaskId : undefined).catch((error) => {
          console.error('Error saving position:', error);
        });
      }
    },
    [
      setTaskPositions,
      tasksMap,
      qaTasksByOriginalId,
      selectedSprintId,
      savePosition,
    ]
  );

  // Обработчик удаления позиции задачи (оптимистично: сначала локально, затем запрос)
  const handlePositionDelete = useCallback(
    (taskId: string) => {
      setTaskPositions((prev) => {
        const newPositions = new Map(prev);
        newPositions.delete(taskId);
        return newPositions;
      });
      deletePosition(taskId).catch((error) => {
        console.error('Error deleting position:', error);
        // При ошибке перезагрузим позиции — они подтянутся при следующем fetch
      });
    },
    [setTaskPositions, deletePosition]
  );

  const handleCreateQATask = useCallback(
    (devTaskId: string, anchorRect?: DOMRect) => {
      const devTask = tasks.find((t) => t.id === devTaskId);
      const hasQaEngineer = Boolean(devTask?.qaEngineer?.trim());
      if (!hasQaEngineer) {
        if (anchorRect && onRequestQaEngineerPicker) {
          onRequestQaEngineerPicker(devTaskId, anchorRect);
        }
        return;
      }
      if (qaTaskManagement) {
        qaTaskManagement.createQATask(devTaskId, qaTasksMap, tasks);
      }
    },
    [qaTaskManagement, qaTasksMap, tasks, onRequestQaEngineerPicker]
  );

  // Добавить задачу в ближайшее пустое место от начала спринта (для кнопки в сайдбаре)
  const handleAutoAddToSwimlane = useCallback(
    (task: Task) => {
      if (!selectedSprintId || !filteredTaskPositions) return;
      const assigneeId = task.team === 'QA' ? task.qaEngineer : task.assignee;
      if (!assigneeId) return;
      const developerIds = developers.map((d) => d.id);
      if (!developerIds.includes(assigneeId)) return;
      const duration = Math.max(1, storyPointsToTimeslots(getTaskPoints(task)));
      const occupiedIntervals = calculateOccupiedIntervals(filteredTaskPositions, developerIds);
      const intervals = occupiedIntervals.get(assigneeId) ?? [];
      const startCell = findNextAvailableCell(intervals, duration, 0);
      if (startCell === null) return;
      const startDay = Math.floor(startCell / PARTS_PER_DAY);
      const startPart = startCell % PARTS_PER_DAY;
      const isQa = task.team === 'QA';
      const position: TaskPosition = {
        taskId: task.id,
        assignee: assigneeId,
        startDay,
        startPart,
        duration,
        plannedStartDay: startDay,
        plannedStartPart: startPart,
        plannedDuration: duration,
      };
      setTaskPositions((prev) => {
        const next = new Map(prev);
        next.set(task.id, position);
        return next;
      });
      savePosition(position, isQa, isQa ? task.originalTaskId : undefined).catch((err) => {
        console.error('Error saving position:', err);
      });
      setTimeout(() => debouncedUpdateXarrow(), DELAYS.IMMEDIATE);
    },
    [
      selectedSprintId,
      filteredTaskPositions,
      developers,
      setTaskPositions,
      savePosition,
      debouncedUpdateXarrow,
    ]
  );

  return {
    handleAutoAddToSwimlane,
    handleBacklogTaskDrop,
    handleCreateQATask,
    handlePositionDelete,
    handlePositionUpdate,
    handleTaskResize,
  };
}

