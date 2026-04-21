import type { SprintListItem } from '@/types/tracker';
import type { CSSProperties } from 'react';

const DATE_PARTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

export function finishSprintMoveTasksRadioClassName(isDark: boolean, isActive: boolean): string {
  const base =
    'appearance-none w-4 h-4 rounded-full border-2 cursor-pointer outline-none focus:ring-0 focus:ring-offset-0 flex-shrink-0 ';
  const borderFocus = isDark
    ? 'border-gray-600 focus:ring-blue-400'
    : 'border-gray-300 focus:ring-blue-500';
  let fill: string;
  if (isActive) {
    fill = isDark ? 'bg-blue-400 border-blue-400' : 'bg-blue-500 border-blue-500';
  } else {
    fill = isDark ? 'bg-gray-700' : 'bg-white';
  }
  return `${base}${borderFocus} ${fill}`;
}

export function finishSprintMoveTasksRadioStyle(isDark: boolean, isActive: boolean): CSSProperties {
  const blue = isDark ? '#60a5fa' : '#3b82f6';
  const bgIdle = isDark ? '#374151' : '#ffffff';
  const borderIdle = isDark ? '#4b5563' : '#d1d5db';
  const dotInner = isDark ? '#374151' : '#ffffff';
  return {
    backgroundColor: isActive ? blue : bgIdle,
    backgroundImage: isActive ? `radial-gradient(circle, ${dotInner} 35%, transparent 35%)` : 'none',
    borderColor: isActive ? blue : borderIdle,
  };
}

export function formatDraftSprintOptionLabel(sprint: SprintListItem): string {
  if (!sprint.startDate || !sprint.endDate) return sprint.name;
  const start = new Date(sprint.startDate).toLocaleDateString('ru-RU', DATE_PARTS);
  const end = new Date(sprint.endDate).toLocaleDateString('ru-RU', DATE_PARTS);
  return `${sprint.name} (${start} - ${end})`;
}
