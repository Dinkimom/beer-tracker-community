import type { Developer, SidebarGroupBy, Task } from '@/types';

import { isTaskGroupSentinelKey } from '@/features/task/constants/taskGroupKeys';
import { getSidebarTaskGroupKey } from '@/features/task/utils/taskSidebarGroupKey';

interface UseTaskGroupingProps {
  developers: Developer[];
  groupBy: SidebarGroupBy;
  sortedDevelopers?: Developer[];
  tasks: Task[];
}

/**
 * Хук для группировки задач по различным критериям
 */
export function useTaskGrouping({
  tasks,
  groupBy,
  developers,
  sortedDevelopers,
}: UseTaskGroupingProps) {
  let groupedTasksResult: Record<string, Task[]>;
  if (groupBy === 'none') {
    groupedTasksResult = { '': tasks };
  } else if (groupBy === 'assignee') {
    const groups: Record<string, Task[]> = {};
    const developersForGrouping = sortedDevelopers || developers;

    tasks.forEach((task) => {
      const groupKey = getSidebarTaskGroupKey(
        task,
        'assignee',
        developers,
        developersForGrouping
      );

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });
    groupedTasksResult = groups;
  } else if (groupBy === 'parent') {
    const groups: Record<string, Task[]> = {};
    tasks.forEach((task) => {
      const groupKey = getSidebarTaskGroupKey(task, 'parent', developers);

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(task);
    });
    groupedTasksResult = groups;
  } else {
    groupedTasksResult = { '': tasks };
  }

  const groupedTasks = groupedTasksResult;

  const keys = Object.keys(groupedTasks);

  // Если группируем по исполнителю и есть настройки участников, используем их порядок
  let sortedKeys: string[];
  if (groupBy === 'assignee' && sortedDevelopers) {
    const devNameOrder = new Map(sortedDevelopers.map((dev, index) => [dev.name, index]));

    sortedKeys = keys.sort((a, b) => {
      const aIsEmpty = isTaskGroupSentinelKey(a);
      const bIsEmpty = isTaskGroupSentinelKey(b);

      if (aIsEmpty && !bIsEmpty) return 1;
      if (!aIsEmpty && bIsEmpty) return -1;
      if (aIsEmpty && bIsEmpty) return 0;

      const aOrder = devNameOrder.get(a);
      const bOrder = devNameOrder.get(b);

      if (aOrder !== undefined && bOrder !== undefined) {
        return aOrder - bOrder;
      }

      if (aOrder !== undefined) return -1;
      if (bOrder !== undefined) return 1;

      return a.localeCompare(b);
    });
  } else {
    sortedKeys = keys.sort((a, b) => {
      const aIsEmpty = isTaskGroupSentinelKey(a);
      const bIsEmpty = isTaskGroupSentinelKey(b);
      if (aIsEmpty && !bIsEmpty) return 1;
      if (!aIsEmpty && bIsEmpty) return -1;
      return a.localeCompare(b);
    });
  }

  const groupKeys = sortedKeys;

  return {
    groupedTasks,
    groupKeys,
  };
}
