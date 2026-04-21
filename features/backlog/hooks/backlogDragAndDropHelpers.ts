import type { Task } from '@/types';
import type { SprintListItem } from '@/types/tracker';
import type { QueryClient } from '@tanstack/react-query';

import { sprintTasksQueryKey } from '@/features/task/hooks/useTasks';

export interface SprintTasksBundle {
  developers: unknown[];
  sprintInfo: unknown;
  tasks: Task[];
}

export function findTaskInSprints(
  queryClient: QueryClient,
  taskId: string,
  activeSprints: SprintListItem[],
  boardId: number | null,
  forDemoPlanner = false
): { sourceSprintId: number; task: Task } | null {
  for (const sprint of activeSprints) {
    const tasksData = queryClient.getQueryData<SprintTasksBundle>(
      sprintTasksQueryKey(sprint.id, boardId, forDemoPlanner)
    );
    if (tasksData?.tasks) {
      const task = tasksData.tasks.find((t) => t.id === taskId);
      if (task) {
        return { sourceSprintId: sprint.id, task };
      }
    }
  }
  return null;
}

export function getSprintTasksData(
  queryClient: QueryClient,
  sprintId: number,
  boardId: number | null,
  forDemoPlanner = false
): SprintTasksBundle | undefined {
  return queryClient.getQueryData<SprintTasksBundle>(sprintTasksQueryKey(sprintId, boardId, forDemoPlanner));
}
