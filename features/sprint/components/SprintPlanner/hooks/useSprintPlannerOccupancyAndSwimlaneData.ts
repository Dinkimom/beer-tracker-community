import type { BoardViewMode } from '@/hooks/useLocalStorage';
import type { StatusFilter, Task } from '@/types';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import { useMemo } from 'react';

import { createQATasksMap } from '@/features/qa/utils/qaTaskUtils';
import { useTaskChangelogs } from '@/features/sprint/components/SprintPlanner/occupancy/hooks/useTaskChangelogs';
import { useOccupancyTasks } from '@/features/task/hooks/useTasks';

export interface UseSprintPlannerOccupancyAndSwimlaneDataParams {
  allTasksForDrag: Task[];
  occupancyStatusFilter: StatusFilter;
  selectedBoardId: number | null;
  selectedSprintId: number | null;
  swimlaneFactTimelineVisible: boolean;
  viewMode: BoardViewMode;
}

/**
 * Задачи для занятости (рефетч при фильтре по статусу) и длительности по changelog для таймлайна факта под свимлейном.
 */
export function useSprintPlannerOccupancyAndSwimlaneData({
  allTasksForDrag,
  occupancyStatusFilter,
  selectedBoardId,
  selectedSprintId,
  swimlaneFactTimelineVisible,
  viewMode,
}: UseSprintPlannerOccupancyAndSwimlaneDataParams) {
  const swimlaneFactTimelineEnabled =
    swimlaneFactTimelineVisible && (viewMode === 'full' || viewMode === 'compact');

  const swimlaneChangelogTaskIds = useMemo(
    () => (swimlaneFactTimelineEnabled ? allTasksForDrag.map((t) => t.id) : []),
    [swimlaneFactTimelineEnabled, allTasksForDrag]
  );

  const { data: swimlaneChangelogsData } = useTaskChangelogs(swimlaneChangelogTaskIds);
  const swimlaneTaskDurationsMap = swimlaneChangelogsData?.durations ?? new Map();
  const swimlaneTaskChangelogsMap =
    swimlaneChangelogsData?.changelogs ?? new Map<string, ChangelogEntry[]>();
  const swimlaneTaskIssueCommentsMap =
    swimlaneChangelogsData?.comments ?? new Map<string, IssueComment[]>();

  const occupancyTasksQuery = useOccupancyTasks(
    selectedSprintId,
    selectedBoardId,
    occupancyStatusFilter,
    { enabled: viewMode === 'occupancy' && occupancyStatusFilter !== 'all' }
  );
  const occupancyTasks = occupancyTasksQuery.data?.tasks;
  const occupancyTasksLoading = occupancyTasksQuery.isLoading || occupancyTasksQuery.isFetching;

  const occupancyTasksWithQA = useMemo(() => {
    if (!occupancyTasks) return undefined;
    const qaMap = createQATasksMap(occupancyTasks);
    return [...occupancyTasks, ...Array.from(qaMap.values())];
  }, [occupancyTasks]);

  const tasksForOccupancy =
    occupancyStatusFilter === 'all' ? allTasksForDrag : (occupancyTasksWithQA ?? allTasksForDrag);

  return {
    occupancyTasksLoading,
    swimlaneTaskChangelogsMap,
    swimlaneTaskDurationsMap,
    swimlaneTaskIssueCommentsMap,
    tasksForOccupancy,
  };
}
