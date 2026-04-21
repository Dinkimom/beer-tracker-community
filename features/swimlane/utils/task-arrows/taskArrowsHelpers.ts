import type { Task, TaskLink, TaskPosition } from '@/types';

/** Синтетическая связь dev → QA для стрелки между фазами (id с этим префиксом нельзя удалить). */
export const TASK_ARROWS_DEV_QA_LINK_PREFIX = 'dev-qa-';

export function buildTasksMapById(tasks: Task[]): Map<string, Task> {
  const map = new Map<string, Task>();
  for (const task of tasks) {
    map.set(task.id, task);
  }
  return map;
}

export function buildDevToQaSyntheticLinks(
  taskLinks: TaskLink[],
  qaTasksMap: Map<string, Task>,
  taskPositions: Map<string, TaskPosition>
): TaskLink[] {
  const existingPair = new Set(taskLinks.map((l) => `${l.fromTaskId}-${l.toTaskId}`));
  const out: TaskLink[] = [];
  qaTasksMap.forEach((qaTask, devTaskId) => {
    if (
      taskPositions.has(devTaskId) &&
      taskPositions.has(qaTask.id) &&
      !existingPair.has(`${devTaskId}-${qaTask.id}`)
    ) {
      out.push({
        id: `${TASK_ARROWS_DEV_QA_LINK_PREFIX}${devTaskId}`,
        fromTaskId: devTaskId,
        toTaskId: qaTask.id,
      });
    }
  });
  return out;
}

export function mergeTaskLinksWithDevQa(
  taskLinks: TaskLink[],
  qaTasksMap: Map<string, Task> | undefined,
  taskPositions: Map<string, TaskPosition> | undefined
): TaskLink[] {
  if (!qaTasksMap || !taskPositions) {
    return [...taskLinks];
  }
  return [...taskLinks, ...buildDevToQaSyntheticLinks(taskLinks, qaTasksMap, taskPositions)];
}

export function filterTaskLinksForActiveDrag(
  allLinks: TaskLink[],
  activeTaskId: string | null
): TaskLink[] {
  if (!activeTaskId) return allLinks;
  return allLinks.filter(
    (link) => link.fromTaskId !== activeTaskId && link.toTaskId !== activeTaskId
  );
}

export function filterTaskLinksForSegmentEdit(
  links: TaskLink[],
  segmentEditTaskId: string | null
): TaskLink[] {
  if (segmentEditTaskId == null) return links;
  return links.filter(
    (link) =>
      link.fromTaskId !== segmentEditTaskId && link.toTaskId !== segmentEditTaskId
  );
}

export function filterTaskLinksByVisibleDevelopers(
  links: TaskLink[],
  tasksMap: Map<string, Task>,
  taskPositions: Map<string, TaskPosition> | undefined,
  visibleDeveloperIds: Set<string>
): TaskLink[] {
  return links.filter((link) => {
    const fromTask = tasksMap.get(link.fromTaskId);
    const toTask = tasksMap.get(link.toTaskId);

    const fromPosition = taskPositions?.get(link.fromTaskId);
    const toPosition = taskPositions?.get(link.toTaskId);
    const fromAssignee = fromPosition?.assignee || fromTask?.assignee;
    const toAssignee = toPosition?.assignee || toTask?.assignee;

    const fromTaskVisible = !fromAssignee || visibleDeveloperIds.has(fromAssignee);
    const toTaskVisible = !toAssignee || visibleDeveloperIds.has(toAssignee);

    return fromTaskVisible && toTaskVisible;
  });
}

export function partitionTaskArrowLinks(
  visibleLinks: TaskLink[],
  hoveredLinkId: string | null,
  hoveredTaskIdForArrows: string | null
): {
  hoveredLink: TaskLink | undefined;
  hoveredTaskLinks: TaskLink[];
  regularLinks: TaskLink[];
} {
  const hoveredLink = hoveredLinkId
    ? visibleLinks.find((link) => hoveredLinkId === link.id)
    : undefined;
  const hoveredTaskLinks = visibleLinks.filter(
    (link) =>
      hoveredLinkId !== link.id &&
      hoveredTaskIdForArrows !== null &&
      (link.fromTaskId === hoveredTaskIdForArrows || link.toTaskId === hoveredTaskIdForArrows)
  );
  const regularLinks = visibleLinks.filter(
    (link) =>
      hoveredLinkId !== link.id &&
      (hoveredTaskIdForArrows === null ||
        (link.fromTaskId !== hoveredTaskIdForArrows &&
          link.toTaskId !== hoveredTaskIdForArrows))
  );
  return { hoveredLink, hoveredTaskLinks, regularLinks };
}
