'use client';

import type { SprintInfo } from '@/features/sprint/components/SprintPlanner/occupancy/OccupancyView';
import type { Developer, Task, TaskLink, TaskPosition } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { WORKING_DAYS } from '@/constants';
import { createQATasksMap } from '@/features/qa/utils/qaTaskUtils';
import { isTaskCompleted } from '@/features/task/hooks/useTaskFiltering';
import { fetchEpicDeep } from '@/lib/api/epics';
import { addIssueToSprint } from '@/lib/api/issues';
import { fetchTeamMembers } from '@/lib/api/quarterly';
import { deleteTaskLink, deleteTaskPosition, fetchSprintLinks, fetchSprintPositions, saveTaskLink, saveTaskPosition } from '@/lib/beerTrackerApi';

interface UseEpicOccupancyDataParams {
  boardId: number | null;
  /** Ключ эпика в трекере (например, NW-1234) */
  epicId: string;
  /** Квартал 1–4 (для страницы квартального планирования v2) */
  quarter?: 1 | 2 | 3 | 4;
  /** Триггер принудительной перезагрузки данных (например, после создания задачи) */
  reloadToken?: number;
  /** Список всех спринтов доски */
  sprints: SprintListItem[];
  /** Фильтр по статусу: при смене выполняется перезапрос к бэку и показ оверлея загрузки */
  statusFilter?: 'active' | 'all' | 'completed';
  /** Год квартала (для страницы квартального планирования v2; если не задан — текущий квартал) */
  year?: number;
}

interface UseEpicOccupancyDataResult {
  allDevelopers: Developer[];
  isLoading: boolean;
  /** Спринты для отображения (отсортированы по дате) */
  sprintInfos: SprintInfo[];
  /** Связи задач (из task_links) по всем спринтам */
  taskLinks: TaskLink[];
  /**
   * Скорректированные позиции: taskId → позиция с уже смещённым startDay.
   * Берётся первое вхождение задачи (из самого раннего спринта).
   */
  taskPositions: Map<string, TaskPosition>;
  /** Все задачи, принадлежащие эпику (включая незапланированные) */
  tasks: Task[];
  /** taskId → { sprintId, sprintIdx } — в каком спринте хранится позиция задачи. */
  taskSprintMap: Map<string, { sprintId: number; sprintIdx: number }>;
  /** Добавляет связь между задачами (сохраняет в спринт fromTask). */
  handleAddLink: (link: { fromTaskId: string; toTaskId: string; id: string }) => Promise<void>;
  /**
   * Оптимистично обновляет исполнителя задачи в локальном состоянии.
   * Для синтетических QA-задач обновляет и dev-задачу (qaEngineer), и QA-задачу (assignee),
   * т.к. QA-задачи в этом вью не пересоздаются автоматически.
   */
  handleAssigneeUpdate: (task: Task, assigneeId: string, assigneeName?: string) => void;
  /** Удаляет связь. */
  handleDeleteLink: (linkId: string) => Promise<void>;
  /** Сохраняет позицию задачи в нужный спринт (с обратным преобразованием offset). */
  handlePositionSave: (position: TaskPosition, isQa: boolean, devTaskKey?: string) => Promise<void>;
  /** Удаляет плановую фазу задачи (позицию) из БД и локального состояния. */
  handleRemoveFromPlan: (taskId: string) => Promise<void>;
}

/** Возвращает границы квартала (начало и конец). Если year/quarter не заданы — текущий квартал. */
function getQuarterBounds(year?: number, quarter?: 1 | 2 | 3 | 4): { quarterEnd: Date; quarterStart: Date } {
  if (year != null && quarter != null) {
    const quarterIndex = quarter - 1; // 0..3
    const quarterStart = new Date(year, quarterIndex * 3, 1);
    quarterStart.setHours(0, 0, 0, 0);
    const quarterEnd = new Date(year, (quarterIndex + 1) * 3, 0);
    quarterEnd.setHours(23, 59, 59, 999);
    return { quarterStart, quarterEnd };
  }
  const now = new Date();
  const y = now.getFullYear();
  const quarterIndex = Math.floor(now.getMonth() / 3); // 0..3
  const quarterStart = new Date(y, quarterIndex * 3, 1);
  quarterStart.setHours(0, 0, 0, 0);
  const quarterEnd = new Date(y, (quarterIndex + 1) * 3, 0);
  quarterEnd.setHours(23, 59, 59, 999);
  return { quarterStart, quarterEnd };
}

/**
 * Хук для загрузки данных «Планирование эпика»:
 * - диапазон спринтов: все спринты текущего квартала
 * - фильтрация: только задачи из стори, относящихся к эпику
 * - задачи из CH (глубокий запрос), спринт задачи — по полю sprints в CH
 * - разработчики — один запрос /api/teams/members
 * - позиции с корректировкой startDay на смещение спринта
 * - связи из task_links
 */
export function useEpicOccupancyData({
  boardId,
  epicId,
  sprints,
  reloadToken,
  statusFilter = 'all',
  year,
  quarter,
}: UseEpicOccupancyDataParams): UseEpicOccupancyDataResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskPositions, setTaskPositions] = useState<Map<string, TaskPosition>>(new Map());
  const [taskLinks, setTaskLinks] = useState<TaskLink[]>([]);
  const [allDevelopers, setAllDevelopers] = useState<Developer[]>([]);
  /** true с первого кадра, чтобы не мелькал контент до появления оверлея */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * taskId → { sprintId, sprintIdx } — в каком спринте хранится позиция задачи.
   * Нужно для обратного преобразования offset при сохранении.
   */
  const [taskSprintMap, setTaskSprintMap] = useState<Map<string, { sprintId: number; sprintIdx: number }>>(new Map());

  /**
   * linkId → sprintId — в каком спринте хранится связь.
   * Нужно для удаления по linkId без перебора всех спринтов.
   */
  const [linkSprintMap, setLinkSprintMap] = useState<Map<string, number>>(new Map());

  // Спринты выбранного квартала (или текущего)
  const sprintInfos = useMemo((): SprintInfo[] => {
    if (sprints.length === 0) return [];

    const { quarterStart, quarterEnd } = getQuarterBounds(year, quarter);

    return sprints
      .filter((s) => {
        const sprintEnd = new Date(s.endDate);
        sprintEnd.setHours(23, 59, 59, 999);
        const sprintStart = new Date(s.startDate);
        sprintStart.setHours(0, 0, 0, 0);
        // Спринт пересекается с текущим кварталом
        return sprintEnd >= quarterStart && sprintStart <= quarterEnd;
      })
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .map((s) => ({
        id: s.id,
        name: s.name,
        startDate: new Date(s.startDate),
        endDate: new Date(s.endDate),
      }));
  }, [sprints, year, quarter]);

  // Загружаем задачи, позиции и связи по всем спринтам
  useEffect(() => {
    if (!boardId) {
      setIsLoading(false);
      setTasks([]);
      setTaskPositions(new Map());
      setTaskLinks([]);
      setAllDevelopers([]);
      return;
    }

    // Пока спринты не подгрузились или список пустой — показываем загрузку, чтобы не мелькало «Нет задач»
    if (sprintInfos.length === 0) {
      setIsLoading(true);
      setTasks([]);
      setTaskPositions(new Map());
      setTaskLinks([]);
      setAllDevelopers([]);
      return;
    }

    let cancelled = false;

    async function loadData() {
      setIsLoading(true);
      try {
        // 1. Один запрос в CH: эпик + стори + все задачи (в т.ч. в каких спринтах — из поля sprints)
        const epicStoryKeys = new Set<string>();
        const tasksMap = new Map<string, Task>();
        try {
          const deep = await fetchEpicDeep(epicId);
          deep.stories.forEach((s) => {
            if (s.story.key) epicStoryKeys.add(s.story.key);
            s.tasks.forEach((task) => tasksMap.set(task.id, task));
          });
        } catch (err) {
          console.error('[useEpicOccupancyData] Failed to fetch epic deep:', err);
        }

        const posMap = new Map<string, TaskPosition>();
        const linksMap = new Map<string, TaskLink>();
        const developersMap = new Map<string, Developer>();
        const newTaskSprintMap = new Map<string, { sprintId: number; sprintIdx: number }>();
        const newLinkSprintMap = new Map<string, number>();
        /** Спринт, в котором задача числится в трекере (из CH task.sprints). */
        const taskTrackerSprintIdx = new Map<string, number>();
        const tempPositions = new Map<
          string,
          { pos: TaskPosition; storageSprintId: number; storageSprintIdx: number }
        >();

        // Спринт задачи определяем по данным из CH (task.sprints), без запросов /api/tracker
        tasksMap.forEach((task, taskId) => {
          const sprintRef = task.sprints?.[0];
          const sprintName = sprintRef?.id ?? sprintRef?.display;
          if (sprintName) {
            const idx = sprintInfos.findIndex((s) => s.name === sprintName);
            if (idx >= 0) taskTrackerSprintIdx.set(taskId, idx);
          }
        });

        // Разработчики — один запрос по доске (вместо N ответов /api/tracker)
        try {
          const devs = await fetchTeamMembers(boardId!);
          devs.forEach((d) => developersMap.set(d.id, d));
        } catch (err) {
          console.warn('[useEpicOccupancyData] Failed to fetch team members:', err);
        }

        // 2. Позиции и связи — наш бэкенд, грузим по всем спринтам параллельно (отдельные запросы быстрее батча на практике).
        const [positionsPerSprint, linksPerSprint] = await Promise.all([
          Promise.all(
            sprintInfos.map((s) =>
              fetchSprintPositions(s.id as number).catch((err) => {
                console.error(`[useEpicOccupancyData] Failed to load positions for sprint ${s.id}:`, err);
                return [] as TaskPosition[];
              })
            )
          ),
          Promise.all(
            sprintInfos.map((s) =>
              fetchSprintLinks(s.id as number).catch((err) => {
                console.error(`[useEpicOccupancyData] Failed to load links for sprint ${s.id}:`, err);
                return [] as TaskLink[];
              })
            )
          ),
        ]);

        // 3. Позиции и связи по спринтам (данные уже загружены; задачи и спринт задачи — из CH)
        for (let sprintIdx = 0; sprintIdx < sprintInfos.length; sprintIdx++) {
          if (cancelled) return;
          const sprint = sprintInfos[sprintIdx];
          const positions = positionsPerSprint[sprintIdx];
          const links = linksPerSprint[sprintIdx];

          positions.forEach((pos) => {
            const trackerSprintIdx = taskTrackerSprintIdx.get(pos.taskId);
            const existing = tempPositions.get(pos.taskId);
            const shouldUpdate =
              !existing ||
              (trackerSprintIdx !== undefined && trackerSprintIdx === sprintIdx);
            if (shouldUpdate) {
              const baseSegments = pos.segments;
              const segments =
                baseSegments && baseSegments.length > 0
                  ? baseSegments.map((s) => ({
                      startDay: s.startDay,
                      startPart: s.startPart,
                      duration: s.duration,
                    }))
                  : baseSegments;
              tempPositions.set(pos.taskId, {
                pos: {
                  ...pos,
                  segments,
                },
                storageSprintId: sprint.id as number,
                storageSprintIdx: sprintIdx,
              });
            }
          });

          links.forEach((link) => {
            if (!linksMap.has(link.id)) {
              linksMap.set(link.id, link);
              newLinkSprintMap.set(link.id, sprint.id as number);
            }
          });
        }

        // Строим posMap и taskSprintMap: смещение для отображения — по спринту задачи в трекере,
        // а не по спринту хранения позиции (иначе фаза рисуется не в том столбце).
        tempPositions.forEach(({ pos, storageSprintId, storageSprintIdx }, taskId) => {
          const displaySprintIdx = taskTrackerSprintIdx.get(taskId) ?? storageSprintIdx;
          const displayOffset = displaySprintIdx * WORKING_DAYS;
          const segmentsWithOffset =
            pos.segments && pos.segments.length > 0
              ? pos.segments.map((seg) => ({
                  startDay: seg.startDay + displayOffset,
                  startPart: seg.startPart,
                  duration: seg.duration,
                }))
              : pos.segments;
          posMap.set(taskId, {
            ...pos,
            startDay: pos.startDay + displayOffset,
            plannedStartDay:
              pos.plannedStartDay != null ? pos.plannedStartDay + displayOffset : undefined,
            segments: segmentsWithOffset,
          });
          newTaskSprintMap.set(taskId, { sprintId: storageSprintId, sprintIdx: storageSprintIdx });
        });

        // 5. Для задач с testPoints, у которых нет реальной QA-задачи из спринтов,
        //    создаём синтетические QA-задачи — иначе добавить QA-фазу невозможно.
        const realQaDevTaskIds = new Set(
          Array.from(tasksMap.values())
            .filter((t) => t.originalTaskId)
            .map((t) => t.originalTaskId!)
        );
        const devTasksWithoutRealQa = Array.from(tasksMap.values()).filter(
          (t) =>
            !t.originalTaskId &&
            t.testPoints != null &&
            t.testPoints > 0 &&
            !realQaDevTaskIds.has(t.id)
        );
        const syntheticQaMap = createQATasksMap(devTasksWithoutRealQa);
        syntheticQaMap.forEach((qaTask) => {
          tasksMap.set(qaTask.id, qaTask);
        });

        // 6. Показываем задачи эпика с учётом фильтра по статусу (при смене фильтра — перезапрос уже выполнен).
        const allTasksList = Array.from(tasksMap.values());
        const filteredTasks =
          statusFilter === 'all'
            ? allTasksList
            : statusFilter === 'completed'
              ? allTasksList.filter(isTaskCompleted)
              : allTasksList.filter((t) => !isTaskCompleted(t));
        setTasks(filteredTasks);
        setTaskPositions(posMap);
        setTaskLinks(Array.from(linksMap.values()));
        setAllDevelopers(Array.from(developersMap.values()));
        setTaskSprintMap(newTaskSprintMap);
        setLinkSprintMap(newLinkSprintMap);
      } catch (err) {
        console.error('[useEpicOccupancyData] Error loading data:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [sprintInfos, boardId, epicId, reloadToken, statusFilter]);

  /**
   * Сохраняет (или перемещает) позицию задачи в нужный спринт.
   * position.startDay — глобальный offset (sprintIdx * WORKING_DAYS + dayInSprint).
   */
  const handlePositionSave = useCallback(
    async (position: TaskPosition, isQa: boolean, devTaskKey?: string) => {
      // Оптимистично обновляем локальное состояние
      setTaskPositions((prev) => {
        const next = new Map(prev);
        next.set(position.taskId, position);
        return next;
      });

      // Определяем новый спринт по глобальному startDay
      const newSprintIdx = Math.min(
        Math.max(0, Math.floor(position.startDay / WORKING_DAYS)),
        sprintInfos.length - 1
      );
      const newSprint = sprintInfos[newSprintIdx];
      if (!newSprint) return;

      const actualStartDay = position.startDay - newSprintIdx * WORKING_DAYS;

      // Если задача была в другом спринте — удаляем старую запись
      const oldSprintInfo = taskSprintMap.get(position.taskId);
      if (oldSprintInfo && oldSprintInfo.sprintId !== (newSprint.id as number)) {
        await deleteTaskPosition(oldSprintInfo.sprintId, position.taskId);
      }

      // Вычисляем plannedStartDay относительно нового спринта
      const actualPlannedStartDay =
        position.plannedStartDay != null
          ? position.plannedStartDay - newSprintIdx * WORKING_DAYS
          : null;

      const baseSegments = position.segments;
      const segmentsForSprint =
        baseSegments && baseSegments.length > 0
          ? baseSegments.map((seg) => ({
              startDay: seg.startDay - newSprintIdx * WORKING_DAYS,
              startPart: seg.startPart,
              duration: seg.duration,
            }))
          : undefined;

      await saveTaskPosition(newSprint.id as number, {
        taskId: position.taskId,
        assigneeId: position.assignee,
        startDay: actualStartDay,
        startPart: position.startPart,
        duration: position.duration,
        plannedStartDay: actualPlannedStartDay,
        plannedStartPart: position.plannedStartPart ?? null,
        plannedDuration: position.plannedDuration ?? null,
        isQa,
        devTaskKey,
        ...(segmentsForSprint ? { segments: segmentsForSprint } : {}),
      });

      // Синхронизируем спринт задачи в трекере.
      // QA-фаза — синтетическая, реальная задача всегда dev.
      // Удаление фазы намеренно не трогает спринт в трекере.
      const trackerKey = isQa ? devTaskKey : position.taskId;
      const newSprintNumericId = Number(newSprint.id);
      if (trackerKey && !isNaN(newSprintNumericId)) {
        addIssueToSprint(trackerKey, newSprintNumericId).catch((err) => {
          console.error(
            `[useEpicOccupancyData] Failed to add ${trackerKey} to sprint ${newSprintNumericId}:`,
            err
          );
        });
      }

      // Обновляем карту sprint-принадлежности задачи
      setTaskSprintMap((prev) => {
        const next = new Map(prev);
        next.set(position.taskId, { sprintId: newSprint.id as number, sprintIdx: newSprintIdx });
        return next;
      });
    },
    [sprintInfos, taskSprintMap]
  );

  const handleAssigneeUpdate = useCallback((task: Task, assigneeId: string, assigneeName?: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        // QA: обновляем и dev-задачу, и саму QA-задачу
        if (task.team === 'QA' && task.originalTaskId) {
          if (t.id === task.originalTaskId) {
            return {
              ...t,
              qaEngineer: assigneeId,
              qaEngineerName: assigneeName ?? t.qaEngineerName,
            };
          }
          if (t.id === task.id) {
            return {
              ...t,
              assignee: assigneeId,
              assigneeName: assigneeName ?? t.assigneeName,
            };
          }
          return t;
        }

        if (t.id !== task.id) return t;
        return {
          ...t,
          assignee: assigneeId,
          assigneeName: assigneeName ?? t.assigneeName,
        };
      })
    );
  }, []);

  /**
   * Добавляет связь между задачами.
   * Связь сохраняется в спринте fromTask (или в первом спринте, если не найден).
   */
  const handleAddLink = useCallback(
    async (link: { fromTaskId: string; toTaskId: string; id: string }) => {
      // Оптимистично добавляем в локальное состояние
      setTaskLinks((prev) => [...prev, link]);

      const sprintInfo = taskSprintMap.get(link.fromTaskId);
      const sprintId = sprintInfo?.sprintId ?? (sprintInfos[0]?.id as number | undefined);
      if (!sprintId) return;

      const success = await saveTaskLink(sprintId, {
        id: link.id,
        fromTaskId: link.fromTaskId,
        toTaskId: link.toTaskId,
      });

      if (success) {
        setLinkSprintMap((prev) => {
          const next = new Map(prev);
          next.set(link.id, sprintId);
          return next;
        });
      }
    },
    [sprintInfos, taskSprintMap]
  );

  /**
   * Удаляет связь по её id.
   */
  const handleDeleteLink = useCallback(
    async (linkId: string) => {
      // Оптимистично удаляем из локального состояния
      setTaskLinks((prev) => prev.filter((l) => l.id !== linkId));

      const sprintId = linkSprintMap.get(linkId);
      if (!sprintId) return;

      await deleteTaskLink(sprintId, linkId);

      setLinkSprintMap((prev) => {
        const next = new Map(prev);
        next.delete(linkId);
        return next;
      });
    },
    [linkSprintMap]
  );

  const handleRemoveFromPlan = useCallback(
    async (taskId: string) => {
      // Оптимистично убираем из UI
      setTaskPositions((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });

      const sprintInfo = taskSprintMap.get(taskId);
      if (!sprintInfo) return;

      await deleteTaskPosition(sprintInfo.sprintId, taskId);

      setTaskSprintMap((prev) => {
        const next = new Map(prev);
        next.delete(taskId);
        return next;
      });
    },
    [taskSprintMap]
  );

  return {
    tasks,
    taskPositions,
    taskLinks,
    taskSprintMap,
    sprintInfos,
    allDevelopers,
    isLoading,
    handlePositionSave,
    handleAssigneeUpdate,
    handleAddLink,
    handleDeleteLink,
    handleRemoveFromPlan,
  };
}
