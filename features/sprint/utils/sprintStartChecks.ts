/**
 * Утилиты для проверок запуска спринта
 */

import type { Developer, Task, TaskPosition } from '@/types';
import type { ChecklistItem } from '@/types/tracker';

import { computeAssigneePointsStats } from '@/features/sprint/utils/assigneePointsStats';
import { isTaskCompleted } from '@/features/task/utils/taskUtils';
import { validateTask, type ValidationIssue } from '@/features/task/utils/taskValidation';
import { getTaskStoryPoints, getTaskTestPoints } from '@/lib/pointsUtils';

import { isSmartGoal } from './goalUtils';

/**
 * Dev-задачи спринта с ошибками валидации (без QA и без задач на цели).
 * Один источник правды для чеклиста запуска и вкладки «Невалидные».
 */
export function collectInvalidSprintDevTasks(
  tasks: Task[],
  goalTaskIds?: string[] | string
): Array<{ issues: ValidationIssue[]; task: Task }> {
  const goalIds = goalTaskIds == null ? [] : Array.isArray(goalTaskIds) ? goalTaskIds : [goalTaskIds];
  const goalIdSet = new Set(goalIds);

  const devTasksBase = tasks.filter(task => {
    if (task.team === 'QA') return false;
    if (goalIdSet.has(task.id)) return false;
    if (isTaskCompleted(task)) return false;
    return true;
  });

  return devTasksBase
    .map(task => ({
      task,
      issues: validateTask(task),
    }))
    .filter(({ issues }) => issues.length > 0);
}

export interface SprintStartChecks {
  // Все задачи правильно размечены
  allChecksPassed: boolean;
  allGoalsSmart: boolean;
  check1Passed: boolean;
  // Есть хотя бы одна цель и она SMART
  check2Passed: boolean;
  // Нагрузка задач соответствует договоренностям
  check3Passed: boolean;
  developerLoads: Array<{
    dev: Developer;
    isDeveloper: boolean;
    isQA: boolean;
    totalSP: number;
    totalTP: number;
  }>;
  hasGoals: boolean;
  invalidTasks: Array<{ issues: ValidationIssue[], task: Task; }>;
}

/**
 * Вычисляет проверки для запуска спринта
 * @param requireSmartGoals - если true, проверяет что цели SMART, иначе только наличие целей
 * @param taskPositions — позиции в свимлейне; если переданы, нагрузка SP/TP считается как в заголовке строки свимлейна (useSwimlaneLayout)
 */
export function calculateSprintStartChecks(
  checklistItems: ChecklistItem[],
  tasks: Task[],
  developers: Developer[],
  qaTasksMap: Map<string, Task>,
  goalTaskIds?: string[] | string,
  selectedSprintId?: number | null,
  requireSmartGoals: boolean = true,
  taskPositions?: Map<string, TaskPosition> | null
): SprintStartChecks {
  const goalIds = goalTaskIds == null ? [] : Array.isArray(goalTaskIds) ? goalTaskIds : [goalTaskIds];
  const goalIdSet = new Set(goalIds);

  const invalidTasks = collectInvalidSprintDevTasks(tasks, goalTaskIds);

  // Проверка 1: Есть хотя бы одна цель и (опционально) она SMART
  const hasGoals = checklistItems.length > 0;
  const allGoalsSmart = checklistItems.every(item => isSmartGoal(item.text));
  const check1Passed = hasGoals && (requireSmartGoals ? allGoalsSmart : true);

  // Проверка 2: Нагрузка задач (20 SP на разработчика, 30 TP на QA)
  const devTasksOnly = tasks.filter(task => {
    if (task.team === 'QA') return false;
    if (goalIdSet.has(task.id)) return false;
    return true;
  });

  const qaTasksArray = Array.from(qaTasksMap.values());

  const tasksMap = new Map<string, Task>();
  for (const t of tasks) {
    tasksMap.set(t.id, t);
  }
  for (const t of qaTasksArray) {
    tasksMap.set(t.id, t);
  }

  const plannedByAssignee =
    taskPositions != null
      ? computeAssigneePointsStats(taskPositions, tasksMap).byAssignee
      : null;

  // Список участников — источник правды. При наличии позиций — те же суммы, что в свимлейне (карточки на строке).
  const developerLoads = developers.map(dev => {
    const devTasks = devTasksOnly.filter(task => task.assignee === dev.id);
    const qaTasks = qaTasksArray.filter(task => task.qaEngineer === dev.id);

    let totalSP: number;
    let totalTP: number;
    if (plannedByAssignee) {
      const p = plannedByAssignee.get(dev.id) ?? { storyPoints: 0, testPoints: 0 };
      totalSP = p.storyPoints;
      totalTP = p.testPoints;
    } else {
      totalSP = devTasks.reduce((sum, task) => sum + getTaskStoryPoints(task), 0);
      totalTP = qaTasks.reduce((sum, task) => sum + getTaskTestPoints(task), 0);
    }

    return {
      dev,
      totalSP,
      totalTP,
      isDeveloper: devTasks.length > 0,
      isQA: qaTasks.length > 0,
    };
  });

  // Нормы 20 SP / 30 TP только для developer и tester; other в чеклист не попадают
  const developerLoadsForNormChecklist = developerLoads.filter(
    (load) => load.dev.role !== 'other'
  );

  const check2Passed =
    developerLoadsForNormChecklist.length === 0 ||
    developerLoadsForNormChecklist.every((load) => {
      if (load.dev.role === 'tester') {
        return load.totalTP === 30;
      }
      return load.totalSP === 20;
    });

  // Проверка 3: Все задачи правильно размечены (список совпадает с вкладкой «Невалидные»)
  const check3Passed = invalidTasks.length === 0;

  const allChecksPassed = check1Passed && check2Passed && check3Passed;

  return {
    check1Passed,
    check2Passed,
    check3Passed,
    allChecksPassed,
    hasGoals,
    allGoalsSmart,
    developerLoads: developerLoadsForNormChecklist,
    invalidTasks,
  };
}
