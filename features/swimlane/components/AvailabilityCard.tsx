'use client';

/** Карточка отпуска/техспринта: не перетаскивается и не удаляется */

import { useEffect, useRef, useState } from 'react';

import { CARD_MARGIN } from '@/constants';

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
  cardEl: HTMLElement | null,
  scrollParent: HTMLElement | null,
  participantsColumnWidthPx: number,
  setOffset: (px: number) => void
) {
  if (!cardEl || !scrollParent) return;
  const cardRect = cardEl.getBoundingClientRect();
  const scrollRect = scrollParent.getBoundingClientRect();
  // Текст «прилипает» справа от колонки исполнителей (sticky left-0), чтобы не перекрывалась
  const targetLeft = scrollRect.left + participantsColumnWidthPx;
  const stickyLeft = targetLeft - cardRect.left;
  const offset = Math.max(0, stickyLeft);
  setOffset(offset);
}

const TYPE_CONFIG = {
  vacation: {
    label: 'Отпуск',
    bgClass: 'bg-amber-100 dark:bg-amber-900/70',
    borderClass: 'border-2 border-amber-400/90 dark:border-amber-600',
    textClass: 'text-amber-900 dark:text-amber-100',
  },
  sick_leave: {
    label: 'Больничный',
    bgClass: 'bg-rose-100 dark:bg-rose-900/70',
    borderClass: 'border-2 border-rose-400/90 dark:border-rose-600',
    textClass: 'text-rose-900 dark:text-rose-100',
  },
  duty: {
    label: 'Дежурство',
    bgClass: 'bg-violet-100 dark:bg-violet-900/70',
    borderClass: 'border-2 border-violet-400/90 dark:border-violet-600',
    textClass: 'text-violet-900 dark:text-violet-100',
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
} as const;

export type AvailabilityCardKind = keyof typeof TYPE_CONFIG;

export interface AvailabilityCardProps {
  /** Диапазон дат для отображения в формате "Название - даты" */
  dateRangeLabel: string;
  kind: AvailabilityCardKind;
  leftPercent: number;
  /** Ширина колонки исполнителей (sticky left) — текст прилипает справа от неё */
  participantsColumnWidth: number;
  totalHeight: number;
  /** Дополнительный отступ сверху/снизу (как у TaskBar) */
  verticalMargin?: number;
  widthPercent: number;
}

export function AvailabilityCard({
  dateRangeLabel,
  kind,
  leftPercent,
  participantsColumnWidth,
  totalHeight,
  verticalMargin = 6,
  widthPercent,
}: AvailabilityCardProps) {
  const config = TYPE_CONFIG[kind];
  const height = totalHeight - verticalMargin * 2;
  const displayText = `${config.label} - ${dateRangeLabel}`;

  const cardRef = useRef<HTMLDivElement>(null);
  const [textLeftPx, setTextLeftPx] = useState(0);

  useEffect(() => {
    const cardEl = cardRef.current;
    const scrollParent = findHorizontalScrollParent(cardEl ?? null);
    if (!scrollParent) return;

    const sync = () =>
      updateStickyOffset(cardEl, scrollParent, participantsColumnWidth, setTextLeftPx);
    sync();

    scrollParent.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(scrollParent);

    return () => {
      scrollParent.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [participantsColumnWidth]);

  return (
    <div
      ref={cardRef}
      aria-label={displayText}
      className={`absolute rounded-lg shadow-sm shrink-0 flex items-center pointer-events-none select-none ${config.bgClass} ${config.borderClass} ${config.textClass} ${textLeftPx > 0 ? 'overflow-visible' : 'overflow-hidden'}`}
      role="status"
      style={{
        left: `calc(${leftPercent}% + ${CARD_MARGIN}px)`,
        width: `calc(${widthPercent}% - ${CARD_MARGIN * 2}px)`,
        top: verticalMargin,
        height: Math.max(24, height),
        minHeight: 24,
        fontSize: '11px',
        fontWeight: 600,
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
