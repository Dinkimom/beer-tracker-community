'use client';

import type { SwimlaneCardFieldsVisibility } from '@/hooks/useLocalStorage';
import type { PlanningPhaseCardColorScheme } from '@/hooks/useLocalStorage';
import type { Task, TaskCardVariant } from '@/types';

import { useRef, useState, useEffect } from 'react';

import { IssueTypeIcon } from '@/components/IssueTypeIcon';
import { PriorityIcon } from '@/components/PriorityIcon';
import { TextTooltip } from '@/components/TextTooltip';
import { useI18n } from '@/contexts/LanguageContext';
import { TEAM_TEXT_COLORS } from '@/constants';
import { getStatusColors, resolveStatusForPhaseCardColors } from '@/utils/statusColors';

interface TaskCardContentProps {
  displayDuration: number; // Длительность в третях дня для адаптации
  isDragging?: boolean;
  phaseCardColorScheme?: PlanningPhaseCardColorScheme;
  swimlaneCardFields?: SwimlaneCardFieldsVisibility;
  task: Task;
  variant?: TaskCardVariant;
}

export function TaskCardContent({
  task,
  displayDuration,
  variant = 'swimlane',
  isDragging = false,
  phaseCardColorScheme = 'status',
  swimlaneCardFields,
}: TaskCardContentProps) {
  const { t } = useI18n();
  const statusForTitle = resolveStatusForPhaseCardColors(
    phaseCardColorScheme,
    task.originalStatus,
    task.statusColorKey
  );
  const statusColors = getStatusColors(statusForTitle);
  const teamTextColor = `${statusColors.text || TEAM_TEXT_COLORS[task.team] || 'text-gray-900'} ${statusColors.textDark || ''}`;

  // Для QA задач используем оригинальный ID, иначе обычный ID
  const displayId = task.originalTaskId || task.id;
  const displayText = `${displayId} - ${task.name}`;
  const trackerUrl = `https://tracker.yandex.ru/${displayId}`;

  // Автоматический расчёт максимального числа строк по доступной высоте (только swimlane)
  const wrapperRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [maxLines, setMaxLines] = useState(3);

  useEffect(() => {
    if (variant !== 'swimlane') return;
    const wrapper = wrapperRef.current;
    const text = textRef.current;
    if (!wrapper || !text) return;

    const update = () => {
      const lh = parseFloat(getComputedStyle(text).lineHeight);
      if (!lh || isNaN(lh)) return;
      setMaxLines(Math.max(1, Math.floor(wrapper.clientHeight / lh)));
    };

    const ro = new ResizeObserver(update);
    ro.observe(wrapper);
    update();
    return () => ro.disconnect();
  }, [variant]);

  // Отслеживание движения мыши для предотвращения перехода по ссылке при перетаскивании
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const hasMoved = useRef(false);

  const handleLinkMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Не запускать перетаскивание при клике по ссылке
    if (isDragging) {
      e.preventDefault();
      return;
    }
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    hasMoved.current = false;
  };

  const handleLinkMouseMove = (e: React.MouseEvent) => {
    if (!mouseDownPos.current) return;
    const deltaX = Math.abs(e.clientX - mouseDownPos.current.x);
    const deltaY = Math.abs(e.clientY - mouseDownPos.current.y);
    if (deltaX > 5 || deltaY > 5) {
      hasMoved.current = true;
    }
  };

  const handleKeyLinkClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDragging || hasMoved.current) {
      e.preventDefault();
    }
  };

  const handleLinkPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation(); // Не запускать перетаскивание при клике по ссылке
  };

  const keyLinkProps = {
    href: trackerUrl,
    rel: 'noopener noreferrer' as const,
    target: '_blank',
    title: t('task.card.openInTracker', { id: displayId }),
    style: { pointerEvents: isDragging ? ('none' as const) : ('auto' as const) },
    onClick: handleKeyLinkClick,
    onMouseDown: handleLinkMouseDown,
    onMouseMove: handleLinkMouseMove,
    onPointerDown: handleLinkPointerDown,
  };

  // Для сайдбара — как в свимлейне: приоритет и тип в строке названия, затем ключ и название
  if (variant === 'sidebar') {
    const contentEl = (
      <div className={`text-xs leading-snug mt-2 break-words line-clamp-3 ${teamTextColor}`}>
        <span className="inline-flex items-center gap-1 mr-1.5 align-middle shrink-0">
          {task.priority && <PriorityIcon className="w-4 h-4 shrink-0" priority={task.priority} />}
          <IssueTypeIcon className="w-4 h-4 shrink-0" type={task.type} />
        </span>
        <a
          className="font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
          {...keyLinkProps}
        >
          {displayId}
        </a>
        <span className="font-bold">{' - '}{task.name || t('task.card.untitled')}</span>
      </div>
    );
    return (
      <div className="relative flex flex-col justify-start flex-1 overflow-hidden min-h-0">
        {isDragging ? contentEl : (
          <TextTooltip content={displayText} delayDuration={500}>
            {contentEl}
          </TextTooltip>
        )}
      </div>
    );
  }

  // Определяем режимы отображения на основе длительности (только для swimlane)
  const isNarrow = displayDuration < 4;

  const textSize = isNarrow ? 'text-[10px]' : 'text-xs';
  const lineHeightClass = isNarrow ? 'leading-snug' : 'leading-tight';
  const inlineIconSize = 'w-3 h-3';

  const mergedFields: SwimlaneCardFieldsVisibility = {
    showParent: true,
    showKey: true,
    showPriority: true,
    showType: true,
    showEstimates: true,
    showSeverity: true,
    showStatus: true,
    ...swimlaneCardFields,
  };

  // Ключ и название — обычный инлайн-поток, чтобы название переносилось по словам
  const contentEl = (
    <div
      ref={textRef}
      className={`${textSize} ${lineHeightClass} break-words ${teamTextColor} my-1`}
      style={{
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: maxLines,
        overflow: 'hidden',
      }}
    >
      {(mergedFields.showPriority || mergedFields.showType) && (
        <span className="inline-flex items-center gap-0.5 mr-1 align-middle shrink-0">
          {mergedFields.showPriority && task.priority && (
            <PriorityIcon className={`${inlineIconSize} shrink-0`} priority={task.priority} />
          )}
          {mergedFields.showType && (
            <IssueTypeIcon className={`${inlineIconSize} shrink-0`} type={task.type} />
          )}
        </span>
      )}
      {mergedFields.showKey && (
        <a
          className={`font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer ${lineHeightClass}`}
          {...keyLinkProps}
        >
          {displayId}
        </a>
      )}
      <span className="font-bold">
        {mergedFields.showKey ? ' - ' : ''}
        {task.name || t('task.card.untitled')}
      </span>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative flex-1 overflow-hidden min-h-0">
      {contentEl}
    </div>
  );
}
