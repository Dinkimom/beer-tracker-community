'use client';

import type { TaskResizeParams } from '@/features/task/hooks/useTaskResize';
import type { Task, Developer, TaskPosition } from '@/types';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import omit from 'lodash-es/omit';
import React, { useEffect, useRef, useState } from 'react';

import { Icon } from '@/components/Icon';
import { TextTooltip } from '@/components/TextTooltip';
import { CARD_MARGIN, WORKING_DAYS, PARTS_PER_DAY, ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';
import { SWIMLANE_TASK_DRAG_DATA_KIND } from '@/features/swimlane/utils/swimlaneDragIds';
import { useTaskBarResize } from '@/features/task/hooks/useTaskBarResize';
import { isEffectivelyQaTask } from '@/features/task/utils/taskUtils';
import { getPreviewBorderColor, resolvePaletteStatusKey } from '@/utils/statusColors';

import { TaskCard } from '../TaskCard/TaskCard';

import { TaskBarQACreateButton } from './components/TaskBarQACreateButton';
import { TaskBarResizeHandle } from './components/TaskBarResizeHandle';

function TaskBarDragSourceGhost(props: {
  enabled: boolean;
  transform: { x: number; y: number } | null;
}) {
  const { enabled, transform } = props;
  if (!enabled || !transform) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-0 z-0 rounded-xl border-2 border-dashed border-gray-400/70 dark:border-white/30 pointer-events-none"
      style={{
        transform: `translate3d(${-Math.round(transform.x)}px, ${-Math.round(transform.y)}px, 0)`,
        opacity: 0.9,
      }}
    />
  );
}

interface TaskBarProps {
  assigneeName?: string;
  /** Понизить непрозрачность остальных карточек, когда меню открыто с якоря на карточке */
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  developers?: Developer[];
  disableResize?: boolean;
  /** id для dnd-kit (при нескольких карточках одной задачи — уникальный на отрезок). */
  draggableId?: string;
  duration: number;
  /** Текст тултипа при ошибке (в чём именно ошибка) */
  errorTooltip?: string;
  globalNameFilter?: string;
  /** Якорь для react-xarrows: только у первого отрезка `task-${id}`, у остальных — с суффиксом. */
  htmlAnchorId?: string;
  /** Редактирование отрезков на свимлейне: без drag/resize/меню, клики обрабатывает оверлей */
  interactionDisabled?: boolean;
  /** Фаза занятости участвует в ошибке планирования — подсветка и иконка */
  isInError?: boolean;
  isSelected?: boolean;
  leftPercent: number;
  qaTasksMap?: Map<string, Task>;
  selectedSprintId?: number | null;
  selectedTaskId?: string | null;
  style?: React.CSSProperties;
  /** Длина этой полоски в частях дня (отрезок) — для расчётов внутри TaskCard на свимлейне. */
  swimlaneBarDurationParts?: number;
  /**
   * Состояние drag из MobX (свимлейн). Если задано, визуал «перетаскивается» только когда
   * и dnd-kit, и стор в режиме drag — иначе после drop dnd-kit иногда оставляет isDragging.
   */
  swimlaneDragActive?: boolean;
  /** Второй и следующие отрезки: без точек связи, кнопки QA и дубля иконки ошибки. */
  swimlaneSegmentSecondary?: boolean;
  /** Длина таймлайна в ячейках (для ресайза и превью на свимлейне) */
  swimlaneTimelineTotalParts?: number;
  task: Task;
  taskPositions?: Map<string, TaskPosition>; // ID текущего спринта для валидации
  widthPercent: number;
  onClick?: (taskId: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  onCreateQATask?: (taskId: string, anchorRect?: DOMRect) => void;
  onResize: (params: TaskResizeParams) => void;
  onTaskHover?: (taskId: string | null) => void;
  /** Перерисовка связей react-xarrows (один общий колбэк из SwimlanesSection) */
  requestArrowRedraw: () => void;
}

export function TaskBar({
  task,
  leftPercent,
  widthPercent,
  duration,
  errorTooltip,
  globalNameFilter,
  isInError = false,
  isSelected = false,
  interactionDisabled = false,
  disableResize = false,
  draggableId = task.id,
  htmlAnchorId = `task-${task.id}`,
  swimlaneSegmentSecondary = false,
  onResize,
  onClick,
  onCreateQATask,
  developers = [],
  assigneeName,
  taskPositions,
  qaTasksMap,
  requestArrowRedraw,
  style: customStyle,
  onTaskHover,
  onContextMenu,
  contextMenuBlurOtherCards = false,
  contextMenuTaskId = null,
  selectedSprintId,
  selectedTaskId: _selectedTaskId = null,
  swimlaneBarDurationParts,
  swimlaneDragActive,
  swimlaneTimelineTotalParts = WORKING_DAYS * PARTS_PER_DAY,
}: TaskBarProps) {
  const { t } = useI18n();
  const [clickStartPos, setClickStartPos] = useState<{ x: number; y: number } | null>(null);
  const [isExpandedByLongHover, setIsExpandedByLongHover] = useState(false);
  const longHoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resize = useTaskBarResize({
    duration,
    onResize,
    timelineTotalCells: swimlaneTimelineTotalParts,
  });
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: draggableId,
    disabled: interactionDisabled,
    data: { kind: SWIMLANE_TASK_DRAG_DATA_KIND },
  });

  const effectiveIsDragging =
    swimlaneDragActive === undefined ? isDragging : isDragging && swimlaneDragActive;

  /** Ширина полосы: из пропа (по длине отрезка на свимлейне), при ресайзе — из превью хука. */
  const displayWidthPercent =
    resize.isResizing && resize.resizePreviewDuration !== null
      ? (resize.resizePreviewDuration / swimlaneTimelineTotalParts) * 100
      : widthPercent;
  const displayLeftPercent = resize.isResizing && resize.resizePreviewStartCell !== null
    ? (resize.resizePreviewStartCell / swimlaneTimelineTotalParts) * 100
    : leftPercent;
  const longHoverExpandMaxDurationPartsInclusive = 5;
  const isNarrowForLongHoverExpand =
    (swimlaneBarDurationParts ?? duration) <= longHoverExpandMaxDurationPartsInclusive;
  const shouldExpandByLongHover =
    isExpandedByLongHover &&
    isNarrowForLongHoverExpand &&
    !effectiveIsDragging &&
    !resize.isResizing;
  const expandedMinDurationParts = 4;
  const expandedMinWidthPercent =
    (expandedMinDurationParts / swimlaneTimelineTotalParts) * 100;
  const expandedWidthPercent = Math.max(displayWidthPercent, expandedMinWidthPercent);
  const baseWidthCss = `calc(${displayWidthPercent}% - ${CARD_MARGIN * 2}px)`;
  const expandedWidthCss = `calc(${expandedWidthPercent}% - ${CARD_MARGIN * 2}px)`;

  const customStyleLayout = omit(customStyle ?? {}, ['opacity', 'transition']);
  const layoutStyle = {
    left: `calc(${displayLeftPercent}% + ${CARD_MARGIN}px)`,
    width: shouldExpandByLongHover ? expandedWidthCss : baseWidthCss,
    transform: CSS.Translate.toString(transform),
    transition: 'width 0.2s ease',
    ...customStyleLayout,
  };

  useEffect(() => {
    if (!effectiveIsDragging) {
      const timeoutId = setTimeout(() => {
        requestArrowRedraw();
      }, 0);
      return () => clearTimeout(timeoutId);
    }
  }, [leftPercent, widthPercent, effectiveIsDragging, requestArrowRedraw]);

  useEffect(() => {
    if (!effectiveIsDragging) return;
    if (longHoverTimeoutRef.current) {
      clearTimeout(longHoverTimeoutRef.current);
      longHoverTimeoutRef.current = null;
    }
    setIsExpandedByLongHover(false);
  }, [effectiveIsDragging]);

  useEffect(() => {
    return () => {
      if (longHoverTimeoutRef.current) {
        clearTimeout(longHoverTimeoutRef.current);
        longHoverTimeoutRef.current = null;
      }
    };
  }, []);

  const isQATask = isEffectivelyQaTask(task);

  let hasQATaskInSwimlane = false;
  if (taskPositions && qaTasksMap && !isQATask) {
    const qaTask = qaTasksMap.get(task.id);
    hasQATaskInSwimlane = qaTask ? taskPositions.has(qaTask.id) : false;
  }

  const previewBorder = getPreviewBorderColor(
    resolvePaletteStatusKey(task.originalStatus, task.statusColorKey),
    isQATask
  );

  // Проверяем, соответствует ли задача поисковому фильтру (по названию или ключу)
  const matchesFilter = globalNameFilter
    ? task.name.toLowerCase().includes(globalNameFilter.trim().toLowerCase()) ||
      task.id.toLowerCase().includes(globalNameFilter.trim().toLowerCase())
    : true;

  // При перетаскивании карточка остаётся такой же (без скрытия); по фильтру — 0.3 или 1
  const taskOpacity = !matchesFilter ? 0.3 : 1;
  // opacity из customStyle (например затемнение несвязанных карточек при hover) × локальная opacity (фильтр)
  const opacityFromParent = typeof customStyle?.opacity === 'number' ? customStyle.opacity : 1;
  const dimmedByContextMenuElsewhere =
    contextMenuBlurOtherCards &&
    contextMenuTaskId != null &&
    contextMenuTaskId !== task.id;
  // Как при hover по связям: затемняем весь слой (карточка + иконка ошибки + точки связи), иначе иконка остаётся на 100%.
  const effectiveOpacity = opacityFromParent * taskOpacity * (dimmedByContextMenuElsewhere ? 0.5 : 1);

  let taskBarZIndex: number = ZIndex.stickyInContent;
  if (effectiveIsDragging) {
    taskBarZIndex = ZIndex.dragPreview;
  } else if (shouldExpandByLongHover) {
    // Keep expanded card below sticky assignee column.
    taskBarZIndex = ZIndex.arrowsHovered;
  } else if (isInError) {
    taskBarZIndex = ZIndex.stickyElevated;
  }

  return (
    <div
      className={`task-bar-item absolute top-1.5 bottom-1.5 ${
        shouldExpandByLongHover ? 'task-bar-expanded' : ''
      } ${
        interactionDisabled || effectiveIsDragging ? 'pointer-events-none' : 'pointer-events-auto'
      }`}
      data-draggable-id={draggableId}
      data-task-id={task.id}
      id={htmlAnchorId}
      style={{
        ...layoutStyle,
        zIndex: taskBarZIndex,
      }}
    >
      <div
        className="task-bar-opacity-layer relative w-full h-full min-w-0 min-h-0"
        style={{
          opacity: effectiveOpacity,
          transition: 'opacity 0.2s ease',
        }}
      >
        <TaskBarDragSourceGhost enabled={effectiveIsDragging} transform={transform} />
        <TaskCard
            ref={setNodeRef}
            assigneeName={assigneeName}
            className={`${interactionDisabled ? 'pointer-events-none ' : ''}relative z-[1]`}
            developers={developers}
            dimmedByContextMenu={dimmedByContextMenuElsewhere}
            isContextMenuOpen={contextMenuTaskId === task.id}
            isDragging={effectiveIsDragging}
            isQATask={isQATask}
            isResizing={resize.isResizing}
            isSelected={isSelected}
            previewBorder={previewBorder}
            resizePreviewDuration={resize.resizePreviewDuration}
            swimlaneBarDurationParts={swimlaneBarDurationParts}
            task={task}
            taskPosition={taskPositions?.get(task.id)}
            variant="swimlane"
            widthPercent={displayWidthPercent}
            {...(!resize.isResizing && !interactionDisabled ? { ...listeners, ...attributes } : {})}
            selectedSprintId={selectedSprintId}
            onContextMenu={
              interactionDisabled
                ? (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }
                : onContextMenu
            }
            onMouseDown={(e) => {
              if (!resize.isResizing) {
                setClickStartPos({ x: e.clientX, y: e.clientY });
              }
            }}
            onMouseEnter={() => {
              if (
                isNarrowForLongHoverExpand &&
                !effectiveIsDragging &&
                !resize.isResizing
              ) {
                if (longHoverTimeoutRef.current) {
                  clearTimeout(longHoverTimeoutRef.current);
                }
                longHoverTimeoutRef.current = setTimeout(() => {
                  setIsExpandedByLongHover(true);
                }, 1000);
              }
              if (!effectiveIsDragging && !resize.isResizing && onTaskHover) {
                onTaskHover(task.id);
              }
            }}
            onMouseLeave={() => {
              if (longHoverTimeoutRef.current) {
                clearTimeout(longHoverTimeoutRef.current);
                longHoverTimeoutRef.current = null;
              }
              setIsExpandedByLongHover(false);
              if (!effectiveIsDragging && !resize.isResizing && onTaskHover) {
                onTaskHover(null);
              }
            }}
            onMouseUp={(e) => {
              if (!clickStartPos || effectiveIsDragging || resize.isResizing) {
                setClickStartPos(null);
                return;
              }

              const deltaX = Math.abs(e.clientX - clickStartPos.x);
              const deltaY = Math.abs(e.clientY - clickStartPos.y);
              if (deltaX >= 5 || deltaY >= 5) {
                setClickStartPos(null);
                return;
              }

              const target = e.target as HTMLElement;
              if (!target.closest('a')) {
                onClick?.(task.id);
              }
              setClickStartPos(null);
            }}
        />

        {!swimlaneSegmentSecondary && (
          <TaskBarQACreateButton
            hasQATaskInSwimlane={hasQATaskInSwimlane}
            isDragging={effectiveIsDragging}
            isInError={isInError}
            isQATask={isQATask}
            isSelected={isSelected}
            task={task}
            onCreateQATask={onCreateQATask}
          />
        )}

        {!isSelected && !disableResize && !interactionDisabled && (
        <>
          <TaskBarResizeHandle
            isHovering={resize.isHoveringResizeHandle}
            isQATask={isQATask}
            isResizing={resize.isResizing}
            originalStatus={task.originalStatus}
            resizeSide={resize.resizeSide}
            side="right"
            onMouseDown={(e) => resize.handleResizeStart(e, 'right')}
            onMouseEnter={() => resize.setIsHoveringResizeHandle(true)}
            onMouseLeave={() => resize.setIsHoveringResizeHandle(false)}
          />
          <TaskBarResizeHandle
            isHovering={resize.isHoveringLeftResizeHandle}
            isQATask={isQATask}
            isResizing={resize.isResizing}
            originalStatus={task.originalStatus}
            resizeSide={resize.resizeSide}
            side="left"
            onMouseDown={(e) => resize.handleResizeStart(e, 'left')}
            onMouseEnter={() => resize.setIsHoveringLeftResizeHandle(true)}
            onMouseLeave={() => resize.setIsHoveringLeftResizeHandle(false)}
          />
        </>
        )}
        {isInError && !swimlaneSegmentSecondary && (
          <span
            className="absolute right-0"
            style={{
              zIndex: ZIndex.dropdown,
              transform: 'translate(50%, -50%)',
              right: 2,
              top: 6,
            }}
          >
            <TextTooltip content={errorTooltip || t('task.taskBar.planningError')}>
              <span
                className={`inline-flex w-5 h-5 items-center justify-center rounded-full bg-red-500 dark:bg-red-400 text-white shrink-0 border-2 border-white dark:border-gray-800 shadow-sm cursor-default transition-transform duration-150 hover:scale-125 ${
                  interactionDisabled ? 'pointer-events-none' : 'pointer-events-auto'
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" name="exclamation" />
              </span>
            </TextTooltip>
          </span>
        )}
      </div>
    </div>
  );
}

// Оптимизация: мемоизируем TaskBar для предотвращения лишних ререндеров
export const MemoizedTaskBar = React.memo(TaskBar, (prevProps, nextProps) => {
  // Сравниваем только важные пропсы
  return (
    prevProps.task.id === nextProps.task.id &&
    prevProps.task.status === nextProps.task.status &&
    prevProps.task.storyPoints === nextProps.task.storyPoints &&
    prevProps.task.testPoints === nextProps.task.testPoints &&
    prevProps.leftPercent === nextProps.leftPercent &&
    prevProps.widthPercent === nextProps.widthPercent &&
    prevProps.duration === nextProps.duration &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.contextMenuBlurOtherCards === nextProps.contextMenuBlurOtherCards &&
    prevProps.contextMenuTaskId === nextProps.contextMenuTaskId &&
    prevProps.isInError === nextProps.isInError &&
    prevProps.errorTooltip === nextProps.errorTooltip &&
    prevProps.disableResize === nextProps.disableResize &&
    prevProps.interactionDisabled === nextProps.interactionDisabled &&
    prevProps.draggableId === nextProps.draggableId &&
    prevProps.htmlAnchorId === nextProps.htmlAnchorId &&
    prevProps.swimlaneSegmentSecondary === nextProps.swimlaneSegmentSecondary &&
    prevProps.swimlaneBarDurationParts === nextProps.swimlaneBarDurationParts &&
    prevProps.swimlaneDragActive === nextProps.swimlaneDragActive
  );
});

MemoizedTaskBar.displayName = 'MemoizedTaskBar';

