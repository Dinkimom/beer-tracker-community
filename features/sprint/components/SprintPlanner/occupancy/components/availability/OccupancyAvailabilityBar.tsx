'use client';

import type { AvailabilityCardKind } from '@/features/swimlane/components/AvailabilityCard';
import type { AvailabilitySegment } from '@/features/swimlane/utils/availabilitySegments';

import { useEffect, useRef, useState } from 'react';

import { PARTS_PER_DAY, WORKING_DAYS, ZIndex } from '@/constants';

const DEFAULT_TOTAL_PARTS = WORKING_DAYS * PARTS_PER_DAY;

import {
  PHASE_BAR_HEIGHT_PX,
  PHASE_ROW_INSET_PX,
} from '../task-row/plan/occupancyPhaseBarConstants';

function findHorizontalScrollParent(el: HTMLElement | null): HTMLElement | null {
  let current = el;
  while (current) {
    const style = getComputedStyle(current);
    const ox = style.overflowX;
    if (ox === 'auto' || ox === 'scroll' || ox === 'overlay') return current;
    current = current.parentElement;
  }
  return null;
}

function updateStickyOffset(
  barEl: HTMLElement | null,
  scrollParent: HTMLElement | null,
  leftColumnWidthPx: number,
  setOffset: (px: number) => void
) {
  if (!barEl || !scrollParent) return;
  const barRect = barEl.getBoundingClientRect();
  const scrollRect = scrollParent.getBoundingClientRect();
  const targetLeft = scrollRect.left + leftColumnWidthPx;
  const stickyLeft = targetLeft - barRect.left;
  const offset = Math.max(0, stickyLeft);
  setOffset(offset);
}

const TYPE_CONFIG: Record<
  AvailabilityCardKind,
  { label: string; bgClass: string; borderClass: string; textClass: string }
> = {
  vacation: {
    label: 'Отпуск',
    bgClass: 'bg-amber-100 dark:bg-amber-900/70',
    borderClass: 'border-2 border-amber-400/90 dark:border-amber-600',
    textClass: 'text-amber-900 dark:text-amber-100',
  },
  'tech-sprint-web': {
    label: 'Техспринт (Web)',
    bgClass: 'bg-sky-100 dark:bg-sky-900/70',
    borderClass: 'border-2 border-sky-400/90 dark:border-sky-600',
    textClass: 'text-sky-900 dark:text-sky-100',
  },
  'tech-sprint-back': {
    label: 'Техспринт (Back)',
    bgClass: 'bg-emerald-100 dark:bg-emerald-900/70',
    borderClass: 'border-2 border-emerald-400/90 dark:border-emerald-600',
    textClass: 'text-emerald-900 dark:text-emerald-100',
  },
  'tech-sprint-qa': {
    label: 'Техспринт (QA)',
    bgClass: 'bg-amber-100 dark:bg-amber-900/70',
    borderClass: 'border-2 border-amber-400/90 dark:border-amber-600',
    textClass: 'text-amber-900 dark:text-amber-100',
  },
};

export interface OccupancyAvailabilityBarProps {
  /** Высота полосы (по умолчанию как у фаз в полном режиме; в компактном — меньше) */
  barHeightPx?: number;
  /** Высота строки (для вертикального центрирования) */
  rowHeight: number;
  segment: AvailabilitySegment;
  /** Ширина колонки «Задачи» (sticky left) — текст прилипает справа от неё при скролле */
  taskColumnWidth: number;
  /** Всего «частей» таймлайна (рабочие дни × частей в день); по умолчанию как у 10-дневного спринта */
  totalTimelineParts?: number;
}

/** Полоса отпуска/техспринта в таймлайне занятости: только отображение, без перетаскивания и изменения */
export function OccupancyAvailabilityBar({
  barHeightPx = PHASE_BAR_HEIGHT_PX,
  segment,
  rowHeight,
  taskColumnWidth,
  totalTimelineParts = DEFAULT_TOTAL_PARTS,
}: OccupancyAvailabilityBarProps) {
  const config = TYPE_CONFIG[segment.kind];
  const totalParts = Math.max(1, totalTimelineParts);
  const startCell = segment.startDay * PARTS_PER_DAY;
  const leftPercent = (startCell / totalParts) * 100;
  const widthPercent = (segment.durationInParts / totalParts) * 100;
  const displayText = `${config.label} - ${segment.dateRangeLabel}`;

  const barRef = useRef<HTMLDivElement>(null);
  const [textLeftPx, setTextLeftPx] = useState(0);

  useEffect(() => {
    const barEl = barRef.current;
    const scrollParent = findHorizontalScrollParent(barEl ?? null);
    if (!scrollParent) return;

    const sync = () =>
      updateStickyOffset(barEl, scrollParent, taskColumnWidth, setTextLeftPx);
    sync();

    scrollParent.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(scrollParent);

    return () => {
      scrollParent.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [taskColumnWidth]);

  return (
    <div
      ref={barRef}
      aria-label={displayText}
      className={`absolute rounded-lg shadow-sm pointer-events-none select-none flex items-center ${config.bgClass} ${config.borderClass} ${config.textClass} ${textLeftPx > 0 ? 'overflow-visible' : 'overflow-hidden'}`}
      role="status"
      style={{
        left: `calc(${leftPercent}% + ${PHASE_ROW_INSET_PX}px)`,
        width: `calc(${widthPercent}% - ${PHASE_ROW_INSET_PX * 2}px)`,
        height: barHeightPx,
        top: (rowHeight - barHeightPx) / 2,
        fontSize: '11px',
        fontWeight: 600,
        zIndex: ZIndex.contentOverlay,
      }}
      title={displayText}
    >
      <span
        className={`truncate pl-2 pr-1.5 z-10 rounded-l-lg ${config.bgClass}`}
        style={{
          position: 'absolute',
          left: textLeftPx,
          minWidth: 0,
          maxWidth: textLeftPx > 0 ? '220px' : `calc(100% - ${textLeftPx}px)`,
        }}
      >
        {displayText}
      </span>
    </div>
  );
}
