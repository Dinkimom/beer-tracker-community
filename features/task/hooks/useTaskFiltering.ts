import type { StatusFilter, Task } from '@/types';

import { isEffectivelyQaTask, isTaskCompleted } from '@/features/task/utils/taskUtils';

export { isTaskCompleted };

interface UseTaskFilteringProps {
  goalTask?: Task | null;
  /** ID задач на цели (delivery + discovery), исключаются из списка */
  goalTaskIds?: string[];
  nameFilter: string;
  qaTasksMap: Map<string, Task>;
  statusFilter: StatusFilter;
  tasks: Task[];
}

/**
 * Хук для фильтрации задач по различным критериям
 */
export function useTaskFiltering({
  tasks,
  qaTasksMap,
  statusFilter,
  nameFilter,
  goalTask,
  goalTaskIds,
}: UseTaskFilteringProps) {
  const ids = goalTaskIds ?? (goalTask ? [goalTask.id] : []);

  // Базовые dev задачи без фильтров (для подсчета в табах)
  // "QA-эффективные" задачи (по integration rules) не должны попадать в Dev.
  let devTasksUnfiltered = tasks.filter(task => !isEffectivelyQaTask(task));

  // Исключаем задачи на цели спринта (delivery + discovery)
  if (ids.length > 0) {
    const goalSet = new Set(ids);
    devTasksUnfiltered = devTasksUnfiltered.filter(task => !goalSet.has(task.id));
  }

  // QA-задачи для сайдбара:
  // - все задачи, которые эффективно считаются QA (team QA или integration flag),
  // - плюс синтетические QA-задачи из qaTasksMap для оставшихся dev-задач.
  const qaTasksUnfiltered: Task[] = [];
  const qaIdsAdded = new Set<string>();
  const goalSet = new Set(ids);

  tasks.forEach(task => {
    if (goalSet.has(task.id)) {
      return;
    }

    if (isEffectivelyQaTask(task)) {
      if (!qaIdsAdded.has(task.id)) {
        qaIdsAdded.add(task.id);
        qaTasksUnfiltered.push(task);
      }
      return;
    }

    // Сгенерированные по dev: для каждой dev-задачи берём QA из qaTasksMap (ключ — id dev-задачи).
    const qaTaskFromDev = qaTasksMap.get(task.id);
    if (qaTaskFromDev && !qaIdsAdded.has(qaTaskFromDev.id)) {
      qaIdsAdded.add(qaTaskFromDev.id);
      qaTasksUnfiltered.push(qaTaskFromDev);
    }
  });

  // Применяем фильтр по названию и ключу к dev задачам
  let devTasksByName = [...devTasksUnfiltered];
  if (nameFilter.trim()) {
    const searchTerm = nameFilter.trim().toLowerCase();
    devTasksByName = devTasksByName.filter(task =>
      task.name.toLowerCase().includes(searchTerm) ||
      task.id.toLowerCase().includes(searchTerm)
    );
  }

  // Применяем фильтр по статусу к dev задачам
  let devTasksByStatus = [...devTasksByName];
  if (statusFilter === 'completed') {
    devTasksByStatus = devTasksByStatus.filter(task => isTaskCompleted(task));
  } else if (statusFilter === 'active') {
    devTasksByStatus = devTasksByStatus.filter(task => !isTaskCompleted(task));
  }

  const devTasksFiltered = [...devTasksByStatus];

  // Применяем фильтр по названию и ключу к QA задачам
  let qaTasksByName = [...qaTasksUnfiltered];
  if (nameFilter.trim()) {
    const searchTerm = nameFilter.trim().toLowerCase();
    qaTasksByName = qaTasksByName.filter(task =>
      task.name.toLowerCase().includes(searchTerm) ||
      task.id.toLowerCase().includes(searchTerm)
    );
  }

  // Применяем фильтр по статусу к QA задачам
  let qaTasksByStatus = [...qaTasksByName];
  if (statusFilter === 'completed') {
    qaTasksByStatus = qaTasksByStatus.filter(task => isTaskCompleted(task));
  } else if (statusFilter === 'active') {
    qaTasksByStatus = qaTasksByStatus.filter(task => !isTaskCompleted(task));
  }

  return {
    // Счётчики на вкладках Все/Dev/QA и бейдж таба «Задачи» — с учётом поиска и статуса
    devTasksCount: devTasksFiltered.length,
    qaTasksCount: qaTasksByStatus.length,
    allTasksCount: devTasksFiltered.length + qaTasksByStatus.length,

    devTasks: devTasksFiltered,
    qaTasks: qaTasksByStatus,
    allTasks: [...devTasksFiltered, ...qaTasksByStatus],

    devTasksUnfiltered,
  };
}
