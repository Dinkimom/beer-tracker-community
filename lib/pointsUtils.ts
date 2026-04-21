/**
 * Единая точка подсчёта Story Points (SP) и Test Points (TP).
 * Используется в свимлейне, отображении занятости, сайдбаре (метрики), бэклоге и везде, где считаются очки.
 */


/** Минимальный тип для подсчёта очков (Task, FeatureTask и т.д.). */
export interface TaskLikeForPoints {
  id?: string;
  storyPoints?: number;
  team?: string;
  testPoints?: number;
}

/** Задача считается "оригинальной" (не фантом QA) — по таким считаем плановые SP/TP без дублирования. */
export function isOriginalTask(task: TaskLikeForPoints): boolean {
  return task.team !== 'QA';
}

/**
 * Вклад задачи в Story Points.
 * У фантомных QA-задач (team === 'QA') — 0, у остальных — task.storyPoints ?? 0.
 */
export function getTaskStoryPoints(task: TaskLikeForPoints): number {
  if (task.team === 'QA') return 0;
  return task.storyPoints ?? 0;
}

/**
 * Вклад задачи в Test Points.
 * Возвращает task.testPoints ?? 0. Для итогов по спринту считаем только по оригинальным задачам, чтобы не дублировать ТП фантомов.
 */
export function getTaskTestPoints(task: TaskLikeForPoints): number {
  return task.testPoints ?? 0;
}

/** Компактно: «3tp», «0tp»; не задано — «?tp». С пробелом: «3 tp», «0 tp», «? tp». */
export type TaskTestPointsDisplayStyle = 'compact' | 'spaced';

/**
 * Текст TP для UI: undefined/null — «?tp» (или «? tp»), число — в т.ч. «0tp».
 * Для сумм и логики используйте {@link getTaskTestPoints}.
 */
export function formatTaskTestPointsForDisplay(
  task: TaskLikeForPoints,
  style: TaskTestPointsDisplayStyle = 'compact'
): string {
  const n = task.testPoints;
  if (n === undefined || n === null) {
    return style === 'spaced' ? '? tp' : '?tp';
  }
  return style === 'spaced' ? `${n} tp` : `${n}tp`;
}

/**
 * Переводит количество таймслотов занятости в ближайшую оценку по шкале SP:
 * 1 → 1сп, 2 → 2сп, 3 → 3сп, 4–5 → 5сп, 6–7 → 8сп, 8–9 → 13сп, 10+ → 21сп.
 */
export function timeslotsToStoryPoints(timeslots: number): number {
  if (timeslots <= 0) return 0;
  if (timeslots === 1) return 1;
  if (timeslots === 2) return 2;
  if (timeslots === 3) return 3;
  if (timeslots <= 5) return 5;
  if (timeslots <= 7) return 8;
  if (timeslots <= 9) return 13;
  return 21;
}

/**
 * Переводит оценку SP в количество таймслотов для начального размера фазы.
 * Обратная к timeslotsToStoryPoints: берётся нижняя граница диапазона.
 * 1 → 1, 2 → 2, 3 → 3, 4–5 → 5, 6–8 → 6, 9–13 → 8, 14+ → 10.
 */
export function storyPointsToTimeslots(sp: number): number {
  if (sp <= 0) return 0;
  if (sp <= 1) return 1;
  if (sp <= 2) return 2;
  if (sp <= 3) return 3;
  if (sp <= 5) return 5;
  if (sp <= 8) return 6;
  if (sp <= 13) return 8;
  return 10;
}

export interface SprintPointsTotalsOptions {
  /** ID задач целей спринта — исключаются из подсчёта (delivery/discovery). */
  goalTaskIds?: string[] | string;
}

/**
 * Суммарные SP и TP по списку задач.
 * Учитываются только оригинальные задачи (не фантомы QA); при необходимости исключаются цели.
 * Один и тот же вызов даёт одинаковые итоги в свимлейне, занятости и сайдбаре.
 */
export function getSprintPointsTotals(
  tasks: TaskLikeForPoints[],
  options?: SprintPointsTotalsOptions
): { totalSP: number; totalTP: number } {
  const goalIds = options?.goalTaskIds == null
    ? new Set<string>()
    : new Set(Array.isArray(options.goalTaskIds) ? options.goalTaskIds : [options.goalTaskIds]);

  let totalSP = 0;
  let totalTP = 0;

  for (const task of tasks) {
    if (!isOriginalTask(task)) continue;
    if (task.id != null && goalIds.has(task.id)) continue;
    totalSP += getTaskStoryPoints(task);
    totalTP += getTaskTestPoints(task);
  }

  return { totalSP, totalTP };
}
