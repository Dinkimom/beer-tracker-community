/**
 * Утилита для маппинга статусов задач из Tracker API в упрощенные статусы приложения
 */

export type TaskStatus = 'done' | 'in-progress' | 'paused' | 'todo';

/**
 * Маппит ключ статуса из Tracker API в упрощенный статус приложения
 * @param statusKey - Ключ статуса из Tracker API
 * @returns Упрощенный статус или undefined, если статус не определен
 */
export function mapStatus(statusKey: string): TaskStatus | undefined {
  const normalizedKey = statusKey.toLowerCase();
  const statusMap: Record<string, TaskStatus> = {
    // Статусы, которые считаются "не начатыми" или "к началу работы"
    backlog: 'todo',
    readyfordevelopment: 'todo',
    transferredtodevelopment: 'todo',
    new: 'todo',

    // Статусы, которые считаются "в работе"
    inprogress: 'in-progress',
    review: 'in-progress',
    inreview: 'in-progress',

    // Статусы, которые считаются "на тестировании/готовности к тесту"
    readyfortest: 'in-progress',
    readyfortesting: 'in-progress',
    intesting: 'in-progress',

    // Статусы, которые считаются "завершенными"
    rc: 'done',
    closed: 'done',
    done: 'done',

    // Статусы, которые считаются "приостановленными/заблокированными"
    paused: 'paused',
    blocked: 'paused',
    defect: 'paused',
  };
  return statusMap[normalizedKey];
}
