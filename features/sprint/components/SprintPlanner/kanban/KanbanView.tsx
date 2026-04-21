'use client';

import type { Developer, SidebarGroupBy, Task } from '@/types';
import type { BoardColumn } from '@/types/tracker';

import { DndContext, DragOverlay, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useQuery } from '@tanstack/react-query';
import { observer } from 'mobx-react-lite';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { TaskCard } from '@/features/task/components/TaskCard/TaskCard';
import { TASK_GROUP_KEY_NO_PARENT, TASK_GROUP_KEY_UNASSIGNED } from '@/features/task/constants/taskGroupKeys';
import {
  fetchBoard,
  getIssueTransitions,
  getIssueTransitionsBatch,
  type TransitionItem,
} from '@/lib/beerTrackerApi';
import { useRootStore } from '@/lib/layers';
import { getTaskStoryPoints, getTaskTestPoints } from '@/lib/pointsUtils';

import { KanbanColumn } from './KanbanColumn';
import {
  getColumnIdFromDroppable,
  getColumnStatusKey,
  normalizeStatusKeyForComparison,
  parseKanbanTaskId,
} from './kanbanDndUtils';

const UNKNOWN_STATUS_COLUMN_ID = '__unknown__';

function kanbanTaskMatchesNameFilter(task: Task, filter: string): boolean {
  if (!filter.trim()) return true;
  const q = filter.trim().toLowerCase();
  return (
    task.name.toLowerCase().includes(q) ||
    task.id.toLowerCase().includes(q) ||
    (task.assigneeName?.toLowerCase().includes(q) ?? false)
  );
}

function buildKanbanColumnsWithHeaderData(
  ordered: Array<{ column: BoardColumn; tasks: Task[] }>,
  globalNameFilter: string | undefined
) {
  return ordered.map(({ column, tasks: columnTasks }) => {
    const filtered = globalNameFilter
      ? columnTasks.filter((t) => kanbanTaskMatchesNameFilter(t, globalNameFilter))
      : columnTasks;
    let totalSp = 0;
    let totalTp = 0;
    for (const t of filtered) {
      if (typeof t.storyPoints === 'number' && !Number.isNaN(t.storyPoints)) totalSp += t.storyPoints;
      if (typeof t.testPoints === 'number' && !Number.isNaN(t.testPoints)) totalTp += t.testPoints;
    }
    return { column, tasks: columnTasks, filteredTasks: filtered, totalSp, totalTp };
  });
}

/** Нормализация ключа статуса для сравнения (как в Tracker API: нижний регистр, без пробелов/подчёркиваний/дефисов) */
function normStatusKey(key: string): string {
  return (key || '').toLowerCase().replace(/[\s_-]/g, '').trim();
}

interface KanbanViewProps {
  boardId: number | null;
  contextMenuBlurOtherCards?: boolean;
  developers: Developer[];
  groupBy?: SidebarGroupBy;
  tasks: Task[];
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  onStatusChange?: (taskId: string, transitionId: string, targetStatusKey?: string, targetStatusDisplay?: string, screenId?: string) => Promise<void>;
  onTaskClick?: (taskId: string) => void;
}

/**
 * Группирует задачи по колонкам доски.
 * Колонки приходят из GET /v3/boards/<id>/columns с полем statuses[].key — по нему сопоставляем task.originalStatus.
 */
function groupTasksByColumns(
  tasks: Task[],
  columns: BoardColumn[],
  unknownStatusDisplay: string
): Map<string, { column: BoardColumn; tasks: Task[] }> {
  const result = new Map<string, { column: BoardColumn; tasks: Task[] }>();
  columns.forEach((col) => result.set(col.id, { column: col, tasks: [] }));

  const unknownColumn: BoardColumn = {
    id: UNKNOWN_STATUS_COLUMN_ID,
    display: unknownStatusDisplay,
  };
  result.set(UNKNOWN_STATUS_COLUMN_ID, { column: unknownColumn, tasks: [] });

  for (const task of tasks) {
    const taskStatusNorm = normStatusKey(task.originalStatus ?? '');
    let columnId: string = UNKNOWN_STATUS_COLUMN_ID;
    if (taskStatusNorm) {
      const column = columns.find(
        (col) =>
          col.statusKeys?.some((k) => normStatusKey(k) === taskStatusNorm)
      );
      if (column) columnId = column.id;
    }
    const entry = result.get(columnId);
    if (entry) entry.tasks.push(task);
  }

  return result;
}

export const KanbanView = observer(function KanbanView({
  boardId,
  tasks,
  developers,
  groupBy = 'none',
  contextMenuBlurOtherCards = false,
  onStatusChange,
  onTaskClick,
  onContextMenu,
}: KanbanViewProps) {
  const { t } = useI18n();
  const { sprintPlannerUi } = useRootStore();
  const globalNameFilter = sprintPlannerUi.globalNameFilter;
  const contextMenuTaskId = sprintPlannerUi.contextMenuTaskId;

  const groupByAssignee = groupBy === 'assignee';
  const groupByParent = groupBy === 'parent';
  const hasLaneGrouping = groupByAssignee || groupByParent;
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [transitionsForActive, setTransitionsForActive] = useState<TransitionItem[]>([]);
  const [transitionsByTaskId, setTransitionsByTaskId] = useState<Map<string, TransitionItem[]>>(new Map());
  const [collapsedLanes, setCollapsedLanes] = useState<Set<string>>(new Set());
  const preloadStartedForRef = useRef<Set<string>>(new Set());

  const toggleLaneCollapsed = useCallback((laneKey: string) => {
    setCollapsedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(laneKey)) next.delete(laneKey);
      else next.add(laneKey);
      return next;
    });
  }, []);

  const { data: board, isLoading, error } = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => fetchBoard(boardId!),
    enabled: boardId !== null && boardId > 0,
  });

  // Убираем только синтетические QA-фантомы (с originalTaskId); нативные задачи команды QA показываем
  const tasksForKanban = useMemo(
    () => tasks.filter((t) => !(t.team === 'QA' && t.originalTaskId)),
    [tasks]
  );

  const columnsWithTasks = useMemo(() => {
    if (!board?.columns?.length) return [];
    const grouped = groupTasksByColumns(
      tasksForKanban,
      board.columns,
      t('sprintPlanner.kanban.unknownStatus')
    );
    const ordered: Array<{ column: BoardColumn; tasks: Task[] }> = [];
    board.columns.forEach((col) => {
      const entry = grouped.get(col.id);
      if (entry) ordered.push(entry);
    });
    const unknown = grouped.get(UNKNOWN_STATUS_COLUMN_ID);
    if (unknown && unknown.tasks.length > 0) ordered.push(unknown);
    return ordered;
  }, [board, tasksForKanban, t]);

  const columnsWithHeaderData = useMemo(() => {
    return buildKanbanColumnsWithHeaderData(columnsWithTasks, globalNameFilter);
  }, [columnsWithTasks, globalNameFilter]);

  const assigneeLanes = useMemo(() => {
    if (!groupByAssignee || !board?.columns?.length) return [];
    const keyToLane = new Map<string, { assigneeName: string; developer: Developer | null; tasks: Task[] }>();
    for (const t of tasksForKanban) {
      let key: string;
      let name: string;
      if (t.assignee?.trim()) {
        const d = developers.find((d) => d.id === t.assignee);
        key = d ? d.id : t.assignee;
        name = d ? d.name : (t.assigneeName || t.assignee);
      } else if (t.assigneeName?.trim()) {
        const d = developers.find((d) => d.name === t.assigneeName);
        key = d ? d.id : t.assigneeName;
        name = d ? d.name : t.assigneeName;
      } else {
        key = '__unassigned__';
        name = TASK_GROUP_KEY_UNASSIGNED;
      }
      if (!keyToLane.has(key)) {
        keyToLane.set(key, {
          assigneeName: name,
          developer: developers.find((d) => d.id === key || d.name === key) || null,
          tasks: [],
        });
      }
      keyToLane.get(key)!.tasks.push(t);
    }
    const ordered: Array<{ assigneeKey: string; assigneeName: string; developer: Developer | null; tasks: Task[] }> = [];
    for (const d of developers) {
      const lane = keyToLane.get(d.id);
      if (lane) {
        ordered.push({ assigneeKey: d.id, ...lane });
        keyToLane.delete(d.id);
      }
    }
    const unassigned = keyToLane.get('__unassigned__');
    if (unassigned) {
      ordered.push({ assigneeKey: '__unassigned__', ...unassigned });
      keyToLane.delete('__unassigned__');
    }
    keyToLane.forEach((lane, key) => {
      ordered.push({
        assigneeKey: key,
        assigneeName: lane.assigneeName,
        developer: lane.developer,
        tasks: lane.tasks,
      });
    });
    return ordered;
  }, [groupByAssignee, board?.columns?.length, tasksForKanban, developers]);

  const parentLanes = useMemo(() => {
    if (!groupByParent || !board?.columns?.length) return [];
    const keyToLane = new Map<string, { laneName: string; parentKey?: string; parentDisplay?: string; tasks: Task[] }>();
    for (const t of tasksForKanban) {
      const parent = t.parent;
      const key = (parent?.id || parent?.key || '').trim() || '__no_parent__';
      const name =
        (parent?.display || parent?.key || TASK_GROUP_KEY_NO_PARENT).trim() || TASK_GROUP_KEY_NO_PARENT;
      const parentKey = parent?.key?.trim() || undefined;
      const parentDisplay = (parent?.display || parent?.key || '').trim() || undefined;
      if (!keyToLane.has(key)) {
        keyToLane.set(key, { laneName: name, parentKey, parentDisplay, tasks: [] });
      }
      keyToLane.get(key)!.tasks.push(t);
    }
    const ordered: Array<{ laneKey: string; laneName: string; parentKey?: string; parentDisplay?: string; tasks: Task[] }> = [];
    const noParent = keyToLane.get('__no_parent__');
    keyToLane.forEach((lane, key) => {
      if (key !== '__no_parent__') {
        ordered.push({ laneKey: key, laneName: lane.laneName, parentKey: lane.parentKey, parentDisplay: lane.parentDisplay, tasks: lane.tasks });
      }
    });
    if (noParent) {
      ordered.push({ laneKey: '__no_parent__', laneName: noParent.laneName, tasks: noParent.tasks });
    }
    return ordered;
  }, [groupByParent, board?.columns?.length, tasksForKanban]);

  const assigneeLanesWithColumns = useMemo(() => {
    if (!board?.columns?.length || assigneeLanes.length === 0) return [];
    return assigneeLanes.map((lane) => {
      const grouped = groupTasksByColumns(
        lane.tasks,
        board!.columns!,
        t('sprintPlanner.kanban.unknownStatus')
      );
      const ordered: Array<{ column: BoardColumn; tasks: Task[] }> = [];
      board!.columns!.forEach((col) => {
        const entry = grouped.get(col.id);
        if (entry) ordered.push(entry);
      });
      const unknown = grouped.get(UNKNOWN_STATUS_COLUMN_ID);
      if (unknown && unknown.tasks.length > 0) ordered.push(unknown);
      const columnsWithHeaderDataForLane = buildKanbanColumnsWithHeaderData(ordered, globalNameFilter);
      return { ...lane, columnsWithHeaderData: columnsWithHeaderDataForLane };
    });
  }, [assigneeLanes, board, globalNameFilter, t]);

  const parentLanesWithColumns = useMemo(() => {
    if (!board?.columns?.length || parentLanes.length === 0) return [];
    return parentLanes.map((lane) => {
      const grouped = groupTasksByColumns(
        lane.tasks,
        board!.columns!,
        t('sprintPlanner.kanban.unknownStatus')
      );
      const ordered: Array<{ column: BoardColumn; tasks: Task[] }> = [];
      board!.columns!.forEach((col) => {
        const entry = grouped.get(col.id);
        if (entry) ordered.push(entry);
      });
      const unknown = grouped.get(UNKNOWN_STATUS_COLUMN_ID);
      if (unknown && unknown.tasks.length > 0) ordered.push(unknown);
      const columnsWithHeaderDataForLane = buildKanbanColumnsWithHeaderData(ordered, globalNameFilter);
      return { ...lane, columnsWithHeaderData: columnsWithHeaderDataForLane };
    });
  }, [parentLanes, board, globalNameFilter, t]);

  let lanesWithColumns: Array<
    (typeof assigneeLanesWithColumns)[number] | (typeof parentLanesWithColumns)[number]
  > = [];
  if (hasLaneGrouping) {
    lanesWithColumns = groupByAssignee ? assigneeLanesWithColumns : parentLanesWithColumns;
  }

  const sourceColumnId = useMemo(() => {
    if (!activeTaskId) return null;
    const entry = columnsWithTasks.find((e) => e.tasks.some((t) => t.id === activeTaskId));
    return entry?.column.id ?? null;
  }, [activeTaskId, columnsWithTasks]);

  useEffect(() => {
    if (!tasksForKanban.length) return;
    const toFetch = tasksForKanban
      .map((t) => t.id)
      .filter((id) => !preloadStartedForRef.current.has(id));
    if (toFetch.length === 0) return;
    toFetch.forEach((id) => preloadStartedForRef.current.add(id));

    getIssueTransitionsBatch(toFetch).then((result) => {
      setTransitionsByTaskId((prev) => {
        const next = new Map(prev);
        for (const [taskId, list] of Object.entries(result)) {
          next.set(taskId, list ?? []);
        }
        return next;
      });
    });
  }, [tasksForKanban]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const taskId = parseKanbanTaskId(String(event.active.id));
    if (!taskId) return;
    setActiveTaskId(taskId);
    const cached = transitionsByTaskId.get(taskId);
    if (cached !== undefined) {
      setTransitionsForActive(cached);
      return;
    }
    getIssueTransitions(taskId).then((list) => {
      setTransitionsForActive(Array.isArray(list) ? list : []);
      setTransitionsByTaskId((prev) => {
        const next = new Map(prev);
        next.set(taskId, Array.isArray(list) ? list : []);
        return next;
      });
    }).catch(() => setTransitionsForActive([]));
  }, [transitionsByTaskId]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const taskId = parseKanbanTaskId(String(event.active.id));
    const overId = event.over?.id;
    const columnId = overId ? getColumnIdFromDroppable(String(overId)) : null;

    if (taskId && columnId && onStatusChange) {
      const task = tasksForKanban.find((t) => t.id === taskId);
      const columnEntry = columnsWithTasks.find((e) => e.column.id === columnId);
      const column = columnEntry?.column;
      const taskStatusNorm = normalizeStatusKeyForComparison(task?.originalStatus || '');
      let columnKeysNorm = new Set<string>();
      if (column?.statusKeys?.length) {
        columnKeysNorm = new Set(column.statusKeys.map((k) => normalizeStatusKeyForComparison(k)));
      } else if (column) {
        columnKeysNorm = new Set(
          [
            normalizeStatusKeyForComparison(getColumnStatusKey(column) || ''),
            normalizeStatusKeyForComparison(column.id),
          ].filter(Boolean)
        );
      }
      const isSameColumn = task && taskStatusNorm && columnKeysNorm.has(taskStatusNorm);
      if (column && column.id !== UNKNOWN_STATUS_COLUMN_ID && !isSameColumn && columnKeysNorm.size > 0) {
        const transition = transitionsForActive.find((t) => {
          const toKeyNorm = normalizeStatusKeyForComparison(t.to?.key || '');
          return toKeyNorm && columnKeysNorm.has(toKeyNorm);
        });
        if (transition) {
          const targetStatusKey = transition.to?.key ?? getColumnStatusKey(column);
          const targetDisplay = column.display ?? (transition.to as { display?: string })?.display;
          const screenId = (transition as { screen?: { id: string } }).screen?.id;
          onStatusChange(taskId, transition.id, targetStatusKey ?? undefined, targetDisplay, screenId);
          setTransitionsByTaskId((prev) => {
            const next = new Map(prev);
            next.delete(taskId);
            return next;
          });
        }
      }
    }

    setActiveTaskId(null);
    setTransitionsForActive([]);
  }, [columnsWithTasks, onStatusChange, tasksForKanban, transitionsForActive]);

  const canDropInColumn = useCallback(
    (column: BoardColumn) => {
      if (column.id === UNKNOWN_STATUS_COLUMN_ID) return false;
      const columnKeysNorm = column.statusKeys?.length
        ? new Set(column.statusKeys.map((k) => normalizeStatusKeyForComparison(k)))
        : new Set([
            normalizeStatusKeyForComparison(getColumnStatusKey(column) || ''),
            normalizeStatusKeyForComparison(column.id),
          ].filter(Boolean));
      if (!columnKeysNorm.size) return false;
      return transitionsForActive.some((t) => {
        const toKeyNorm = normalizeStatusKeyForComparison(t.to?.key || '');
        return toKeyNorm && columnKeysNorm.has(toKeyNorm);
      });
    },
    [transitionsForActive]
  );

  const columnsContainerRef = useRef<HTMLDivElement>(null);

  /** Минимальная ширина контента колонок + pl-4 + pr-4, чтобы правый отступ был внутри прокрутки */
  const columnsMinWidth = useMemo(() => {
    const n = columnsWithHeaderData.length;
    if (n === 0) return undefined;
    const COLUMN_WIDTH = 280;
    const GAP = 16;
    const PADDING_X = 32; // pl-4 + pr-4
    return n * COLUMN_WIDTH + (n - 1) * GAP + PADDING_X;
  }, [columnsWithHeaderData.length]);

  if (boardId === null || boardId <= 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        {t('sprintPlanner.kanban.selectBoard')}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-500 dark:text-gray-400 text-sm">
        {t('sprintPlanner.kanban.loadingColumns')}
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex flex-1 items-center justify-center text-red-600 dark:text-red-400 text-sm">
        {t('sprintPlanner.kanban.boardLoadError')}
      </div>
    );
  }

  const activeTask = activeTaskId ? tasksForKanban.find((t) => t.id === activeTaskId) : null;

  const displayColumns = hasLaneGrouping && lanesWithColumns.length > 0
    ? lanesWithColumns[0].columnsWithHeaderData
    : columnsWithHeaderData;
  /** В шапке при группировке показываем счётчики по всему списку задач (как без группировки) */
  const headerColumns = hasLaneGrouping ? columnsWithHeaderData : displayColumns;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <DndContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-auto bg-gray-50 dark:bg-gray-900 scrollbar-thin-custom"
          style={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            overscrollBehavior: 'auto',
          }}
        >
        {/* min-w-full + w-max: иначе scrollWidth по ширине колонок не растёт (flex-col + stretch). */}
        <div
          className="flex w-max min-w-full flex-col"
          style={columnsMinWidth !== undefined ? { minWidth: columnsMinWidth } : undefined}
        >
        {/* Шапки колонок — липкие */}
        <div className="sticky top-0 z-10 flex gap-4 shrink-0 bg-white dark:bg-gray-900 pl-4 pr-4 pt-2 border-transparent dark:border-gray-700">
          {headerColumns.map(({ column, filteredTasks, totalSp, totalTp }) => (
            <div
              key={column.id}
              className={`min-w-[280px] w-[280px] max-w-[280px] shrink-0 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 pt-2 pb-2 ${hasLaneGrouping ? 'rounded-lg' : 'rounded-t-lg'}`}
              data-kanban-header={column.id}
            >
              <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate" title={column.display}>
                {column.display}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {filteredTasks.length === 1
                  ? t('sprintPlanner.kanban.taskCountOne', { count: filteredTasks.length })
                  : t('sprintPlanner.kanban.taskCountMany', { count: filteredTasks.length })}
                {(totalSp > 0 || totalTp > 0) && (
                  <>
                    {' · '}
                    {totalSp > 0 && <span>{totalSp} sp</span>}
                    {totalSp > 0 && totalTp > 0 && ' · '}
                    {totalTp > 0 && <span>{totalTp} tp</span>}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>
        {hasLaneGrouping && lanesWithColumns.length > 0 ? (
          <div
            ref={columnsContainerRef}
            className="flex flex-col flex-none min-h-full pl-4 pr-4 pb-4"
          >
            {lanesWithColumns.map((lane) => {
              const laneKey = 'assigneeKey' in lane ? lane.assigneeKey : lane.laneKey;
              const laneName = 'assigneeName' in lane ? lane.assigneeName : lane.laneName;
              const resolvedLaneName =
                groupByAssignee && 'assigneeKey' in lane && lane.assigneeKey === '__unassigned__'
                  ? t('task.grouping.unassigned')
                  : groupByParent && 'laneKey' in lane && lane.laneKey === '__no_parent__'
                    ? t('task.grouping.noParent')
                    : laneName === TASK_GROUP_KEY_UNASSIGNED
                      ? t('task.grouping.unassigned')
                      : laneName === TASK_GROUP_KEY_NO_PARENT
                        ? t('task.grouping.noParent')
                        : laneName;
              const showAvatar = groupByAssignee && 'assigneeKey' in lane && lane.assigneeKey !== '__unassigned__' && !!lane.developer;
              const totalSp = lane.tasks.reduce((s, t) => s + getTaskStoryPoints(t), 0);
              const totalTp = lane.tasks.reduce((s, t) => s + getTaskTestPoints(t), 0);
              const filteredCount = globalNameFilter
                ? lane.tasks.filter((t) => kanbanTaskMatchesNameFilter(t, globalNameFilter)).length
                : lane.tasks.length;
              const isLaneCollapsed = collapsedLanes.has(laneKey);
              return (
                <div key={laneKey} className="flex flex-col gap-0 flex-none">
                  <div
                    aria-expanded={!isLaneCollapsed}
                    aria-label={
                      isLaneCollapsed
                        ? t('sprintPlanner.kanban.expandGroup')
                        : t('sprintPlanner.kanban.collapseGroup')
                    }
                    className="sticky top-14 z-[5] flex items-center gap-2 py-4 px-1 bg-gray-50 dark:bg-gray-900 min-w-0 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors select-none"
                    role="button"
                    style={columnsMinWidth !== undefined ? { minWidth: columnsMinWidth } : undefined}
                    tabIndex={0}
                    onClick={() => toggleLaneCollapsed(laneKey)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleLaneCollapsed(laneKey);
                      }
                    }}
                  >
                    <Icon
                      className="w-4 h-4 shrink-0 text-gray-600 dark:text-gray-400"
                      name={isLaneCollapsed ? 'chevron-right' : 'chevron-down'}
                    />
                    {showAvatar && 'developer' in lane && lane.developer && (
                      <Avatar
                        avatarUrl={lane.developer?.avatarUrl}
                        className="h-6 w-6 shrink-0 rounded-full"
                        initials={resolvedLaneName.slice(0, 2).toUpperCase() || '?'}
                      />
                    )}
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate min-w-0 flex items-center gap-1">
                      {groupByParent && 'parentKey' in lane && lane.parentKey ? (
                        <>
                          <a
                            className="text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                            href={`https://tracker.yandex.ru/${lane.parentKey}`}
                            rel="noopener noreferrer"
                            target="_blank"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {lane.parentKey}
                          </a>
                          <span className="shrink min-w-0 truncate">
                            {' '}
                            - {lane.parentDisplay ?? resolvedLaneName}
                          </span>
                        </>
                      ) : (
                        resolvedLaneName
                      )}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0 tabular-nums">
                      {filteredCount} · {totalSp} sp{totalTp > 0 ? ` · ${totalTp} tp` : ''}
                    </span>
                  </div>
                  {!isLaneCollapsed && (
                  <div className="flex gap-4 items-stretch min-h-[120px] flex-none pr-4">
                    {lane.columnsWithHeaderData.map(({ column, tasks: columnTasks }) => (
                      <KanbanColumn
                        key={`${laneKey}-${column.id}`}
                        columnId={`${laneKey}__${column.id}`}
                        contextMenuBlurOtherCards={contextMenuBlurOtherCards}
                        contextMenuTaskId={contextMenuTaskId}
                        developers={developers}
                        globalNameFilter={globalNameFilter}
                        groupByAssignee={hasLaneGrouping}
                        isDragging={!!activeTaskId}
                        isDropDisabled={!!activeTaskId && !canDropInColumn(column)}
                        isSourceColumn={column.id === sourceColumnId}
                        tasks={columnTasks}
                        onContextMenu={onContextMenu}
                        onTaskClick={onTaskClick}
                      />
                    ))}
                  </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div
            ref={columnsContainerRef}
            className="flex gap-4 items-stretch min-h-full flex-none pl-4 pr-4 pb-4 bg-white dark:bg-gray-900"
          >
            {columnsWithHeaderData.map(({ column, tasks: columnTasks }) => (
              <KanbanColumn
                key={column.id}
                columnId={column.id}
                contextMenuBlurOtherCards={contextMenuBlurOtherCards}
                contextMenuTaskId={contextMenuTaskId}
                developers={developers}
                globalNameFilter={globalNameFilter}
                isDragging={!!activeTaskId}
                isDropDisabled={!!activeTaskId && !canDropInColumn(column)}
                isSourceColumn={column.id === sourceColumnId}
                tasks={columnTasks}
                onContextMenu={onContextMenu}
                onTaskClick={onTaskClick}
              />
            ))}
          </div>
        )}
        </div>
        </div>
        <DragOverlay>
          {activeTask ? (
            <div className="w-[264px] cursor-grabbing rounded-lg overflow-hidden opacity-95 rotate-2 shadow-xl">
              <TaskCard
                assigneeName={activeTask.assigneeName}
                developers={developers}
                task={activeTask}
                variant="sidebar"
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
});
