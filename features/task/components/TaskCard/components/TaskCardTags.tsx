'use client';

import type { Task, TaskCardVariant, TaskPosition } from '@/types';

import { StatusTag } from '@/components/StatusTag';
import { ZIndex } from '@/constants';
import { formatTaskTestPointsForDisplay } from '@/lib/pointsUtils';

interface TaskCardTagsProps {
  displayDuration?: number; // Длительность в третях дня для адаптации
  task: Task;
  taskPosition?: TaskPosition;
  variant?: TaskCardVariant;
}

/**
 * Компонент для отображения тегов карточки задачи (SP, TP, команда, статус)
 */
export function TaskCardTags({ task, taskPosition: _, variant = 'swimlane', displayDuration }: TaskCardTagsProps) {
  const isSwimlane = variant === 'swimlane';
  const isVeryNarrow = isSwimlane && displayDuration !== undefined && displayDuration < 3;
  const isNarrow = isSwimlane && displayDuration !== undefined && displayDuration < 4;

  const tagTextSize = isVeryNarrow ? 'text-[8px]' : isNarrow ? 'text-[9px]' : 'text-[11px]';
  const containerPadding = isVeryNarrow ? 'left-1 right-1 bottom-1' : 'left-1.5 right-1.5 bottom-1.5';

  const spText = typeof task.storyPoints === 'number' ? `${task.storyPoints}sp` : '?sp';
  const tpText = formatTaskTestPointsForDisplay(task, 'compact');
  const hideTestPoints = task.hideTestPointsByIntegration === true;

  if (variant === 'swimlane') {
    return null;
  }

  // Вариант для сайдбара: SP · TP
  return (
    <div className={`absolute ${containerPadding} flex items-end gap-2 min-w-0 overflow-hidden ${ZIndex.class('stickyElevated')} pointer-events-none`}>
      <StatusTag status={task.originalStatus} statusColorKey={task.statusColorKey} />
      <div className={`flex items-center gap-0 shrink-0 flex-wrap ${tagTextSize} text-gray-600 dark:text-white`}>
        <span>{spText}</span>
        {!hideTestPoints ? (
          <>
            <span className="mx-1">·</span>
            <span>{tpText}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

