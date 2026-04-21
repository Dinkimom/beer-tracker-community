'use client';

import type { Task } from '@/types';

import { useDroppable } from '@dnd-kit/core';

import { getStatusColors, resolvePaletteStatusKey } from '@/utils/statusColors';

interface DroppableCellProps {
  activeTask: Task | null;
  id: string;
  isHighlighted: boolean;
  /** Ячейка попадает в нерабочий/праздничный день */
  isHoliday?: boolean;
  partIndex: number;
  partStatus: 'current' | 'future' | 'past';
  totalHeight: number;
  onDoubleClick?: (e: React.MouseEvent) => void;
}

export function DroppableCell({
  id,
  isHighlighted,
  partIndex,
  partStatus,
  activeTask,
  totalHeight,
  onDoubleClick,
  isHoliday,
}: DroppableCellProps) {
  const { setNodeRef } = useDroppable({ id });

  const getHighlightColor = () => {
    if (!activeTask) return { bg: 'bg-blue-100/80 dark:bg-blue-900/40', border: 'border-blue-300/50 dark:border-blue-700/50' };

    const statusColors = getStatusColors(
      resolvePaletteStatusKey(activeTask.originalStatus, activeTask.statusColorKey)
    );
    // Используем темные варианты для highlight, если они есть
    if (statusColors.highlightDark) {
      return {
        bg: `${statusColors.highlight.bg} ${statusColors.highlightDark.bg}`,
        border: `${statusColors.highlight.border} ${statusColors.highlightDark.border}`
      };
    }
    // Fallback: используем bgDark и borderDark для создания highlightDark
    const bgDark = statusColors.bgDark ? statusColors.bgDark.replace('dark:', '').replace('/40', '/40') : 'dark:bg-gray-700/40';
    const borderDark = statusColors.borderDark ? `${statusColors.borderDark.replace('dark:', '').replace('border-', 'border-')  }/50` : 'dark:border-gray-600/50';

    return {
      bg: `${statusColors.highlight.bg} dark:${bgDark}`,
      border: `${statusColors.highlight.border} dark:${borderDark}`
    };
  };

  const getBaseBgColor = () => {
    if (isHighlighted) {
      const highlightColor = getHighlightColor();
      return `${highlightColor.bg} ${highlightColor.border}`;
    }
    // Не используем useDroppable().isOver для фона: после drop dnd-kit часто оставляет isOver,
    // из‑за чего ячейки остаются закрашенными до движения мыши.

    if (partStatus === 'current') return 'bg-blue-100/70 dark:bg-blue-900/30';
    if (isHoliday) return 'bg-gray-50 dark:bg-gray-900/40';
    return '';
  };

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 pointer-events-auto ${
        partIndex !== 2 ? 'border-r border-gray-200/50 dark:border-gray-600/50' : ''
      } ${getBaseBgColor()}`}
      data-current-cell={partStatus === 'current' ? 'true' : undefined}
      style={{ height: `${totalHeight}px`, minHeight: `${totalHeight}px` }}
      onDoubleClick={onDoubleClick}
    />
  );
}
