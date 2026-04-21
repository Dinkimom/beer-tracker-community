/**
 * Валидация планирования занятости в таймлайне.
 * Ошибки:
 * 1) Занятость тестирования идёт до или пересекается с занятостью разработки по задаче
 *    (должно быть строго: разработка → возможно интервал → тестирование).
 * 2) Пересечение по исполнителям: один исполнитель занят в один период в разных задачах.
 * 3) Задача назначена на исполнителя в отпуске или техспринте (по данным квартального планирования).
 */

import type { Task, TaskPosition } from '@/types';
import type { TechSprintEntry, VacationEntry } from '@/types/quarterly';

import { PARTS_PER_DAY, WORKING_DAYS } from '@/constants';
import { isTaskCompleted } from '@/features/task/utils/taskUtils';
import {
  OCCUPANCY_ERROR_MESSAGES,
  type OccupancyErrorReason,
  formatOccupancyErrorTooltip,
} from '@/lib/planner-timeline/occupancyErrorMessages';
import { getWorkingDaysRange } from '@/utils/dateUtils';

import { getPositionSegmentRanges } from './occupancyUtils';

export {
  OCCUPANCY_ERROR_MESSAGES,
  formatOccupancyErrorTooltip,
  type OccupancyErrorReason,
};

function cellRangeToDayIndices(startCell: number, endCell: number): Set<number> {
  const days = new Set<number>();
  for (let c = startCell; c < endCell; c++) {
    days.add(Math.floor(c / PARTS_PER_DAY));
  }
  return days;
}

/** ID завершённых задач: для них не показываем ошибки планирования; пары «открытая + завершённая» тоже не считаем конфликтом. */
function closedTaskIds(tasks: Task[]): Set<string> {
  return new Set(tasks.filter(isTaskCompleted).map((t) => t.id));
}

/** Оставляем в карте только позиции задач из переданного списка (текущий спринт). */
function filterPositionsByTasks(
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>
): Map<string, TaskPosition> {
  const taskIds = new Set(tasks.map((t) => t.id));
  const filtered = new Map<string, TaskPosition>();
  taskPositions.forEach((pos, taskId) => {
    if (taskIds.has(taskId)) filtered.set(taskId, pos);
  });
  return filtered;
}

/** Дни (0..9), когда исполнитель в отпуске или техспринте. Передаётся из квартального планирования. */
export type AssigneeUnavailableDays = Map<string, Set<number>>;

function parseIsoDateOnlyUtc(iso: string): Date {
  // iso ожидается YYYY-MM-DD
  return new Date(`${iso}T00:00:00Z`);
}

function dayOverlapsEntry(dayDate: Date, entry: TechSprintEntry | VacationEntry): boolean {
  const dayStart = new Date(dayDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayDate);
  dayEnd.setHours(23, 59, 59, 999);
  const entryStart = parseIsoDateOnlyUtc(entry.startDate);
  entryStart.setHours(0, 0, 0, 0);
  const entryEnd = parseIsoDateOnlyUtc(entry.endDate);
  entryEnd.setHours(23, 59, 59, 999);
  return entryStart.getTime() <= dayEnd.getTime() && entryEnd.getTime() >= dayStart.getTime();
}

/**
 * Строит карту: assigneeId → множество индексов дней (0..9), когда исполнитель в отпуске или техспринте.
 * Используется для валидации «не назначать задачу на исполнителя в отпуске/техспринте».
 */
export function buildAssigneeUnavailableDays(
  availability: { vacations: VacationEntry[]; techSprints: TechSprintEntry[] } | null | undefined,
  sprintStartDate: Date,
  workingDaysCount: number = WORKING_DAYS
): AssigneeUnavailableDays {
  const map = new Map<string, Set<number>>();
  if (!availability) return map;

  const count = Math.max(1, workingDaysCount);
  const workingDays = getWorkingDaysRange(sprintStartDate, count);

  const addUnavailableDays = (memberId: string, entry: TechSprintEntry | VacationEntry) => {
    const days = map.get(memberId) ?? new Set<number>();
    for (let dayIndex = 0; dayIndex < workingDays.length; dayIndex++) {
      if (dayOverlapsEntry(workingDays[dayIndex]!, entry)) {
        days.add(dayIndex);
      }
    }
    map.set(memberId, days);
  };

  availability.vacations.forEach((entry) => addUnavailableDays(entry.memberId, entry));
  availability.techSprints.forEach((entry) => addUnavailableDays(entry.memberId, entry));

  return map;
}

/**
 * Возвращает индексы дней (колонок 0..9), в которых есть ошибки планирования.
 * - devBeforeQa: занятость QA идёт до или пересекается с занятостью разработки по задаче.
 * - performerOverlap: один исполнитель имеет пересекающуюся занятость по разным задачам.
 * - assignee_unavailable: задача назначена на исполнителя в отпуске или техспринте.
 */
export function getOccupancyErrorDays(
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>,
  assigneeUnavailableDays?: AssigneeUnavailableDays
): Set<number> {
  const errorDays = new Set<number>();
  const taskPositionsInSprint = filterPositionsByTasks(tasks, taskPositions);
  const closedIds = closedTaskIds(tasks);

  const qaByOriginalId = new Map<string, Task>();
  tasks.forEach((t) => {
    if (t.originalTaskId) qaByOriginalId.set(t.originalTaskId, t);
  });

  // 1) QA до/пересечение с Dev по задаче (по отрезкам: конец последнего dev < начало первого QA)
  tasks.forEach((task) => {
    if (task.originalTaskId) return; // только dev-задачи
    const qaTask = qaByOriginalId.get(task.id);
    if (!qaTask) return;
    const position = taskPositionsInSprint.get(task.id);
    const qaPosition = taskPositionsInSprint.get(qaTask.id);
    if (!position || !qaPosition) return;

    const devRanges = getPositionSegmentRanges(position);
    const qaRanges = getPositionSegmentRanges(qaPosition);
    const devEnd = devRanges.length > 0 ? Math.max(...devRanges.map((r) => r.endCell)) : 0;
    const qaStart = qaRanges.length > 0 ? Math.min(...qaRanges.map((r) => r.startCell)) : 0;
    if (qaStart < devEnd) {
      if (closedIds.has(task.id) || closedIds.has(qaTask.id)) return;
      const conflictStart = Math.min(...devRanges.map((r) => r.startCell), qaStart);
      const conflictEnd = Math.max(...qaRanges.map((r) => r.endCell), devEnd);
      cellRangeToDayIndices(conflictStart, conflictEnd).forEach((d) => errorDays.add(d));
    }
  });

  // 2) Пересечение по исполнителям — все отрезки всех позиций (только задачи текущего спринта)
  const byAssignee = new Map<string, Array<{ taskId: string; startCell: number; endCell: number }>>();
  taskPositionsInSprint.forEach((pos, taskId) => {
    const ranges = getPositionSegmentRanges(pos);
    const list = byAssignee.get(pos.assignee) ?? [];
    ranges.forEach((r) => list.push({ taskId, startCell: r.startCell, endCell: r.endCell }));
    byAssignee.set(pos.assignee, list);
  });

  byAssignee.forEach((positions) => {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        if (a.taskId === b.taskId) continue; // один задача — пересечение отрезков одной фазы не ошибка
        const overlapStart = Math.max(a.startCell, b.startCell);
        const overlapEnd = Math.min(a.endCell, b.endCell);
        if (overlapStart < overlapEnd) {
          if (closedIds.has(a.taskId) || closedIds.has(b.taskId)) continue;
          cellRangeToDayIndices(overlapStart, overlapEnd).forEach((d) => errorDays.add(d));
        }
      }
    }
  });

  // 3) Задача на исполнителя в отпуске или техспринте (по каждому отрезку)
  if (assigneeUnavailableDays?.size) {
    taskPositionsInSprint.forEach((pos, taskId) => {
      if (closedIds.has(taskId)) return;
      const unavailable = assigneeUnavailableDays.get(pos.assignee);
      if (!unavailable?.size) return;
      const ranges = getPositionSegmentRanges(pos);
      for (const r of ranges) {
        const taskDays = cellRangeToDayIndices(r.startCell, r.endCell);
        for (const d of taskDays) {
          if (unavailable.has(d)) {
            errorDays.add(d);
            break;
          }
        }
      }
    });
  }

  return errorDays;
}

/**
 * Возвращает ID задач (position.taskId), у которых фаза занятости участвует в ошибке планирования.
 * Используется для подсветки конкретных полосок (фаз) в таймлайне.
 */
export function getOccupancyErrorTaskIds(
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>,
  assigneeUnavailableDays?: AssigneeUnavailableDays
): Set<string> {
  const errorTaskIds = new Set<string>();
  const taskPositionsInSprint = filterPositionsByTasks(tasks, taskPositions);
  const closedIds = closedTaskIds(tasks);

  const qaByOriginalId = new Map<string, Task>();
  tasks.forEach((t) => {
    if (t.originalTaskId) qaByOriginalId.set(t.originalTaskId, t);
  });

  // 1) QA до/пересечение с Dev по задаче
  tasks.forEach((task) => {
    if (task.originalTaskId) return;
    const qaTask = qaByOriginalId.get(task.id);
    if (!qaTask) return;
    const position = taskPositionsInSprint.get(task.id);
    const qaPosition = taskPositionsInSprint.get(qaTask.id);
    if (!position || !qaPosition) return;

    const devRanges = getPositionSegmentRanges(position);
    const qaRanges = getPositionSegmentRanges(qaPosition);
    const devEnd = devRanges.length > 0 ? Math.max(...devRanges.map((r) => r.endCell)) : 0;
    const qaStart = qaRanges.length > 0 ? Math.min(...qaRanges.map((r) => r.startCell)) : 0;
    if (qaStart < devEnd) {
      if (closedIds.has(task.id) || closedIds.has(qaTask.id)) return;
      errorTaskIds.add(task.id);
      errorTaskIds.add(qaTask.id);
    }
  });

  // 2) Пересечение по исполнителям (отрезки разных задач, только текущий спринт)
  const byAssignee = new Map<string, Array<{ taskId: string; startCell: number; endCell: number }>>();
  taskPositionsInSprint.forEach((pos, taskId) => {
    const ranges = getPositionSegmentRanges(pos);
    const list = byAssignee.get(pos.assignee) ?? [];
    ranges.forEach((r) => list.push({ taskId, startCell: r.startCell, endCell: r.endCell }));
    byAssignee.set(pos.assignee, list);
  });

  byAssignee.forEach((positions) => {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        if (a.taskId === b.taskId) continue;
        const overlapStart = Math.max(a.startCell, b.startCell);
        const overlapEnd = Math.min(a.endCell, b.endCell);
        if (overlapStart < overlapEnd) {
          if (closedIds.has(a.taskId) || closedIds.has(b.taskId)) continue;
          errorTaskIds.add(a.taskId);
          errorTaskIds.add(b.taskId);
        }
      }
    }
  });

  // 3) Задача на исполнителя в отпуске или техспринте
  if (assigneeUnavailableDays?.size) {
    taskPositionsInSprint.forEach((pos, taskId) => {
      if (closedIds.has(taskId)) return;
      const unavailable = assigneeUnavailableDays.get(pos.assignee);
      if (!unavailable?.size) return;
      const ranges = getPositionSegmentRanges(pos);
      for (const r of ranges) {
        const taskDays = cellRangeToDayIndices(r.startCell, r.endCell);
        for (const d of taskDays) {
          if (unavailable.has(d)) {
            errorTaskIds.add(taskId);
            break;
          }
        }
      }
    });
  }

  return errorTaskIds;
}

/**
 * Возвращает Set ID задач, которые пересекаются с указанной задачей по занятости.
 * Используется для подсветки пересекающихся карточек при hover на иконку ошибки.
 */
export function getOverlappingTaskIds(
  taskId: string,
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>
): Set<string> {
  const overlappingTaskIds = new Set<string>();
  const taskPositionsInSprint = filterPositionsByTasks(tasks, taskPositions);
  const closedIds = closedTaskIds(tasks);
  if (closedIds.has(taskId)) return overlappingTaskIds;
  const targetPosition = taskPositionsInSprint.get(taskId);
  if (!targetPosition) return overlappingTaskIds;

  const targetRanges = getPositionSegmentRanges(targetPosition);

  const segmentsOverlap = (
    a: { startCell: number; endCell: number },
    b: { startCell: number; endCell: number }
  ) => Math.max(a.startCell, b.startCell) < Math.min(a.endCell, b.endCell);

  const qaByOriginalId = new Map<string, Task>();
  tasks.forEach((t) => {
    if (t.originalTaskId) qaByOriginalId.set(t.originalTaskId, t);
  });

  // Проверяем пересечение с другими задачами того же исполнителя (по отрезкам, только текущий спринт)
  const targetAssignee = targetPosition.assignee;
  taskPositionsInSprint.forEach((pos, otherTaskId) => {
    if (otherTaskId === taskId) return;
    if (closedIds.has(otherTaskId)) return;
    if (pos.assignee !== targetAssignee) return;
    const otherRanges = getPositionSegmentRanges(pos);
    const hasOverlap = targetRanges.some((tr) =>
      otherRanges.some((or) => segmentsOverlap(tr, or))
    );
    if (hasOverlap) overlappingTaskIds.add(otherTaskId);
  });

  // Проверяем пересечение QA с Dev
  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    if (task.originalTaskId) {
      const devTaskId = task.originalTaskId;
      const devPosition = taskPositionsInSprint.get(devTaskId);
      if (devPosition) {
        const devRanges = getPositionSegmentRanges(devPosition);
        const hasOverlap = targetRanges.some((tr) =>
          devRanges.some((dr) => segmentsOverlap(tr, dr))
        );
        if (hasOverlap && !closedIds.has(devTaskId)) overlappingTaskIds.add(devTaskId);
      }
    } else {
      const qaTask = qaByOriginalId.get(task.id);
      if (qaTask) {
        const qaPosition = taskPositionsInSprint.get(qaTask.id);
        if (qaPosition) {
          const qaRanges = getPositionSegmentRanges(qaPosition);
          const hasOverlap = targetRanges.some((tr) =>
            qaRanges.some((qr) => segmentsOverlap(tr, qr))
          );
          if (hasOverlap && !closedIds.has(qaTask.id)) overlappingTaskIds.add(qaTask.id);
        }
      }
    }
  }

  return overlappingTaskIds;
}

/**
 * Возвращает для каждой задачи список причин ошибки (ключи для OCCUPANCY_ERROR_MESSAGES).
 * Используется для тултипа при наведении на иконку ошибки.
 */
export function getOccupancyErrorReasons(
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>,
  assigneeUnavailableDays?: AssigneeUnavailableDays
): Map<string, OccupancyErrorReason[]> {
  const reasons = new Map<string, OccupancyErrorReason[]>();
  const taskPositionsInSprint = filterPositionsByTasks(tasks, taskPositions);
  const closedIds = closedTaskIds(tasks);

  const addReason = (taskId: string, reason: OccupancyErrorReason) => {
    if (closedIds.has(taskId)) return;
    const list = reasons.get(taskId) ?? [];
    if (!list.includes(reason)) list.push(reason);
    reasons.set(taskId, list);
  };

  const qaByOriginalId = new Map<string, Task>();
  tasks.forEach((t) => {
    if (t.originalTaskId) qaByOriginalId.set(t.originalTaskId, t);
  });

  // 1) QA без запланированной разработки — только для QA-задачи с позицией, у dev нет позиции
  tasks.forEach((task) => {
    if (!task.originalTaskId) return;
    if (closedIds.has(task.id)) return;
    const devTaskId = task.originalTaskId;
    const hasQaPosition = taskPositionsInSprint.has(task.id);
    const hasDevPosition = taskPositionsInSprint.has(devTaskId);
    if (hasQaPosition && !hasDevPosition) {
      addReason(task.id, 'qa_without_dev');
    }
  });

  // 2) QA до/пересечение с Dev — помечаем обе фазы
  tasks.forEach((task) => {
    if (task.originalTaskId) return;
    const qaTask = qaByOriginalId.get(task.id);
    if (!qaTask) return;
    const position = taskPositionsInSprint.get(task.id);
    const qaPosition = taskPositionsInSprint.get(qaTask.id);
    if (!position || !qaPosition) return;

    const devRanges = getPositionSegmentRanges(position);
    const qaRanges = getPositionSegmentRanges(qaPosition);
    const devEnd = devRanges.length > 0 ? Math.max(...devRanges.map((r) => r.endCell)) : 0;
    const qaStart = qaRanges.length > 0 ? Math.min(...qaRanges.map((r) => r.startCell)) : 0;
    if (qaStart < devEnd) {
      if (closedIds.has(task.id) || closedIds.has(qaTask.id)) return;
      addReason(task.id, 'qa_before_dev');
      addReason(qaTask.id, 'qa_before_dev');
    }
  });

  // 3) Пересечение по исполнителям (отрезки, только текущий спринт)
  const byAssignee = new Map<string, Array<{ taskId: string; startCell: number; endCell: number }>>();
  taskPositionsInSprint.forEach((pos, taskId) => {
    const ranges = getPositionSegmentRanges(pos);
    const list = byAssignee.get(pos.assignee) ?? [];
    ranges.forEach((r) => list.push({ taskId, startCell: r.startCell, endCell: r.endCell }));
    byAssignee.set(pos.assignee, list);
  });

  byAssignee.forEach((positions) => {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        if (a.taskId === b.taskId) continue;
        const overlapStart = Math.max(a.startCell, b.startCell);
        const overlapEnd = Math.min(a.endCell, b.endCell);
        if (overlapStart < overlapEnd) {
          if (closedIds.has(a.taskId) || closedIds.has(b.taskId)) continue;
          addReason(a.taskId, 'performer_overlap');
          addReason(b.taskId, 'performer_overlap');
        }
      }
    }
  });

  // 4) Задача на исполнителя в отпуске или техспринте
  if (assigneeUnavailableDays?.size) {
    taskPositionsInSprint.forEach((pos, taskId) => {
      if (closedIds.has(taskId)) return;
      const unavailable = assigneeUnavailableDays.get(pos.assignee);
      if (!unavailable?.size) return;
      const ranges = getPositionSegmentRanges(pos);
      for (const r of ranges) {
        const taskDays = cellRangeToDayIndices(r.startCell, r.endCell);
        for (const d of taskDays) {
          if (unavailable.has(d)) {
            addReason(taskId, 'assignee_unavailable');
            return;
          }
        }
      }
    });
  }

  return reasons;
}

export interface DayErrorDetail { reasons: string[]; taskName: string; }

/**
 * Возвращает по каждому дню (индекс колонки) список проблемных задач и причин.
 * Используется для тултипа иконки ошибки в шапке колонки дня.
 */
export function getOccupancyErrorDetailsByDay(
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>,
  assigneeUnavailableDays?: AssigneeUnavailableDays
): Map<number, DayErrorDetail[]> {
  const taskPositionsInSprint = filterPositionsByTasks(tasks, taskPositions);
  const closedIds = closedTaskIds(tasks);
  const taskById = new Map<string, Task>();
  tasks.forEach((t) => taskById.set(t.id, t));

  const byDay = new Map<number, Map<string, Set<OccupancyErrorReason>>>();

  const add = (dayIndex: number, taskId: string, reason: OccupancyErrorReason) => {
    if (closedIds.has(taskId)) return;
    let dayMap = byDay.get(dayIndex);
    if (!dayMap) {
      dayMap = new Map();
      byDay.set(dayIndex, dayMap);
    }
    let reasons = dayMap.get(taskId);
    if (!reasons) {
      reasons = new Set();
      dayMap.set(taskId, reasons);
    }
    reasons.add(reason);
  };

  const qaByOriginalId = new Map<string, Task>();
  tasks.forEach((t) => {
    if (t.originalTaskId) qaByOriginalId.set(t.originalTaskId, t);
  });

  // 1) QA до/пересечение с Dev — дни конфликта
  tasks.forEach((task) => {
    if (task.originalTaskId) return;
    const qaTask = qaByOriginalId.get(task.id);
    if (!qaTask) return;
    const position = taskPositionsInSprint.get(task.id);
    const qaPosition = taskPositionsInSprint.get(qaTask.id);
    if (!position || !qaPosition) return;

    const devRanges = getPositionSegmentRanges(position);
    const qaRanges = getPositionSegmentRanges(qaPosition);
    const devEnd = devRanges.length > 0 ? Math.max(...devRanges.map((r) => r.endCell)) : 0;
    const qaStart = qaRanges.length > 0 ? Math.min(...qaRanges.map((r) => r.startCell)) : 0;
    if (qaStart < devEnd) {
      if (closedIds.has(task.id) || closedIds.has(qaTask.id)) return;
      const conflictStart = Math.min(...devRanges.map((r) => r.startCell), qaStart);
      const conflictEnd = Math.max(...qaRanges.map((r) => r.endCell), devEnd);
      cellRangeToDayIndices(conflictStart, conflictEnd).forEach((d) => {
        add(d, task.id, 'qa_before_dev');
        add(d, qaTask.id, 'qa_before_dev');
      });
    }
  });

  // 2) Пересечение по исполнителям (отрезки, только текущий спринт)
  const byAssignee = new Map<string, Array<{ taskId: string; startCell: number; endCell: number }>>();
  taskPositionsInSprint.forEach((pos, taskId) => {
    const ranges = getPositionSegmentRanges(pos);
    const list = byAssignee.get(pos.assignee) ?? [];
    ranges.forEach((r) => list.push({ taskId, startCell: r.startCell, endCell: r.endCell }));
    byAssignee.set(pos.assignee, list);
  });

  byAssignee.forEach((positions) => {
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i]!;
        const b = positions[j]!;
        if (a.taskId === b.taskId) continue;
        const overlapStart = Math.max(a.startCell, b.startCell);
        const overlapEnd = Math.min(a.endCell, b.endCell);
        if (overlapStart < overlapEnd) {
          if (closedIds.has(a.taskId) || closedIds.has(b.taskId)) continue;
          cellRangeToDayIndices(overlapStart, overlapEnd).forEach((d) => {
            add(d, a.taskId, 'performer_overlap');
            add(d, b.taskId, 'performer_overlap');
          });
        }
      }
    }
  });

  // 3) QA без запланированной разработки — все отрезки QA
  tasks.forEach((task) => {
    if (!task.originalTaskId) return;
    const devTaskId = task.originalTaskId;
    const hasQaPosition = taskPositionsInSprint.has(task.id);
    const hasDevPosition = taskPositionsInSprint.has(devTaskId);
    if (hasQaPosition && !hasDevPosition) {
      if (closedIds.has(task.id)) return;
      const pos = taskPositionsInSprint.get(task.id)!;
      const ranges = getPositionSegmentRanges(pos);
      ranges.forEach((r) => {
        cellRangeToDayIndices(r.startCell, r.endCell).forEach((d) => add(d, task.id, 'qa_without_dev'));
      });
    }
  });

  // 4) Задача на исполнителя в отпуске или техспринте — по отрезкам
  if (assigneeUnavailableDays?.size) {
    taskPositionsInSprint.forEach((pos, taskId) => {
      if (closedIds.has(taskId)) return;
      const unavailable = assigneeUnavailableDays.get(pos.assignee);
      if (!unavailable?.size) return;
      const ranges = getPositionSegmentRanges(pos);
      ranges.forEach((r) => {
        const taskDays = cellRangeToDayIndices(r.startCell, r.endCell);
        taskDays.forEach((d) => {
          if (unavailable.has(d)) add(d, taskId, 'assignee_unavailable');
        });
      });
    });
  }

  const result = new Map<number, DayErrorDetail[]>();
  byDay.forEach((dayMap, dayIndex) => {
    const list: DayErrorDetail[] = [];
    dayMap.forEach((reasonsSet, taskId) => {
      const task = taskById.get(taskId);
      const taskName = task?.name ?? taskId;
      const reasons = Array.from(reasonsSet).map((r) => OCCUPANCY_ERROR_MESSAGES[r] ?? r);
      list.push({ taskName, reasons });
    });
    result.set(dayIndex, list);
  });
  return result;
}
