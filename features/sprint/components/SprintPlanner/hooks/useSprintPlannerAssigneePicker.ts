import type { Developer, Task, TaskPosition } from '@/types';

import { useCallback, useState } from 'react';

import { createQATasksMap } from '@/features/qa/utils/qaTaskUtils';
import { useRootStore } from '@/lib/layers';

export type AssigneePickerState =
  | {
      mode: 'phase';
      anchorRect: DOMRect;
      position: TaskPosition;
      task: Task;
      taskName: string;
    }
  | {
      mode: 'qaEngineerQuickAdd';
      anchorRect: DOMRect;
      devTask: Task;
      taskName: string;
    };

export interface UseSprintPlannerAssigneePickerParams {
  developers: Developer[];
  filteredTaskPositions: Map<string, TaskPosition>;
  qaTaskManagement: {
    placeQATaskAtNearestFreeSlot: (
      qaTask: Task,
      updatedDev: Task,
      devTaskPosition: TaskPosition
    ) => boolean;
  };
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  syncAssignees: boolean;
  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
  savePosition: (
    position: TaskPosition,
    isQa: boolean,
    devKey?: string,
    force?: boolean
  ) => Promise<void>;
}

export function useSprintPlannerAssigneePicker({
  developers,
  filteredTaskPositions,
  qaTaskManagement,
  savePosition,
  setTasks,
  syncAssignees,
  taskPositions,
  tasks,
}: UseSprintPlannerAssigneePickerParams) {
  const { sprintPlannerUi } = useRootStore();
  const [assigneePicker, setAssigneePicker] = useState<AssigneePickerState | null>(null);

  const handleOpenAssigneePicker = useCallback(
    (data: { anchorRect: DOMRect; position: TaskPosition; task: Task; taskName: string }) => {
      setAssigneePicker({ mode: 'phase', ...data });
    },
    []
  );

  const handleChangeAssignee = useCallback(
    (task: Task) => {
      const contextMenu = sprintPlannerUi.contextMenu;
      const a = contextMenu?.anchorRect;
      const anchorRect = a
        ? new DOMRect(a.left, a.top, a.width, a.height)
        : new DOMRect(contextMenu?.position.x ?? 0, contextMenu?.position.y ?? 0, 1, 1);
      const position =
        taskPositions.get(task.id) ??
        ({
          taskId: task.id,
          assignee: task.team === 'QA' ? (task.qaEngineer ?? '') : (task.assignee ?? ''),
          duration: 1,
          startDay: 0,
          startPart: 0,
        } as TaskPosition);
      setAssigneePicker({
        mode: 'phase',
        anchorRect,
        position,
        task,
        taskName: task.name || 'Без названия',
      });
      sprintPlannerUi.setContextMenu(null);
      sprintPlannerUi.setContextMenuTaskId(null);
    },
    [sprintPlannerUi, taskPositions]
  );

  const onRequestQaEngineerPicker = useCallback(
    (devTaskId: string, anchorRect: DOMRect) => {
      const devTask = tasks.find((t) => t.id === devTaskId);
      if (!devTask) return;
      setAssigneePicker({
        mode: 'qaEngineerQuickAdd',
        anchorRect,
        devTask: { ...devTask },
        taskName: devTask.name || 'Без названия',
      });
    },
    [tasks]
  );

  const handleAssigneeSelect = useCallback(
    (assigneeId: string) => {
      if (!assigneePicker) return;

      if (assigneePicker.mode === 'qaEngineerQuickAdd') {
        const assigneeName = developers.find((d) => d.id === assigneeId)?.name;
        const devTaskId = assigneePicker.devTask.id;
        const updatedDev = {
          ...assigneePicker.devTask,
          qaEngineer: assigneeId,
          qaEngineerName: assigneeName ?? assigneePicker.devTask.qaEngineerName,
        };

        const nextTasksForMap = tasks.some((t) => t.id === devTaskId)
          ? tasks.map((t) => (t.id === devTaskId ? updatedDev : t))
          : [...tasks, updatedDev];
        const qaMap = createQATasksMap(nextTasksForMap);
        const qaTask = qaMap.get(devTaskId);
        const devTaskPosition = filteredTaskPositions.get(devTaskId);

        if (!qaTask || !devTaskPosition) {
          setAssigneePicker(null);
          return;
        }
        if (taskPositions.has(qaTask.id)) {
          setAssigneePicker(null);
          return;
        }

        const placed = qaTaskManagement.placeQATaskAtNearestFreeSlot(qaTask, updatedDev, devTaskPosition);
        if (!placed) {
          return;
        }

        setTasks((prev) =>
          prev.map((t) =>
            t.id === devTaskId
              ? { ...t, qaEngineer: assigneeId, qaEngineerName: assigneeName ?? t.qaEngineerName }
              : t
          )
        );
        setAssigneePicker(null);
        return;
      }

      const updated = {
        ...assigneePicker.position,
        assignee: assigneeId,
        __source: 'SprintPlanner.handleAssigneeSelect',
      } as TaskPosition & {
        __source: string;
      };
      const isQa = assigneePicker.task.team === 'QA';

      if (syncAssignees) {
        const assigneeName = developers.find((d) => d.id === assigneeId)?.name;
        setTasks((prev) =>
          prev.map((t) => {
            const targetId = isQa ? assigneePicker.task.originalTaskId : assigneePicker.task.id;
            if (t.id !== targetId) return t;
            const name = assigneeName ?? (isQa ? t.qaEngineerName : t.assigneeName);
            return isQa
              ? { ...t, qaEngineer: assigneeId, qaEngineerName: name }
              : { ...t, assignee: assigneeId, assigneeName: name };
          })
        );
      }

      savePosition(updated, isQa, isQa ? assigneePicker.task.originalTaskId : undefined, true);
      setAssigneePicker(null);
    },
    [
      assigneePicker,
      developers,
      filteredTaskPositions,
      qaTaskManagement,
      savePosition,
      setTasks,
      syncAssignees,
      taskPositions,
      tasks,
    ]
  );

  return {
    assigneePicker,
    setAssigneePicker,
    handleAssigneeSelect,
    handleChangeAssignee,
    handleOpenAssigneePicker,
    onRequestQaEngineerPicker,
  };
}
