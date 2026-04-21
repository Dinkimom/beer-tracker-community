import type { OccupancyTaskOrder } from './types';
import type { Task } from '@/types';

/** Сортировка по ключу задачи (id), чтобы порядок был предсказуемым при отсутствии ручного порядка */
function sortByTaskKey(items: Task[]): Task[] {
  return [...items].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
}

/**
 * Сортирует задачи по сохранённому порядку занятости (parentIds + taskOrders).
 * Ручной порядок пользователя имеет наивысший приоритет; при его отсутствии — по ключу задачи (id).
 * Используется на бэкенде в /api/tracker.
 */
export function sortTasksByOccupancyOrder(
  tasks: Task[],
  order: OccupancyTaskOrder | null
): Task[] {
  if (!tasks.length) return tasks;

  const byParent = new Map<string | '__root__', Task[]>();
  for (const t of tasks) {
    const key = t.parent?.id ?? '__root__';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  }

  const sortByOrder = (items: Task[], idsOrder: string[] | undefined): Task[] => {
    const byId = new Map<string, Task>();
    items.forEach((i) => byId.set(i.id, i));
    if (idsOrder?.length) {
      const orderSet = new Set(idsOrder);
      const ordered: Task[] = [];
      idsOrder.forEach((id) => {
        const item = byId.get(id);
        if (item) ordered.push(item);
      });
      const rest = items.filter((item) => !orderSet.has(item.id));
      return [...ordered, ...sortByTaskKey(rest)];
    }
    return sortByTaskKey(items);
  };

  const naturalParentIds = [...new Set(tasks.filter((t) => t.parent).map((t) => t.parent!.id))];
  const hasUserOrder = order?.parentIds?.length || (order?.taskOrders && Object.keys(order.taskOrders).length > 0);
  const parentIds =
    hasUserOrder && order?.parentIds?.length
      ? [
          ...order.parentIds.filter((id) => byParent.has(id)),
          ...naturalParentIds.filter((id) => !order.parentIds!.includes(id)),
        ]
      : naturalParentIds;

  const result: Task[] = [];
  for (const pid of parentIds) {
    if (pid === '__root__') continue; // обрабатываем только в блоке ниже, иначе дубль
    const group = byParent.get(pid) ?? [];
    if (group.length === 0) continue;
    const idsOrder = order?.taskOrders?.[pid];
    const sorted = sortByOrder(group, idsOrder);
    result.push(...sorted);
  }
  const roots = byParent.get('__root__') ?? [];
  if (roots.length > 0) {
    const rootsOrder = order?.taskOrders?.['__root__'];
    result.push(...sortByOrder(roots, rootsOrder));
  }

  return result;
}
