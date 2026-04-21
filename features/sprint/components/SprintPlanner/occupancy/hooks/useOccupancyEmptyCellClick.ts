import type { Task, Developer, TaskPosition } from '@/types';

import { useCallback } from 'react';

import { getDevelopersForTask } from '@/features/sprint/utils/getDevelopersForTask';
import { getTaskPoints, isQaOnlyTask } from '@/features/task/utils/taskUtils';
import { storyPointsToTimeslots } from '@/lib/pointsUtils';

export function useOccupancyEmptyCellClick({
  developers,
  onOpenAssigneePicker,
  onPositionSave,
}: {
  developers: Developer[];
  onOpenAssigneePicker?: (data: {
    anchorRect: DOMRect;
    position: TaskPosition;
    task: Task;
    taskName: string;
  }) => void;
  onPositionSave?: (position: TaskPosition, isQa: boolean, devTaskKey?: string) => Promise<void> | void;
}) {
  const handleEmptyCellClick = useCallback(
    (
      targetTask: Task,
      dayIndex: number,
      partIndex: number,
      cellElement: HTMLElement,
      getAnchorRect?: (cell: HTMLElement) => DOMRect
    ) => {
      const eligible = getDevelopersForTask(developers, targetTask);
      const isSyntheticQa = targetTask.team === 'QA';
      const effectivelyQa = isQaOnlyTask(targetTask);
      const useQaAssignment = isSyntheticQa || effectivelyQa;

      // Исполнитель задачи считается валидным, если он есть в списке команды (developers)
      const taskAssigneeInTeam = (id: string) => developers.some((d) => d.id === id);

      // Определяем исполнителя: при наличии у задачи — используем его (если в команде), иначе первого из eligible
      let defaultAssignee: string | undefined;
      if (useQaAssignment) {
        if (targetTask.qaEngineer && taskAssigneeInTeam(targetTask.qaEngineer)) {
          defaultAssignee = targetTask.qaEngineer;
        }
      } else {
        if (targetTask.assignee && taskAssigneeInTeam(targetTask.assignee)) {
          defaultAssignee = targetTask.assignee;
        }
      }
      if (!defaultAssignee) {
        defaultAssignee = eligible[0]?.id ?? developers[0]?.id ?? '';
      }

      const duration = Math.max(1, storyPointsToTimeslots(getTaskPoints(targetTask)));
      const position: TaskPosition = {
        taskId: targetTask.id,
        assignee: defaultAssignee,
        startDay: dayIndex,
        startPart: partIndex,
        duration,
        plannedStartDay: dayIndex,
        plannedStartPart: partIndex,
        plannedDuration: duration,
      };

      // Для синтетических QA задач передаём isQa + devTaskKey;
      // для QA-only задач позиция хранится под исходным ID — isQa не нужен.
      onPositionSave?.(position, isSyntheticQa, isSyntheticQa ? targetTask.originalTaskId : undefined);

      // Пикер показываем только если у задачи нет исполнителя в команде (выбор при первой фазе)
      const canAutoAssign = useQaAssignment
        ? (targetTask.qaEngineer && taskAssigneeInTeam(targetTask.qaEngineer))
        : (targetTask.assignee && taskAssigneeInTeam(targetTask.assignee));

      if (!canAutoAssign && onOpenAssigneePicker) {
        const anchorRect = getAnchorRect
          ? getAnchorRect(cellElement)
          : cellElement.getBoundingClientRect();
        onOpenAssigneePicker({
          anchorRect,
          position,
          task: targetTask,
          taskName: targetTask.name || 'Без названия',
        });
      }
    },
    [developers, onOpenAssigneePicker, onPositionSave]
  );

  return { handleEmptyCellClick };
}
