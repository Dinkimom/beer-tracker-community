/**
 * Хук для поиска активной задачи (для drag overlay)
 */

import type { Developer, Task } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { useQueryClient } from '@tanstack/react-query';

import { useDemoPlannerBoardsQueryScope } from '@/features/board/demoPlannerBoardsQueryScope';
import { sprintTasksQueryKey } from '@/features/task/hooks/useTasks';

interface UseActiveTaskProps {
  activeSprints: SprintListItem[];
  activeTaskId: string | null;
  backlogDevelopers: Developer[];
  backlogTasks: Task[];
  boardId: number | null;
}

interface ActiveTaskResult {
  activeTask: Task | null;
  activeTaskDevelopers: Developer[];
}

/**
 * Находит активную задачу в бэклоге или спринтах и возвращает её вместе с разработчиками
 */
export function useActiveTask({
  activeTaskId,
  backlogTasks,
  backlogDevelopers,
  activeSprints,
  boardId,
}: UseActiveTaskProps): ActiveTaskResult {
  const queryClient = useQueryClient();
  const forDemoPlanner = useDemoPlannerBoardsQueryScope();

  if (!activeTaskId) {
    return { activeTask: null, activeTaskDevelopers: backlogDevelopers };
  }

  const task = backlogTasks.find((t) => t.id === activeTaskId);
  if (task) {
    return { activeTask: task, activeTaskDevelopers: backlogDevelopers };
  }

  for (const sprint of activeSprints) {
    const tasksData = queryClient.getQueryData<{
      tasks: Task[];
      developers: Developer[];
      sprintInfo: unknown;
    }>(sprintTasksQueryKey(sprint.id, boardId, forDemoPlanner));

    if (tasksData?.tasks) {
      const foundTask = tasksData.tasks.find((t) => t.id === activeTaskId);
      if (foundTask) {
        return {
          activeTask: foundTask,
          activeTaskDevelopers: tasksData.developers || [],
        };
      }
    }
  }

  return { activeTask: null, activeTaskDevelopers: backlogDevelopers };
}

