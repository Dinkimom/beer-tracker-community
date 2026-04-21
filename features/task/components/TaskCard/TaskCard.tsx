'use client';

import type { SwimlaneCardFieldsVisibility } from '@/hooks/useLocalStorage';
import type { Task, Developer, TaskCardVariant, TaskPosition } from '@/types';

import React from 'react';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { isEffectivelyQaTask } from '@/features/task/utils/taskUtils';
import { useDocumentDarkClass } from '@/hooks/useDocumentDarkClass';
import { useSwimlaneCardFieldsStorage } from '@/hooks/useLocalStorage';
import {
  getPhaseDividerClasses,
  getQaStripedStyles,
  getStatusColors,
  resolveStatusForPhaseCardColors,
} from '@/utils/statusColors';

import { TaskCardAutoAddToSwimlaneButton } from './components/TaskCardAutoAddToSwimlaneButton';
import { getTaskCardStyles } from './components/TaskCardBody';
import { TaskCardSidebarResizedSplit } from './components/TaskCardSidebarResizedSplit';
import { TaskCardStandardBody } from './components/TaskCardStandardBody';
import {
  computeTaskCardBarMetrics,
  getDimmedByContextMenuClasses,
  getQaRightBgColor,
  getSidebarOpacityGroupClasses,
  getSwimlaneWidthModes,
  getTaskCardBorderClasses,
  getTaskCardCursorClass,
  getTaskCardPaddingClasses,
} from './taskCardLayoutHelpers';

interface TaskCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onContextMenu'> {
  assigneeName?: string;
  // Для preview border при resize (например, 'border-dashed border-blue-400')
  children?: React.ReactNode;
  developers?: Developer[];
  /** Полупрозрачность и отключение кликов — когда открыто меню по другой карточке */
  dimmedByContextMenu?: boolean;
  isContextMenuOpen?: boolean;
  isDragging?: boolean;
  /** Локальная задача (не из трекера) - показывает пунктирную рамку */
  isLocalTask?: boolean;
  isQATask?: boolean;
  isResizing?: boolean;
  isSelected?: boolean;
  // Выделение при открытом контекстном меню
  previewBorder?: string;
  // Обработчик правого клика
  resizePreviewDuration?: number | null;
  selectedSprintId?: number | null;
  /** Бейдж спринта для отображения над карточкой */
  sprintBadge?: { display: string; id: string } | null;
  /** Длина этой полоски на свимлейне в частях дня (отрезок фазы); иначе берётся из taskPosition.duration. */
  swimlaneBarDurationParts?: number;
  task: Task;
  taskPosition?: TaskPosition;
  variant: TaskCardVariant;
  widthPercent?: number; // ID текущего спринта для валидации
  // Для дополнительного контента (например, ConnectionPoints)
  onAutoAddToSwimlane?: (task: Task) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
}

/**
 * Общий компонент для отображения карточки задачи
 * Используется и в сайдбаре, и в swimlane
 */
export const TaskCard = React.forwardRef<HTMLDivElement, TaskCardProps>(({
  task,
  developers = [],
  assigneeName,
  variant,
  widthPercent,
  taskPosition,
  resizePreviewDuration,
  swimlaneBarDurationParts,
  isQATask: explicitIsQATask,
  isDragging = false,
  isResizing = false,
  isSelected = false,
  isContextMenuOpen = false,
  dimmedByContextMenu = false,
  isLocalTask = false,
  sprintBadge,
  previewBorder,
  className = '',
  style,
  onMouseDown,
  onMouseUp,
  onAutoAddToSwimlane,
  onContextMenu,
  children,
  selectedSprintId: _, // Может использоваться в будущем для валидации
  ...restProps
}, ref) => {
  const isSwimlane = variant === 'swimlane';
  const [swimlaneCardFields] = useSwimlaneCardFieldsStorage();
  const phaseCardColorScheme = usePhaseCardColorScheme();
  // Явный проп может только форсировать QA-режим, но не должен выключать
  // интеграционный флаг testingOnlyByIntegrationRules.
  const isQATask = explicitIsQATask === true || isEffectivelyQaTask(task);
  const statusForCardColors = resolveStatusForPhaseCardColors(
    phaseCardColorScheme,
    task.originalStatus,
    task.statusColorKey
  );
  const cardStyles = getTaskCardStyles(task, variant, phaseCardColorScheme);
  const isDark = useDocumentDarkClass();

  const {
    actualDuration,
    estimatedSP,
    estimatedTimeslots,
    extraSP,
    leftPercent,
    rightPercent,
    showExtraSplit,
  } = computeTaskCardBarMetrics(
    task,
    taskPosition,
    swimlaneBarDurationParts,
    resizePreviewDuration,
    isResizing
  );

  // Получаем стили для полосатого паттерна с учетом темы
  const { style: qaStripedStyle } = isQATask
    ? getQaStripedStyles(statusForCardColors, isDark)
    : { style: undefined };

  const { isNarrow, isVeryNarrow } = getSwimlaneWidthModes(isSwimlane, widthPercent);

  const paddingClasses = getTaskCardPaddingClasses(isVeryNarrow, isNarrow, isSwimlane);
  const cursorClass = getTaskCardCursorClass(isDragging, isResizing);
  const borderClasses = getTaskCardBorderClasses(previewBorder, isResizing, isLocalTask);

  // Классы разделителя между частями
  const dividerBgClass = showExtraSplit ? getPhaseDividerClasses(statusForCardColors, isQATask) : '';

  const statusColorsForQa = isQATask ? getStatusColors(statusForCardColors) : null;
  const qaRightBgColor = isQATask ? getQaRightBgColor(statusColorsForQa, isDark) : undefined;

  const sizeVariantClasses = variant === 'swimlane' ? 'h-full min-h-[56px]' : 'min-h-[130px]';
  const hoverShadowClasses =
    !isResizing && !isDragging ? 'hover:shadow-lg transition-shadow duration-200' : '';
  const ringClasses =
    isSelected && !isContextMenuOpen
      ? 'ring-2 ring-blue-600 dark:ring-blue-500 ring-offset-1 dark:ring-offset-gray-800 shadow-lg'
      : '';
  const contextMenuZClasses = isContextMenuOpen ? 'relative z-20' : '';
  const dimmedClasses = dimmedByContextMenu ? getDimmedByContextMenuClasses(isSwimlane) : '';
  const sidebarOpacityClasses = getSidebarOpacityGroupClasses(variant, dimmedByContextMenu);
  const contextMenuBorderClasses = isContextMenuOpen ? ' !border-blue-500 dark:!border-blue-400' : '';

  return (
    <div
      ref={ref}
      className={`${cardStyles.teamColor} ${cardStyles.teamBorder} rounded-lg ${sizeVariantClasses} ${cursorClass} ${hoverShadowClasses} flex flex-col relative ${paddingClasses} overflow-visible ${
        isResizing ? 'select-none' : ''
      } ${ringClasses} ${contextMenuZClasses} ${dimmedClasses} ${sidebarOpacityClasses} ${borderClasses}${contextMenuBorderClasses} ${className}`}
      data-context-menu-source="task-card"
      data-task-id={task.id}
      style={{ ...(showExtraSplit && variant === 'sidebar' ? {} : qaStripedStyle), ...style }}
      onContextMenu={(e) => {
        if (!isDragging && !isResizing && onContextMenu) {
          e.preventDefault();
          e.stopPropagation();
          onContextMenu(e, task);
        }
      }}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      {...restProps}
    >
      {variant === 'sidebar' && onAutoAddToSwimlane && (
        <TaskCardAutoAddToSwimlaneButton
          estimatedSP={estimatedSP}
          task={task}
          onAutoAddToSwimlane={onAutoAddToSwimlane}
        />
      )}
      {showExtraSplit && variant === 'sidebar' ? (
        <TaskCardSidebarResizedSplit
          assigneeName={assigneeName}
          developers={developers}
          dividerBgClass={dividerBgClass}
          estimatedTimeslots={estimatedTimeslots}
          extraSP={extraSP}
          isDark={isDark}
          isDragging={isDragging}
          isLocalTask={isLocalTask}
          isQATask={isQATask}
          leftPercent={leftPercent}
          paddingClasses={paddingClasses}
          phaseCardColorScheme={phaseCardColorScheme}
          qaRightBgColor={qaRightBgColor}
          qaStripedStyle={qaStripedStyle}
          rightPercent={rightPercent}
          showExtraSplit={showExtraSplit}
          showQaStripedLeftOverlay={Boolean(isQATask && cardStyles.qaStripedStyle && qaStripedStyle)}
          sprintBadge={sprintBadge}
          swimlaneCardFields={isSwimlane ? (swimlaneCardFields as SwimlaneCardFieldsVisibility) : undefined}
          task={task}
          taskPosition={taskPosition}
          variant={variant}
        >
          {children}
        </TaskCardSidebarResizedSplit>
      ) : (
        <TaskCardStandardBody
          actualDuration={actualDuration}
          assigneeName={assigneeName}
          developers={developers}
          dividerBgClass={dividerBgClass}
          extraSP={extraSP}
          isDark={isDark}
          isDragging={isDragging}
          isLocalTask={isLocalTask}
          isQATask={isQATask}
          isSwimlane={isSwimlane}
          isVeryNarrow={isVeryNarrow}
          leftPercent={leftPercent}
          phaseCardColorScheme={phaseCardColorScheme}
          qaRightBgColor={qaRightBgColor}
          rightPercent={rightPercent}
          showExtraSplit={showExtraSplit}
          sprintBadge={sprintBadge}
          swimlaneCardFields={isSwimlane ? (swimlaneCardFields as SwimlaneCardFieldsVisibility) : undefined}
          task={task}
          taskPosition={taskPosition}
          variant={variant}
        >
          {children}
        </TaskCardStandardBody>
      )}
    </div>
  );
});

TaskCard.displayName = 'TaskCard';

