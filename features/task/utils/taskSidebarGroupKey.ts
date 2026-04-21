import type { Developer, SidebarGroupBy, Task } from '@/types';

import {
  TASK_GROUP_KEY_NO_PARENT,
  TASK_GROUP_KEY_UNASSIGNED,
} from '@/features/task/constants/taskGroupKeys';

/**
 * Group key for sidebar task lists (assignee / parent). Matches {@link useTaskGrouping} buckets.
 */
export function getSidebarTaskGroupKey(
  task: Task,
  groupBy: SidebarGroupBy,
  developers: Developer[],
  sortedDevelopers?: Developer[]
): string {
  if (groupBy === 'assignee') {
    const developersForGrouping = sortedDevelopers ?? developers;
    const assigneeId = task.assignee;
    if (!assigneeId) {
      return TASK_GROUP_KEY_UNASSIGNED;
    }
    const developer = developersForGrouping.find(
      (dev) => dev.id === assigneeId || String(dev.id) === String(assigneeId)
    );
    const nameFromTask = task.assigneeName?.trim();
    return developer?.name || nameFromTask || assigneeId;
  }
  if (groupBy === 'parent') {
    return task.parent ? task.parent.display : TASK_GROUP_KEY_NO_PARENT;
  }
  return '';
}
