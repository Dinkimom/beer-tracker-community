/**
 * Компонент сетки времени в свимлейне
 */

import type { Task, Comment } from '@/types';
import type { MouseEvent } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS, WORKING_DAYS_PER_WEEK } from '@/constants';
import { DroppableCell } from '@/features/swimlane/components/DroppableCell';
import { getPartStatus } from '@/utils/dateUtils';

function createCommentCellDoubleClickHandler(
  onCommentCreate: (comment: Omit<Comment, 'id'>) => void,
  developerId: string,
  dayIndex: number,
  partIndex: number
) {
  return (e: MouseEvent) => {
    const swimlaneRect = (e.target as HTMLElement).closest('[data-swimlane]')?.getBoundingClientRect();
    if (!swimlaneRect) return;
    const x = e.clientX - swimlaneRect.left - 20;
    const y = e.clientY - swimlaneRect.top - 20;
    onCommentCreate({
      text: 'Заметка',
      assigneeId: developerId,
      day: dayIndex,
      part: partIndex,
      x: Math.max(0, x),
      y: Math.max(0, y),
      width: 200,
      height: 80,
    });
  };
}

interface TimelineGridProps {
  activeTask: Task | null;
  activeTaskDuration: number | null;
  developerId: string;
  /** Индексы дней (0..9), которые являются нерабочими/праздничными */
  holidayDayIndices?: Set<number>;
  hoveredCell: { assigneeId: string; day: number; part: number } | null;
  isDraggingTask: boolean;
  sprintStartDate: Date;
  /** Рабочих дней в таймлайне */
  sprintTimelineWorkingDays?: number;
  totalHeight: number;
  onCommentCreate?: (comment: Omit<Comment, 'id'>) => void;
}

export function TimelineGrid({
  activeTask,
  activeTaskDuration,
  developerId,
  hoveredCell,
  isDraggingTask,
  sprintStartDate,
  sprintTimelineWorkingDays = WORKING_DAYS,
  totalHeight,
  onCommentCreate,
  holidayDayIndices,
}: TimelineGridProps) {
  const dayCount = Math.max(1, sprintTimelineWorkingDays);
  const weekChunks: number[][] = [];
  for (let i = 0; i < dayCount; i += WORKING_DAYS_PER_WEEK) {
    const len = Math.min(WORKING_DAYS_PER_WEEK, dayCount - i);
    weekChunks.push(Array.from({ length: len }, (_, j) => i + j));
  }

  return (
    <>
      {weekChunks.map((indices, weekIdx) => (
        <div
          key={weekIdx}
          className="flex h-full border-r border-gray-100 dark:border-gray-700 last:border-r-0 bg-white dark:bg-gray-800"
          style={{ width: `${(indices.length / dayCount) * 100}%` }}
        >
          {indices.map((dayIndex, idxInWeek) => {
            const isLastInWeek = idxInWeek === indices.length - 1;
            return (
              <div
                key={dayIndex}
                className={`flex flex-1 h-full ${
                  isLastInWeek ? '' : 'border-r border-gray-200 dark:border-gray-600'
                } ${
                  holidayDayIndices?.has(dayIndex)
                    ? 'bg-gray-100 dark:bg-gray-900/40'
                    : 'bg-white dark:bg-gray-800'
                }`}
              >
                {Array.from({ length: PARTS_PER_DAY }, (_, partIndex) => {
                  const cellId = `cell-${developerId}-${dayIndex}-${partIndex}`;
                  const hoverStart =
                    isDraggingTask && hoveredCell && activeTaskDuration != null
                      ? hoveredCell.day * PARTS_PER_DAY + hoveredCell.part
                      : null;
                  const hoverEnd =
                    hoverStart != null && activeTaskDuration != null
                      ? hoverStart + activeTaskDuration
                      : null;
                  const cellStart = dayIndex * PARTS_PER_DAY + partIndex;
                  const isHighlighted =
                    hoverEnd != null && hoverStart != null && cellStart >= hoverStart && cellStart < hoverEnd;
                  const partStatus = getPartStatus(dayIndex, partIndex, sprintStartDate, dayCount);
                  return (
                    <DroppableCell
                      key={cellId}
                      activeTask={activeTask}
                      id={cellId}
                      isHighlighted={isHighlighted}
                      isHoliday={holidayDayIndices?.has(dayIndex)}
                      partIndex={partIndex}
                      partStatus={partStatus}
                      totalHeight={totalHeight}
                      onDoubleClick={
                        onCommentCreate
                          ? createCommentCellDoubleClickHandler(
                              onCommentCreate,
                              developerId,
                              dayIndex,
                              partIndex
                            )
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      ))}
    </>
  );
}

