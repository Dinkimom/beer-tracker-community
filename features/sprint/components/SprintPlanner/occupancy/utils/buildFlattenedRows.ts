import { TASK_GROUP_KEY_NO_PARENT } from '@/features/task/constants/taskGroupKeys';
import type { OccupancyTaskOrder } from '@/lib/beerTrackerApi';
import type { Task, TaskParent, TaskPosition } from '@/types';

function resolveIssueKeyFromSelf(self?: TaskParent['self']): string | undefined {
  if (!self || typeof self !== 'string') return undefined;
  // Ожидаем URL формата ".../issues/<ISSUE_KEY>".
  const m = self.match(/\/issues\/([^/?#]+)/i);
  const raw = m?.[1];
  if (!raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function resolveParentIssueKey(parent?: TaskParent): string | undefined {
  const k = parent?.key?.trim();
  if (k) return k;
  return resolveIssueKeyFromSelf(parent?.self);
}

export type FlattenedRow =
  | { type: 'parent'; id: string; display: string; key?: string }
  | { type: 'task'; task: Task; qaTask?: Task };

export function buildFlattenedRows(
  tasks: Task[],
  taskPositions: Map<string, TaskPosition>,
  globalNameFilter: string,
  selectedAssigneeIds?: Set<string>,
  customOrder?: OccupancyTaskOrder
): FlattenedRow[] {
  let filtered = globalNameFilter.trim()
    ? tasks.filter(
        (t) =>
          (t.originalTaskId || t.id).toLowerCase().includes(globalNameFilter.trim().toLowerCase()) ||
          (t.name || '').toLowerCase().includes(globalNameFilter.trim().toLowerCase())
      )
    : [...tasks];

  // Карта dev id -> QA задача (один проход, для быстрого поиска связанных)
  const qaByOriginalId = new Map<string, Task>();
  filtered.forEach((t) => {
    if (t.originalTaskId) qaByOriginalId.set(t.originalTaskId, t);
  });

  // Фильтрация по выбранным исполнителям
  if (selectedAssigneeIds && selectedAssigneeIds.size > 0) {
    const filteredByAssignee = filtered.filter((task) => {
      const position = taskPositions.get(task.id);
      if (position && selectedAssigneeIds.has(position.assignee)) return true;
      if (task.assignee && selectedAssigneeIds.has(task.assignee)) return true;
      if (task.qaEngineer && selectedAssigneeIds.has(task.qaEngineer)) return true;
      return false;
    });

    const relatedTaskIds = new Set<string>();
    filteredByAssignee.forEach((task) => {
      relatedTaskIds.add(task.id);
      if (task.originalTaskId) {
        relatedTaskIds.add(task.originalTaskId);
      } else {
        const relatedQATask = qaByOriginalId.get(task.id);
        if (relatedQATask) relatedTaskIds.add(relatedQATask.id);
      }
    });

    filtered = filtered.filter((task) => relatedTaskIds.has(task.id));
    // Обновляем карту после сужения списка (для pushTaskRows ниже)
    qaByOriginalId.clear();
    filtered.forEach((t) => {
      if (t.originalTaskId) qaByOriginalId.set(t.originalTaskId, t);
    });
  }

  const byParent = new Map<string | '__root__', Task[]>();
  filtered.forEach((t) => {
    // В качестве «родителя» используем parent, а если его нет — epic
    const parentOrEpic = t.parent ?? t.epic;
    const key = parentOrEpic?.id ?? '__root__';
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key)!.push(t);
  });

  /** Сортировка по ключу (id) для предсказуемого порядка при отсутствии ручного */
  const sortByKey = <T extends { id: string }>(items: T[]): T[] =>
    [...items].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

  const sortByCustomOrder = <T extends { id: string }>(
    items: T[],
    order: string[] | undefined
  ): T[] => {
    const byId = new Map<string, T>();
    items.forEach((i) => byId.set(i.id, i));
    if (order?.length) {
      const orderSet = new Set(order);
      const ordered: T[] = [];
      order.forEach((id) => {
        const item = byId.get(id);
        if (item) ordered.push(item);
      });
      const rest = items.filter((item) => !orderSet.has(item.id));
      return [...ordered, ...sortByKey(rest)];
    }
    return sortByKey(items);
  };

  const pushTaskRows = (
    group: Task[],
    rows: FlattenedRow[],
    parentKey: string | '__root__'
  ) => {
    const devTasks = group.filter((t) => !t.originalTaskId);
    const devIds = new Set(devTasks.map((d) => d.id));
    const orphanQA = group.filter(
      (t) => t.originalTaskId && !devIds.has(t.originalTaskId)
    );
    const taskOrder = customOrder?.taskOrders?.[parentKey];
    const allTasksForOrder = [...devTasks, ...orphanQA];
    const sorted = sortByCustomOrder(allTasksForOrder, taskOrder);
    sorted.forEach((t) => {
      if (t.originalTaskId) {
        rows.push({ type: 'task', task: t });
      } else {
        rows.push({ type: 'task', task: t, qaTask: qaByOriginalId.get(t.id) });
      }
    });
  };

  const rows: FlattenedRow[] = [];
  const naturalParentIds = [
    ...new Set(
      filtered
        .map((t) => (t.parent ?? t.epic)?.id)
        .filter((id): id is string => !!id)
    ),
  ];
  const naturalParentIdSet = new Set(naturalParentIds);
  const orderParentIdSet = customOrder?.parentIds?.length
    ? new Set(customOrder.parentIds)
    : null;
  const parentIds =
    orderParentIdSet && orderParentIdSet.size > 0
      ? [
          ...customOrder!.parentIds!.filter((id) => naturalParentIdSet.has(id)),
          ...naturalParentIds.filter((id) => !orderParentIdSet.has(id)),
        ]
      : naturalParentIds;

  parentIds.forEach((pid) => {
    const group = byParent.get(pid) ?? [];
    if (group.length === 0) return;
    const parent = group[0].parent ?? group[0].epic;
    const display = parent?.display ?? pid;
    const parentKey = resolveParentIssueKey(parent);
    rows.push({ type: 'parent', id: pid, display, key: parentKey });
    pushTaskRows(group, rows, pid);
  });

  const roots = byParent.get('__root__') ?? [];
  if (roots.length > 0) {
    rows.push({ type: 'parent', id: '__root__', display: TASK_GROUP_KEY_NO_PARENT });
    pushTaskRows(roots, rows, '__root__');
  }

  return rows;
}
