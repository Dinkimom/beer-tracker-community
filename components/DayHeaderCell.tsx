'use client';

import type { DayErrorDetail } from '@/features/sprint/utils/occupancyValidation';
import type { Task } from '@/types';

import { DayErrorIndicator } from '@/features/sprint/components/DayErrorIndicator';
import { useShowHolidaysStorage } from '@/hooks/useLocalStorage';
import { getHolidayForDate } from '@/lib/holidays';

/**
 * Общий компонент ячейки дня для заголовка таймлайна (свимлейн и занятость).
 * День и дата в одну строку, единая высота строки.
 */

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;

function getDayLabel(date: Date): string {
  return DAY_LABELS[date.getDay()];
}

function formatDateDDMM(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  return `${day}.${month}`;
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function isPastDay(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export interface DayHeaderCellContentProps {
  day: Date;
  /** Список проблемных задач и причин для тултипа иконки ошибки в этом дне */
  errorDetails?: DayErrorDetail[];
  /** В этом дне есть ошибки планирования — показывается иконка рядом с датой */
  hasError?: boolean;
  /** Отображать день и дату в две строки (для квартального планирования) */
  multiline?: boolean;
  /** Явно отключить эмодзи праздников (для квартального планирования). Если не задано — используется настройка из хранилища */
  showHolidayEmoji?: boolean;
  /** Список задач для поиска taskId по taskName */
  tasks?: Task[];
  /** Вариант цветов: timeline (серый прошлое) или occupancy (серый прошлое) */
  variant?: 'occupancy' | 'timeline';
  /** Callback для изменения hoveredErrorTaskId */
  onHoveredErrorTaskIdChange?: (taskId: string | null) => void;
}

/**
 * Содержимое ячейки дня: «Пн 26.01» в одну строку, индикатор «сегодня».
 * Родитель задаёт обёртку (th) и высоту.
 */
export function DayHeaderCellContent({
  day,
  variant = 'timeline',
  errorDetails,
  hasError,
  tasks,
  onHoveredErrorTaskIdChange,
  multiline = false,
  showHolidayEmoji,
}: DayHeaderCellContentProps) {
  const [showHolidaysStorage] = useShowHolidaysStorage();
  const showHolidays = showHolidayEmoji !== undefined ? showHolidayEmoji : showHolidaysStorage;
  const today = isToday(day);
  const past = isPastDay(day);

  const textClasses =
    variant === 'occupancy'
      ? today
        ? 'text-blue-700 dark:text-blue-300 font-semibold'
        : past
          ? 'text-gray-400 dark:text-gray-500 font-medium'
          : 'text-gray-700 dark:text-gray-300 font-medium'
      : today
        ? 'text-blue-700 dark:text-blue-300 font-semibold'
        : past
          ? 'text-gray-400 dark:text-gray-500 font-medium'
          : 'text-gray-700 dark:text-gray-300 font-medium';

  const holiday = showHolidays ? getHolidayForDate(day) : null;

  const dayContent = multiline ? (
    <span className="flex flex-col leading-tight text-center">
      <span>{getDayLabel(day)}</span>
      <span>{formatDateDDMM(day)}</span>
    </span>
  ) : (
    <span>
      {getDayLabel(day)} {formatDateDDMM(day)}
    </span>
  );

  return (
    <span className={`text-xs inline-flex items-center justify-center gap-1 ${textClasses}`}>
      {dayContent}
      {holiday && (
        <span
          aria-label={holiday.caption}
          className="shrink-0 cursor-default text-base leading-none"
          title={holiday.caption}
        >
          {holiday.emoji}
        </span>
      )}
      {today && (
        <span
          aria-hidden
          className="inline-block w-2 h-2 bg-blue-600 rounded-full animate-pulse shrink-0"
        />
      )}
      {hasError && (
        <DayErrorIndicator
          errorDetails={errorDetails}
          tasks={tasks}
          onHoveredErrorTaskIdChange={onHoveredErrorTaskIdChange}
        />
      )}
    </span>
  );
}
