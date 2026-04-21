'use client';

import type { StatusDuration } from '@/features/task/components/TaskTimeline/types';
import type { Developer, Task } from '@/types';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import ReactMarkdown from 'react-markdown';

import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { TextTooltip } from '@/components/TextTooltip';
import { ZIndex } from '@/constants';
import { getEffectiveTimelineStartFromCreation } from '@/utils/dateUtils';
import { getInitials } from '@/utils/displayUtils';
import { getStatusColors } from '@/utils/statusColors';

import { formatDuration } from '../../utils/formatDuration';
import {
  dateTimeToFractionalCellInRange,
  TOTAL_PARTS,
} from '../../utils/sprintCellUtils';
import {
  statusDurationsToCells,
  type StatusPhaseCell,
} from '../../utils/statusToCells';
import { PhaseTooltip } from '../shared/PhaseTooltip';
import {
  OCCUPANCY_FACT_PHASE_GAP_PX,
  PHASE_ROW_INSET_PX,
} from '../task-row/plan/occupancyPhaseBarConstants';

/** 3 часа в миллисекундах */
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
/** Фазы короче этого считаются «очень короткими» — следующая фаза сдвигается вправо, чтобы не слипаться */
const VERY_SHORT_PHASE_MS = 20 * 60 * 1000; // 20 минут
/** Отступ справа у контейнера фаз факта, чтобы последняя фаза не прилипала к границе дня */
const FACT_ROW_RIGHT_INSET_PX = 4;
/**
 * Горизонтальный отступ только для слоя комментариев и переоценок (translateX(-50%)).
 * Полосы фаз остаются на прежней геометрии таймлайна.
 */
const FACT_TIMELINE_MARKER_INSET_PX = 18;
/** Минимальная ширина очень короткой фазы (чтобы полоска была видна) */
const MIN_GAP_PX = 4;
/** Размер аватарки комментария на таймлайне */
const COMMENT_ICON_SIZE_PX = 22;

const REESTIMATION_TOP_OFFSET_PX = -17;

/** Событие переоценки из changelog (изменение SP или TP) */
interface ReestimationEvent {
  createdBy?: { id?: string; display?: string };
  deltaSP: number;
  deltaTP: number;
  updatedAt: string;
}

function getReestimationEvents(changelog: ChangelogEntry[]): ReestimationEvent[] {
  const events: ReestimationEvent[] = [];
  for (const entry of changelog) {
    let deltaSP = 0;
    let deltaTP = 0;
    for (const field of entry.fields ?? []) {
      if (field.field.id === 'storyPoints' && field.from != null && field.to != null) {
        const fromVal = parseInt(String((field.from as { key?: string }).key ?? 0), 10) || 0;
        const toVal = parseInt(String((field.to as { key?: string }).key ?? 0), 10) || 0;
        deltaSP += toVal - fromVal;
      } else if (field.field.id === 'testPoints' && field.from != null && field.to != null) {
        const fromVal = parseInt(String((field.from as { key?: string }).key ?? 0), 10) || 0;
        const toVal = parseInt(String((field.to as { key?: string }).key ?? 0), 10) || 0;
        deltaTP += toVal - fromVal;
      }
    }
    if (deltaSP !== 0 || deltaTP !== 0) {
      events.push({
        deltaSP,
        deltaTP,
        updatedAt: entry.updatedAt,
        createdBy: entry.createdBy,
      });
    }
  }
  return events;
}

function formatReestimationLabel(deltaSP: number, deltaTP: number): string {
  const parts: string[] = [];
  if (deltaSP !== 0) parts.push(`${deltaSP > 0 ? '+' : ''}${deltaSP} sp`);
  if (deltaTP !== 0) parts.push(`${deltaTP > 0 ? '+' : ''}${deltaTP} tp`);
  return parts.join(' ');
}

/** Фаза closed на таймлайне факта — не рисуем полосу по длительности, только маркер «закрыто» */
function isClosedFactPhase(phase: StatusPhaseCell): boolean {
  return phase.statusKey.toLowerCase().replace(/\s+/g, '') === 'closed';
}

interface OccupancyActualPhasesProps {
  changelog: ChangelogEntry[];
  comments: IssueComment[];
  developerMap: Map<string, Developer>;
  durations: StatusDuration[];
  rowHeight: number;
  showComments: boolean;
  showReestimations: boolean;
  showStatuses: boolean;
  sprintStartDate: Date;
  taskCreatedAt?: string | null;
  taskId: string;
  tasksMap?: Map<string, Task>;
  /** Для мультиспринта (эпик): общее число ячеек таймлайна (workingDays * PARTS_PER_DAY). По умолчанию — один спринт. */
  totalParts?: number;
}

export function OccupancyActualPhases({
  changelog,
  comments,
  developerMap,
  durations,
  rowHeight,
  showComments,
  showReestimations,
  showStatuses,
  sprintStartDate,
  taskCreatedAt,
  taskId,
  tasksMap,
  totalParts: totalPartsProp,
}: OccupancyActualPhasesProps) {
  const totalParts = totalPartsProp ?? TOTAL_PARTS;
  const phases = statusDurationsToCells(sprintStartDate, durations, totalParts);
  const reestimationEvents = getReestimationEvents(changelog);
  const hasContent =
    (phases.length > 0 && showStatuses) ||
    (reestimationEvents.length > 0 && showReestimations) ||
    (comments.length > 0 && showComments);
  if (!hasContent) return null;

  const toCell = (d: Date) => dateTimeToFractionalCellInRange(sprintStartDate, d, totalParts);
  const nowFractionalCell = toCell(new Date());
  const nowCell = Math.min(nowFractionalCell, totalParts);

  // Начало таймлайна: от даты создания (с учётом выходных и после 18:00) или от 0
  const timelineStartCell = taskCreatedAt
    ? Math.max(
        0,
        Math.min(
          totalParts,
          toCell(getEffectiveTimelineStartFromCreation(new Date(taskCreatedAt)))
        )
      )
    : 0;

  const spanCells = nowCell - timelineStartCell;
  const leftPercent = (timelineStartCell / totalParts) * 100;
  const widthPercent = spanCells > 0 ? (spanCells / totalParts) * 100 : 0;

  // Фильтруем фазы и комментарии в диапазоне [timelineStartCell, nowCell]
  const visiblePhases = phases.filter(
    (p) => p.endCell > timelineStartCell && p.startCell < nowCell
  );

  return (
    <div
      className="absolute flex items-center pointer-events-none overflow-visible"
      style={{
        left: `calc(${leftPercent}% + ${PHASE_ROW_INSET_PX}px)`,
        top: 0,
        bottom: 0,
        width: `max(0px, calc(${widthPercent}% - ${PHASE_ROW_INSET_PX}px - ${FACT_ROW_RIGHT_INSET_PX}px))`,
      }}
    >
      <div
        className={`absolute inset-y-0 overflow-visible pointer-events-none ${ZIndex.class('stickyInContent')}`}
        style={{
          left: FACT_TIMELINE_MARKER_INSET_PX,
          right: FACT_TIMELINE_MARKER_INSET_PX,
        }}
      >
        <div className="relative h-full w-full pointer-events-none">
          {showReestimations && reestimationEvents.map((ev, idx) => {
        const cellPosition = toCell(new Date(ev.updatedAt));
        if (cellPosition < timelineStartCell || cellPosition > nowCell || cellPosition < 0 || cellPosition > totalParts) {
          return null;
        }
        const spanCellsEv = nowCell - timelineStartCell;
        const leftInSpan = cellPosition - timelineStartCell;
        const leftPercentEv = spanCellsEv > 0 ? (leftInSpan / spanCellsEv) * 100 : 0;
        const label = formatReestimationLabel(ev.deltaSP, ev.deltaTP);
        const authorName = ev.createdBy?.display ?? 'Неизвестно';
        const authorId = ev.createdBy?.id;
        const developer = authorId ? developerMap.get(authorId) : undefined;
        const displayName = developer?.name ?? authorName;
        const avatarUrl = developer?.avatarUrl;
        const formattedDate = new Date(ev.updatedAt).toLocaleString('ru-RU', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });
        return (
          <TextTooltip
            key={`${taskId}-reest-${idx}-${ev.updatedAt}`}
            content={
              <div className="max-w-sm overflow-hidden rounded-lg">
                <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-t-lg">
                  <Avatar
                    avatarUrl={avatarUrl}
                    className="flex-shrink-0 shadow-sm"
                    initials={getInitials(displayName)}
                    initialsVariant="primary"
                    size="lg"
                  />
                  <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                    <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                      {displayName}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formattedDate}
                    </div>
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    {label}
                  </span>
                </div>
              </div>
            }
            contentClassName="!bg-white dark:!bg-gray-800 !p-0 !shadow-2xl !border !border-gray-200 dark:!border-gray-700 !rounded-lg !overflow-hidden"
            delayDuration={150}
            interactive
            side="top"
          >
            <span
              className="absolute inline-block pointer-events-auto cursor-pointer hover:[&>*]:scale-105 hover:[&>*]:shadow-lg transition-all duration-200 [&>*]:shadow-md"
              style={{
                left: `${leftPercentEv}%`,
                top: REESTIMATION_TOP_OFFSET_PX,
                zIndex: ZIndex.stickyInContent,
                transform: 'translateX(-50%)',
              }}
            >
              <span className="inline-block text-[9px] font-medium leading-none px-1 py-px rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 whitespace-nowrap shadow-md">
                {label}
              </span>
            </span>
          </TextTooltip>
        );
      })}
          {showComments && comments.map((comment) => (
            <OccupancyCommentIcon
              key={`${taskId}-comment-${comment.id}`}
              comment={comment}
              developerMap={developerMap}
              sprintStartDate={sprintStartDate}
              timelineEndCell={nowCell}
              timelineStartCell={timelineStartCell}
              totalParts={totalParts}
            />
          ))}
        </div>
      </div>
      <div
        className="relative flex flex-1 min-w-0 items-center"
        style={{ gap: OCCUPANCY_FACT_PHASE_GAP_PX }}
      >
        {showStatuses &&
          // eslint-disable-next-line no-restricted-syntax -- IIFE: локальный рендер без выноса в отдельный компонент
          (() => {
            if (spanCells <= 0) return null;
            const flexNodes: React.ReactNode[] = [];
            let accounted = 0;
            visiblePhases.forEach((phase, idx) => {
              const leftInSpan = Math.max(0, phase.startCell - timelineStartCell);
              const prevEnd = idx === 0 ? 0 : visiblePhases[idx - 1]!.endCell - timelineStartCell;
              const spacerCells = Math.max(0, leftInSpan - prevEnd);
              accounted += spacerCells;
              if (spacerCells > 0) {
                flexNodes.push(
                  <div
                    key={`spacer-${phase.statusKey}-${phase.startCell}`}
                    style={{ flex: `${spacerCells} 0 0`, minWidth: 0 }}
                  />
                );
              }
              if (isClosedFactPhase(phase)) {
                // В потоке flex сразу после предыдущей «колбасы» и спейсера — без absolute/%,
                // иначе gap между полосами и центр по границе дают наложение на соседнюю фазу
                flexNodes.push(
                  <OccupancyClosedFactMarker
                    key={`${taskId}-closed-${phase.startCell}-${phase.endCell}`}
                    changelog={changelog}
                    developerMap={developerMap}
                    phase={phase}
                    rowHeight={rowHeight}
                    taskId={taskId}
                    tasksMap={tasksMap}
                  />
                );
                return;
              }
              const widthInSpan = Math.min(phase.endCell - phase.startCell, spanCells - leftInSpan);
              accounted += widthInSpan;
              flexNodes.push(
                <OccupancyStatusPhaseBar
                  key={`${taskId}-${phase.statusKey}-${phase.startCell}-${phase.endCell}`}
                  changelog={changelog}
                  developerMap={developerMap}
                  phase={phase}
                  rowHeight={rowHeight}
                  spanCells={spanCells}
                  taskId={taskId}
                  tasksMap={tasksMap}
                  timelineStartCell={timelineStartCell}
                />
              );
            });
            const tailFlex = Math.max(0, spanCells - accounted);
            if (tailFlex > 0.0001) {
              flexNodes.push(
                <div
                  key={`${taskId}-fact-tail-spacer`}
                  aria-hidden
                  className="min-w-0"
                  style={{ flex: `${tailFlex} 0 0` }}
                />
              );
            }
            return flexNodes;
          })()}
      </div>
      </div>
  );
}

function OccupancyClosedFactMarker({
  changelog,
  developerMap,
  phase,
  rowHeight,
  taskId,
  tasksMap,
}: {
  changelog: ChangelogEntry[];
  developerMap: Map<string, Developer>;
  phase: StatusPhaseCell;
  rowHeight: number;
  taskId: string;
  tasksMap?: Map<string, Task>;
}) {
  const statusColors = getStatusColors(phase.statusKey);
  const verticalInset = 2;
  const bottomMargin = 8;
  const barHeight = Math.min(28, rowHeight - verticalInset - bottomMargin);
  /** Квадрат той же высоты, что и «колбасы» факт-таймлайна */
  const markerSize = Math.max(MIN_GAP_PX, barHeight);
  const bgClass = statusColors.bgDark
    ? `${statusColors.bg} ${statusColors.bgDark}`
    : statusColors.bg;
  const borderClass = statusColors.borderDark
    ? `${statusColors.border} ${statusColors.borderDark}`
    : statusColors.border;
  const statusTooltipId = `${taskId}-closed-${phase.startCell}-${phase.endCell}`;

  return (
    <div
      className="pointer-events-none flex shrink-0 items-center justify-center self-center"
      style={{ width: markerSize, zIndex: ZIndex.contentOverlay }}
    >
      <TextTooltip
        content={
          <PhaseTooltip
            changelog={changelog}
            developerMap={developerMap}
            phase={phase}
            tasksMap={tasksMap}
          />
        }
        contentClassName="!bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-gray-100 !p-0 !shadow-xl !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
        delayDuration={200}
        side="top"
        singleInGroupId={statusTooltipId}
      >
        <div
          aria-label={`${phase.statusKey}: закрыто`}
          className={`pointer-events-auto flex shrink-0 items-center justify-center rounded-md overflow-hidden border-2 opacity-60 shadow-sm transition-opacity hover:opacity-100 cursor-pointer box-border ${bgClass} ${borderClass}`}
          role="img"
          style={{
            width: markerSize,
            height: markerSize,
          }}
        >
          <Icon
            className={`shrink-0 ${statusColors.text} ${statusColors.textDark ?? ''}`}
            name="check"
            size="sm"
          />
        </div>
      </TextTooltip>
    </div>
  );
}

function OccupancyStatusPhaseBar({
  changelog,
  developerMap,
  phase,
  rowHeight,
  spanCells,
  taskId,
  timelineStartCell,
  tasksMap,
}: {
  changelog: ChangelogEntry[];
  developerMap: Map<string, Developer>;
  phase: StatusPhaseCell;
  rowHeight: number;
  spanCells: number;
  taskId: string;
  timelineStartCell: number;
  tasksMap?: Map<string, Task>;
}) {
  const statusColors = getStatusColors(phase.statusKey);
  const leftInSpan = Math.max(0, phase.startCell - timelineStartCell);
  const widthInSpan = Math.min(phase.endCell - phase.startCell, spanCells - leftInSpan);
  const durationStr = formatDuration(phase.durationMs);
  const bgClass = statusColors.bgDark
    ? `${statusColors.bg} ${statusColors.bgDark}`
    : statusColors.bg;
  const borderClass = statusColors.borderDark
    ? `${statusColors.border} ${statusColors.borderDark}`
    : statusColors.border;

  const verticalInset = 2;
  const bottomMargin = 8;
  const barHeight = Math.min(28, rowHeight - verticalInset - bottomMargin);

  const isVeryShort = phase.durationMs <= VERY_SHORT_PHASE_MS;
  const minBarWidth = isVeryShort ? MIN_GAP_PX : 2;

  // Если фаза меньше 3 часов - не показываем текст
  const showText = phase.durationMs >= THREE_HOURS_MS;
  const statusTooltipId = `${taskId}-${phase.startCell}-${phase.endCell}`;

  return (
    <TextTooltip
      content={
        <PhaseTooltip
          changelog={changelog}
          developerMap={developerMap}
          phase={phase}
          tasksMap={tasksMap}
        />
      }
      contentClassName="!bg-white dark:!bg-gray-800 !text-gray-900 dark:!text-gray-100 !p-0 !shadow-xl !border !border-gray-200 dark:!border-gray-700 !rounded-lg"
      delayDuration={200}
      side="top"
      singleInGroupId={statusTooltipId}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-md overflow-hidden border-2 opacity-60 hover:opacity-100 transition-opacity pointer-events-auto cursor-pointer box-border ${bgClass} ${borderClass}`}
        style={{
          flex: `${widthInSpan} 0 0`,
          minWidth: minBarWidth,
          height: barHeight,
          zIndex: ZIndex.contentOverlay,
        }}
      >
        {showText && (
          <span
            className={`text-[10px] font-medium px-1.5 truncate max-w-full text-center leading-tight ${statusColors.text} ${statusColors.textDark ?? ''}`}
          >
            {durationStr}
          </span>
        )}
      </div>
    </TextTooltip>
  );
}

function OccupancyCommentIcon({
  comment,
  developerMap,
  sprintStartDate,
  timelineStartCell,
  timelineEndCell,
  totalParts,
}: {
  comment: IssueComment;
  developerMap: Map<string, Developer>;
  sprintStartDate: Date;
  timelineStartCell: number;
  timelineEndCell: number;
  totalParts: number;
}) {
  const iconSizePx = COMMENT_ICON_SIZE_PX;
  const positionStyle: React.CSSProperties = {
    width: iconSizePx,
    height: iconSizePx,
    top: -iconSizePx / 2 - 2,
    zIndex: ZIndex.stickyInContent,
    transform: 'translateX(-50%)',
  };
  const commentDate = new Date(comment.createdAt);

  const cellPosition = dateTimeToFractionalCellInRange(sprintStartDate, commentDate, totalParts);

  // Не показываем комментарий вне диапазона таймлайна (от создания до текущего времени)
  if (cellPosition < timelineStartCell || cellPosition > timelineEndCell || cellPosition < 0 || cellPosition > totalParts) {
    return null;
  }

  // Позиция в процентах от начала таймлайна (относительно контейнера от timelineStartCell до timelineEndCell)
  const spanCells = timelineEndCell - timelineStartCell;
  const leftInSpan = cellPosition - timelineStartCell;
  const leftPercent = spanCells > 0 ? (leftInSpan / spanCells) * 100 : 0;

  // Форматируем дату
  const formattedDate = new Date(comment.createdAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  const initials = getInitials(comment.createdBy.display);

  // Получаем аватар из developerMap
  const developer = developerMap.get(comment.createdBy.id);
  const avatarUrl = developer?.avatarUrl;

  return (
    <TextTooltip
      content={
        <div className="max-w-sm overflow-hidden rounded-lg">
          {/* Заголовок с автором и датой */}
          <div className="flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-t-lg">
            <Avatar
              avatarUrl={avatarUrl}
              className="flex-shrink-0 shadow-sm"
              initials={initials}
              initialsVariant="primary"
              size="lg"
            />

            {/* Автор и дата в одну строку */}
            <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
              <div className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                {comment.createdBy.display}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                {formattedDate}
              </div>
            </div>
          </div>

          {/* Текст комментария (с парсингом Markdown) */}
          <div className="px-3 py-2.5 max-h-96 overflow-y-auto">
            <div className="text-sm text-gray-700 dark:text-gray-300 break-words leading-relaxed [&_p]:mb-1.5 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_li]:my-0.5 [&_code]:bg-gray-100 [&_code]:dark:bg-gray-700 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_a]:text-blue-600 [&_a]:dark:text-blue-400 [&_a]:hover:underline [&_pre]:bg-gray-100 [&_pre]:dark:bg-gray-700 [&_pre]:p-2 [&_pre]:rounded [&_pre]:text-xs [&_pre]:overflow-x-auto [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:dark:border-gray-600 [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:text-gray-600 [&_blockquote]:dark:text-gray-400">
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="whitespace-pre-wrap">{children}</p>,
                  a: ({ href, children }) => (
                    <a href={href} rel="noopener noreferrer" target="_blank">
                      {children}
                    </a>
                  ),
                }}
              >
                {comment.text}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      }
      contentClassName="!bg-white dark:!bg-gray-800 !p-0 !shadow-2xl !border !border-gray-200 dark:!border-gray-700 !rounded-lg !overflow-hidden"
      delayDuration={150}
      interactive
      side="top"
    >
      <span
        className="absolute inline-block pointer-events-auto cursor-pointer hover:[&>*]:scale-125 hover:[&>*]:shadow-lg transition-all duration-200 [&>*]:shadow-md"
        style={{
          ...positionStyle,
          left: `${leftPercent}%`,
        }}
      >
        <Avatar
          avatarUrl={avatarUrl}
          className="border-white dark:border-white"
          initials={initials}
          initialsVariant="primary"
          size="xs"
        />
      </span>
    </TextTooltip>
  );
}
