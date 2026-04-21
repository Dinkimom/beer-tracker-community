'use client';

import type { Comment, Developer, Task, TaskPosition } from '@/types';

import { useDroppable } from '@dnd-kit/core';

import { Button } from '@/components/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { PARTS_PER_DAY } from '@/constants';
import { isCellOccupiedByTask } from '@/features/sprint/utils/occupancyUtils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { getPartStatus } from '@/utils/dateUtils';

import { OccupancyCommentCard } from '../shared/OccupancyCommentCard';

/** Обёртка ячейки для приёма перетаскиваемых заметок (id формата comment-cell|taskId|day|part|assigneeId) */
function CommentCellDropZone({
  dropId,
  isLastPart,
  children,
}: {
  dropId: string;
  isLastPart: boolean;
  children: React.ReactNode;
}) {
  const { setNodeRef } = useDroppable({ id: dropId });
  return (
    <div
      ref={setNodeRef}
      className={`relative flex-1 min-w-0 flex flex-col border-r border-gray-200/50 dark:border-gray-700/50 ${isLastPart ? 'border-r-0 last:border-r-0' : ''}`}
    >
      {children}
    </div>
  );
}

/** Высота кружка заметки (совпадает с CIRCLE_SIZE в OccupancyCommentCard) */
const COMMENT_CIRCLE_SIZE = 22;
/** top контейнера плановых фаз относительно строки (см. OccupancyTaskRow) */
const PLAN_CONTAINER_TOP = 4;

interface OccupancyTimelineCellsProps {
  assignee?: Developer;
  /** 1 = одна ячейка на день, 3 = три части дня */
  cellsPerDay?: 1 | 3;
  /** Заметки строки (по assignee), отображаются в ячейках по day/part */
  commentsInRow: Comment[];
  /** Показывать заметки и разрешать создание по двойному клику */
  commentsVisible: boolean;
  dayColumnWidth: number | undefined;
  /** Карта разработчиков — для показа автора заметки в тултипе */
  developerMap: Map<string, Developer>;
  /** Индексы дней (0..9), которые являются нерабочими/праздничными */
  holidayDayIndices?: Set<number>;
  openCommentEditId?: string | null;
  /** Высота полосы фазы плана (px) — для позиционирования заметок на уровне фазы */
  phaseBarHeightPx: number;
  /** Отступ полосы фазы от верхнего края план-контейнера (px) */
  phaseBarTopOffsetPx: number;
  position?: TaskPosition;
  qaAssignee?: Developer;
  qaPosition?: TaskPosition;
  qaTask?: Task | null;
  /** ID исполнителя для создания новой заметки в этой строке */
  rowAssigneeIdForComment: string;
  rowHeightMinusBorder: number;
  sprintStartDate: Date;
  task: Task;
  /** Количество рабочих дней в таймлайне (10 для одного спринта, N*10 для мультиспринта) */
  workingDays?: number;
  handleEmptyCellClick: (
    targetTask: Task,
    dayIndex: number,
    partIndex: number,
    cellElement: HTMLElement,
    getAnchorRect?: (cell: HTMLElement) => DOMRect
  ) => void;
  onCommentCreate?: (comment: Comment) => void;
  onCommentDelete?: (id: string) => void;
  onCommentPositionUpdate?: (id: string, x: number, y: number, assigneeId?: string) => void;
  onCommentUpdate?: (id: string, text: string) => void;
  setHoveredCell: (cell: {
    taskId: string;
    dayIndex: number;
    partIndex: number;
  } | null) => void;
}

export function OccupancyTimelineCells({
  assignee,
  commentsInRow,
  commentsVisible = true,
  dayColumnWidth,
  developerMap,
  handleEmptyCellClick,
  phaseBarHeightPx,
  phaseBarTopOffsetPx,
  qaAssignee,
  qaPosition,
  qaTask,
  position,
  rowAssigneeIdForComment,
  rowHeightMinusBorder,
  setHoveredCell,
  sprintStartDate,
  task,
  holidayDayIndices,
  workingDays = 10,
  cellsPerDay = 3,
  openCommentEditId,
  onCommentCreate,
  onCommentDelete,
  onCommentPositionUpdate: _onCommentPositionUpdate,
  onCommentUpdate,
}: OccupancyTimelineCellsProps) {
  const { t } = useI18n();
  const { data: currentUser } = useCurrentUser();
  /** Фиксированный y для заметок — центрируем кружок по полосе фазы плана */
  const commentFixedY = Math.round(
    PLAN_CONTAINER_TOP + phaseBarTopOffsetPx + (phaseBarHeightPx - COMMENT_CIRCLE_SIZE) / 2
  );
  const partsPerDay = cellsPerDay === 1 ? 1 : PARTS_PER_DAY;

  return (
    <div
      className="relative flex w-full items-stretch"
      style={{
        height: rowHeightMinusBorder,
        minHeight: rowHeightMinusBorder,
        boxSizing: 'border-box',
      }}
    >
      {Array.from({ length: workingDays }, (_, dayIndex) => (
        <div
          key={dayIndex}
          className={`flex flex-1 min-w-0 items-stretch border-r border-gray-200 dark:border-gray-600 last:border-r-0 ${
            holidayDayIndices?.has(dayIndex)
              ? 'bg-gray-50 dark:bg-gray-900/40'
              : ''
          }`}
          style={{
            width: dayColumnWidth ?? '10%',
            minWidth: 0,
          }}
        >
          {Array.from({ length: partsPerDay }, (_, partIndex) => {
            const occupiedByDev =
              position && isCellOccupiedByTask(dayIndex, partIndex, position, cellsPerDay);
            const occupiedByQA =
              qaPosition &&
              isCellOccupiedByTask(dayIndex, partIndex, qaPosition, cellsPerDay);
            const occupied = occupiedByDev || occupiedByQA;
            const partStatus = getPartStatus(dayIndex, partIndex, sprintStartDate, workingDays);
            const isEmpty = !occupied;
            const cellIndex = dayIndex * partsPerDay + partIndex;
            const devPhaseEndCell = position
              ? (cellsPerDay === 1
                  ? position.startDay + Math.max(1, Math.ceil(position.duration / PARTS_PER_DAY))
                  : position.startDay * PARTS_PER_DAY + position.startPart + position.duration)
              : 0;
            const targetTask = !position
              ? task
              : qaTask && !qaPosition && cellIndex >= devPhaseEndCell
                ? qaTask
                : null;
            const baseBg =
              partStatus === 'current'
                ? 'bg-blue-100/70 dark:bg-blue-900/30'
                : '';
            const cellColor = baseBg;
            const cellGhostHoverReset =
              partStatus === 'current'
                ? 'hover:!bg-blue-100/70 dark:hover:!bg-blue-900/30'
                : 'hover:!bg-transparent dark:hover:!bg-transparent';
            const commentsInCell = commentsInRow.filter(
              (c) => c.day === dayIndex && c.part === partIndex
            );
            const canCreateComment =
              commentsVisible &&
              !!onCommentCreate &&
              !!rowAssigneeIdForComment &&
              isEmpty;

            const commentDropId = `comment-cell|${task.id}|${dayIndex}|${partIndex}|${rowAssigneeIdForComment}`;
            const isLastPart = partIndex === partsPerDay - 1;

            return (
              <CommentCellDropZone key={partIndex} dropId={commentDropId} isLastPart={isLastPart}>
                <div className="relative flex-1 min-w-0 flex flex-col">
                <Button
                  className={`relative flex-1 min-w-0 items-center justify-center !h-full !min-h-0 !w-full !rounded-none !border-0 !p-0 shadow-none ${cellColor} ${cellGhostHoverReset} ${
                    occupied ? 'cursor-default' : 'cursor-pointer'
                  }`}
                  data-current-cell={
                    isEmpty && partStatus === 'current' ? 'true' : undefined
                  }
                  data-occupancy-timeline-cell
                  title={
                    occupied
                      ? occupiedByDev
                        ? t('sprintPlanner.occupancy.cellTaskWithAssignee', {
                            taskName: task.name,
                            assigneeName: assignee?.name ?? t('task.grouping.unassigned'),
                          })
                        : qaTask
                          ? t('sprintPlanner.occupancy.cellTaskWithAssignee', {
                              taskName: qaTask.name,
                              assigneeName: qaAssignee?.name ?? t('task.grouping.unassigned'),
                            })
                          : ''
                      : canCreateComment
                        ? t('sprintPlanner.occupancy.emptyCellHint')
                        : ''
                  }
                  type="button"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (occupied) return;
                    if (targetTask) {
                      handleEmptyCellClick(
                        targetTask,
                        dayIndex,
                        partIndex,
                        e.currentTarget
                      );
                    }
                  }}
                  onDoubleClick={(e) => {
                    if (!canCreateComment) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const rect = (e.target as HTMLElement).getBoundingClientRect();
                    const x = Math.max(0, e.clientX - rect.left - COMMENT_CIRCLE_SIZE / 2);
                    // assigneeId хранит создателя заметки (не исполнителя задачи)
                    const creatorId = currentUser ? String(currentUser.trackerUid ?? currentUser.uid) : rowAssigneeIdForComment;
                    // eslint-disable-next-line no-restricted-syntax -- IIFE: изоляция scope при создании заметки
                    (() => {
                      const newId = crypto.randomUUID();
                      onCommentCreate({
                        id: newId,
                        clientInstanceId: newId,
                        assigneeId: creatorId,
                        day: dayIndex,
                        part: partIndex,
                        taskId: task.id,
                        x: Math.round(x),
                        y: commentFixedY,
                        width: 200,
                        height: 80,
                        text: t('comments.defaultNote'),
                        createdAt: new Date().toISOString(),
                      });
                    })();
                  }}
                  onMouseEnter={() =>
                    isEmpty &&
                    targetTask &&
                    setHoveredCell({ taskId: task.id, dayIndex, partIndex })
                  }
                  onMouseLeave={() => setHoveredCell(null)}
                >
                  {/* Превью добавления фазы рисуется призрачной фазой в строке (OccupancyTaskRow), не в ячейке */}
                </Button>
                {commentsVisible &&
                  commentsInCell.map((comment) => (
                    <OccupancyCommentCard
                      key={comment.clientInstanceId ?? comment.id}
                      comment={comment}
                      containerHeight={rowHeightMinusBorder}
                      developerMap={developerMap}
                      initialEdit={comment.id === openCommentEditId}
                      offsetX={comment.x ?? 0}
                      offsetY={commentFixedY}
                      onDelete={onCommentDelete ?? (() => {})}
                      onUpdate={onCommentUpdate ?? (() => {})}
                    />
                  ))}
                </div>
              </CommentCellDropZone>
            );
          })}
        </div>
      ))}
    </div>
  );
}
