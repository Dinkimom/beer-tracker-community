'use client';

import type { PlanningPhaseCardColorScheme, SwimlaneCardFieldsVisibility } from '@/hooks/useLocalStorage';
import type { Task, Developer, TaskCardVariant } from '@/types';

import { StatusTag } from '@/components/StatusTag';
import { useI18n } from '@/contexts/LanguageContext';
import { TEAM_COLORS, TEAM_BORDER_COLORS, TEAM_SIDEBAR_COLORS } from '@/constants';
import { isEffectivelyQaTask } from '@/features/task/utils/taskUtils';
import { formatTaskTestPointsForDisplay } from '@/lib/pointsUtils';
import {
  getMonochromeCardBorderClasses,
  getQAStripedPattern,
  getStatusColors,
  resolveStatusForPhaseCardColors,
} from '@/utils/statusColors';

import { TaskCardContent } from './TaskCardContent';

function getIncidentSeverityTagClasses(severity: string): string {
  const severityUpper = severity.toUpperCase();
  if (severityUpper === 'S1' || severityUpper === 'P0' || severityUpper === 'P1') {
    return 'bg-red-600 text-white border-red-800 dark:bg-red-950 dark:text-red-200 dark:border-red-500/90 incident-fire-badge';
  }
  if (severityUpper === 'S2' || severityUpper === 'P2') {
    return 'bg-orange-500 text-white border-orange-700 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-400/90';
  }
  if (severityUpper === 'S3' || severityUpper === 'P3') {
    return 'bg-amber-400 text-amber-950 border-amber-700 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-500/80';
  }
  if (severityUpper === 'S4' || severityUpper === 'P4') {
    return 'bg-gray-500 text-white border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-500';
  }
  return 'bg-gray-500 text-white border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-500';
}

interface TaskCardBodyProps {
  assigneeName?: string;
  developers?: Developer[];
  displayDuration?: number; // Длительность в третях дня для адаптации
  isDragging?: boolean;
  isQATask?: boolean;
  /** Схема раскраски из настроек планирования (передаётся с TaskCard) */
  phaseCardColorScheme?: PlanningPhaseCardColorScheme;
  swimlaneCardFields?: SwimlaneCardFieldsVisibility;
  task: Task;
  variant?: TaskCardVariant;
}

/**
 * Общий компонент для отображения содержимого карточки задачи
 * Используется и в сайдбаре, и в swimlane
 */
export function TaskCardBody({
  task,
  developers = [],
  assigneeName,
  variant = 'swimlane',
  displayDuration,
  isQATask: explicitIsQATask,
  isDragging = false,
  phaseCardColorScheme = 'status',
  swimlaneCardFields,
}: TaskCardBodyProps) {
  const { t } = useI18n();
  const isQATask = explicitIsQATask === true || isEffectivelyQaTask(task);
  const hideTestPoints = task.hideTestPointsByIntegration === true;

  // Получаем имя исполнителя
  const assigneeDisplayName = isQATask
    ? task.assigneeName || (task.assignee ? developers.find((dev) => dev.id === task.assignee)?.name : undefined)
    : task.assigneeName || assigneeName;

  // Определяем режимы отображения на основе реальной длительности (в третях дня)
  const isSwimlane = variant === 'swimlane';
  const isVeryNarrow = isSwimlane && displayDuration !== undefined && displayDuration < 3; // меньше 3 третей (< 2sp)
  const isNarrow = isSwimlane && displayDuration !== undefined && displayDuration < 4; // меньше 4 третей (< 3sp)

  // Размер текста исполнителя: в сайдбаре 12px, в свимлейне — по ширине карточки
  const assigneeTextSize =
    variant === 'sidebar'
      ? 'text-[12px]'
      : isVeryNarrow
        ? 'text-[8px]'
        : isNarrow
          ? 'text-[9px]'
          : 'text-[10px]';
  const assigneeMargin = 'mt-1.5 mb-0';

  const showParentRow =
    variant === 'swimlane' &&
    Boolean(swimlaneCardFields?.showParent && task.parent);

  return (
    <>
      {/* Родительский тикет — только свимлейн; бейдж 1/N — в правом верхнем углу карточки (TaskCard) */}
      {variant === 'swimlane' && showParentRow && (
        <div className="text-[10px] leading-snug text-gray-700 dark:text-gray-200 truncate mb-0.5">
          {task.parent!.display}
        </div>
      )}

      {/* Заголовок */}
      <TaskCardContent
        displayDuration={variant === 'swimlane' && displayDuration !== undefined ? displayDuration : 5}
        isDragging={isDragging}
        phaseCardColorScheme={phaseCardColorScheme}
        swimlaneCardFields={swimlaneCardFields}
        task={task}
        variant={variant}
      />

      {/* Оценка SP/TP — строка под названием для swimlane */}
      {variant === 'swimlane' &&
        !isVeryNarrow &&
        ((swimlaneCardFields?.showStatus ?? true) ||
          (swimlaneCardFields?.showSeverity ?? true) ||
          (swimlaneCardFields?.showEstimates ?? true)) && (
        <div className="flex items-center gap-1.5 mt-auto pt-1 shrink-0 flex-wrap">
          {(swimlaneCardFields?.showStatus ?? true) && (
            <StatusTag
              className="text-[10px] px-1 py-0.5"
              status={task.originalStatus}
              statusColorKey={task.statusColorKey}
            />
          )}
          {(swimlaneCardFields?.showSeverity ?? true) && task.incidentSeverity && (
            <span
              className={`text-[10px] font-bold leading-none whitespace-nowrap px-1.5 py-0.5 rounded shrink-0 border ${getIncidentSeverityTagClasses(task.incidentSeverity)}`}
              title={`Критичность: ${task.incidentSeverity}`}
            >
              {task.incidentSeverity}
            </span>
          )}
          {(swimlaneCardFields?.showEstimates ?? true) && (
            <span className={`${assigneeTextSize} text-gray-600 dark:text-gray-300`}>
              {isQATask && !hideTestPoints
                ? formatTaskTestPointsForDisplay(task, 'compact')
                : `${task.storyPoints ?? '?'}sp`}
            </span>
          )}
        </div>
      )}


      {/* Исполнитель или платформа — только в сайдбаре; как в строке занятости: есть исполнитель — показываем его, нет — платформу простым текстом */}
      {variant === 'sidebar' && (
        <div
          className={`${assigneeTextSize} ${assigneeMargin} text-gray-700 dark:text-gray-200 truncate flex-shrink-0 font-medium`}
          style={{ lineHeight: '1.3' }}
        >
          {assigneeDisplayName ? (
            assigneeDisplayName
          ) : task.team && task.team !== 'QA' ? (
            <span className="capitalize">{task.team}</span>
          ) : (
            t('task.card.noAssignee')
          )}
        </div>
      )}

      {/* Теги не рендерятся здесь - они рендерятся отдельно в обертках */}
    </>
  );
}

/**
 * Хелпер функция для получения стилей карточки
 */
export function getTaskCardStyles(
  task: Task,
  variant: TaskCardVariant = 'swimlane',
  colorScheme: PlanningPhaseCardColorScheme = 'status'
) {
  const isQATask = isEffectivelyQaTask(task);

  if (colorScheme === 'monochrome') {
    const backlogColors = getStatusColors('backlog');
    const qaStripedStyle = isQATask ? getQAStripedPattern('backlog') : undefined;
    const teamColor =
      variant === 'sidebar'
        ? `${backlogColors.sidebar || TEAM_SIDEBAR_COLORS[task.team] || 'bg-gray-100 border-gray-300 text-gray-900'} ${backlogColors.sidebarDark || ''}`
        : `${backlogColors.bg || TEAM_COLORS[task.team] || 'bg-gray-100'} ${backlogColors.bgDark || ''}`;
    const teamBorder = getMonochromeCardBorderClasses(task.originalStatus);
    const qaTextAndBorderColor =
      isQATask && qaStripedStyle
        ? `${backlogColors.text} ${backlogColors.textDark || ''} ${teamBorder}`.trim()
        : '';

    return {
      qaStripedStyle,
      teamColor,
      teamBorder,
      qaTextAndBorderColor,
    };
  }

  const statusForColors = resolveStatusForPhaseCardColors(
    colorScheme,
    task.originalStatus,
    task.statusColorKey
  );
  const statusColors = getStatusColors(statusForColors);
  // Полосатый фон только для QA задач
  const qaStripedStyle = isQATask ? getQAStripedPattern(statusForColors) : undefined;

  // Для sidebar используем sidebar цвета, для swimlane - bg цвета
  const teamColor =
    variant === 'sidebar'
      ? `${statusColors.sidebar || TEAM_SIDEBAR_COLORS[task.team] || 'bg-gray-100 border-gray-300 text-gray-900'} ${statusColors.sidebarDark || ''}`
      : `${statusColors.bg || TEAM_COLORS[task.team] || 'bg-gray-100'} ${statusColors.bgDark || ''}`;

  const teamBorder =
    variant === 'sidebar'
      ? `${statusColors.border || TEAM_BORDER_COLORS[task.team] || 'border-gray-300'} ${statusColors.borderDark || ''}`
      : `${statusColors.border || TEAM_BORDER_COLORS[task.team] || 'border-gray-300'} ${statusColors.borderDark || ''}`;

  const qaTextAndBorderColor = isQATask && qaStripedStyle
    ? `${statusColors.text} ${statusColors.textDark || ''} ${statusColors.border} ${statusColors.borderDark || ''}`
    : '';

  return {
    qaStripedStyle,
    teamColor,
    teamBorder,
    qaTextAndBorderColor,
  };
}
