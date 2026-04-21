import type { OccupancyTaskOrder } from '@/lib/beerTrackerApi';
import type { Task, Developer, TaskPosition } from '@/types';
import type { QuarterlyAvailability } from '@/types/quarterly';

import { useMemo } from 'react';

import { WORKING_DAYS } from '@/constants';
import { buildAssigneeUnavailableDays, getOccupancyErrorDays, getOccupancyErrorDetailsByDay, getOccupancyErrorReasons, getOccupancyErrorTaskIds } from '@/features/sprint/utils/occupancyValidation';
import { getSegmentsForDeveloper } from '@/features/swimlane/utils/availabilitySegments';

import { buildFlattenedRows } from '../utils/buildFlattenedRows';

/** Задачи считаются уже отфильтрованными по статусу на бэкенде (спринт) или в useEpicOccupancyData (эпик). */
export function useOccupancyData({
  tasks,
  taskPositions,
  globalNameFilter,
  selectedAssigneeIds,
  taskOrder,
  availability,
  sprintStartDate,
  sprintWorkingDaysCount = WORKING_DAYS,
  developers,
  collapsedParents,
}: {
  tasks: Task[];
  taskPositions: Map<string, TaskPosition>;
  globalNameFilter: string;
  selectedAssigneeIds?: Set<string>;
  taskOrder?: OccupancyTaskOrder;
  availability?: QuarterlyAvailability | null;
  sprintStartDate: Date;
  sprintWorkingDaysCount?: number;
  developers: Developer[];
  collapsedParents: Set<string>;
}) {
  const flattenedRows = useMemo(
    () => buildFlattenedRows(tasks, taskPositions, globalNameFilter, selectedAssigneeIds, taskOrder),
    [tasks, taskPositions, globalNameFilter, selectedAssigneeIds, taskOrder]
  );

  const visibleRows = useMemo(
    () =>
      flattenedRows.filter((row) => {
        if (row.type === 'parent') return true;
        // Как в buildFlattenedRows: группа = parent ?? epic, иначе «Без родителя»
        const parentOrEpic = row.task.parent ?? row.task.epic;
        const groupId = parentOrEpic?.id ?? '__root__';
        return !collapsedParents.has(groupId);
      }),
    [flattenedRows, collapsedParents]
  );

  const visibleTaskIds = useMemo(
    () =>
      new Set(
        visibleRows.flatMap((r) => (r.type === 'task' ? [r.task.id] : []))
      ),
    [visibleRows]
  );

  /** Порядок ID для отрисовки стрелок. Сначала из flattenedRows (сохраняем порядок), затем дополняем любым ID из tasks, которых нет в списке — чтобы связи не пропадали при смене фильтра (подмножество задач с бэка). */
  const taskIdsOrder = useMemo(() => {
    const fromRows = flattenedRows.flatMap((r) =>
      r.type === 'task' ? (r.qaTask ? [r.task.id, r.qaTask.id] : [r.task.id]) : []
    );
    const seen = new Set(fromRows);
    const extra: string[] = [];
    tasks.forEach((t) => {
      if (!seen.has(t.id)) {
        extra.push(t.id);
        seen.add(t.id);
      }
      if (t.originalTaskId && !seen.has(t.originalTaskId)) {
        extra.push(t.originalTaskId);
        seen.add(t.originalTaskId);
      }
    });
    return fromRows.length > 0 ? [...fromRows, ...extra] : extra;
  }, [flattenedRows, tasks]);

  const changelogTaskIds = useMemo(
    () =>
      visibleRows.flatMap((r) =>
        r.type === 'task' ? [r.task.id] : []
      ),
    [visibleRows]
  );

  const devToQaTaskId = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (t.originalTaskId) map.set(t.originalTaskId, t.id);
    });
    return map;
  }, [tasks]);

  const tasksMap = useMemo(() => {
    const map = new Map<string, Task>();
    tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [tasks]);

  const assigneeUnavailableDays = useMemo(
    () => buildAssigneeUnavailableDays(availability ?? null, sprintStartDate, sprintWorkingDaysCount),
    [availability, sprintStartDate, sprintWorkingDaysCount]
  );

  const occupancyErrorTaskIds = useMemo(
    () => getOccupancyErrorTaskIds(tasks, taskPositions, assigneeUnavailableDays),
    [tasks, taskPositions, assigneeUnavailableDays]
  );

  const occupancyErrorDays = useMemo(
    () => getOccupancyErrorDays(tasks, taskPositions, assigneeUnavailableDays),
    [tasks, taskPositions, assigneeUnavailableDays]
  );

  const occupancyErrorReasons = useMemo(
    () => getOccupancyErrorReasons(tasks, taskPositions, assigneeUnavailableDays),
    [tasks, taskPositions, assigneeUnavailableDays]
  );

  const occupancyErrorDetailsByDay = useMemo(
    () => getOccupancyErrorDetailsByDay(tasks, taskPositions, assigneeUnavailableDays),
    [tasks, taskPositions, assigneeUnavailableDays]
  );

  const developerMap = useMemo(() => {
    const map = new Map<string, Developer>();
    developers.forEach((d) => map.set(d.id, d));
    return map;
  }, [developers]);

  const availabilityDevelopersWithSegments = useMemo(() => {
    if (!availability || (availability.vacations.length === 0 && availability.techSprints.length === 0)) {
      return [];
    }
    return developers
      .map((developer) => ({
        developer,
        segments: getSegmentsForDeveloper(
          developer.id,
          sprintStartDate,
          availability.vacations,
          availability.techSprints,
          sprintWorkingDaysCount
        ),
      }))
      .filter(({ segments }) => segments.length > 0);
  }, [availability, developers, sprintStartDate, sprintWorkingDaysCount]);

  return {
    flattenedRows,
    visibleRows,
    visibleTaskIds,
    taskIdsOrder,
    changelogTaskIds,
    devToQaTaskId,
    tasksMap,
    assigneeUnavailableDays,
    occupancyErrorTaskIds,
    occupancyErrorDays,
    occupancyErrorReasons,
    occupancyErrorDetailsByDay,
    developerMap,
    availabilityDevelopersWithSegments,
  };
}
