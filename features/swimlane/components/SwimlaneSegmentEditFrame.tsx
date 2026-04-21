'use client';

import type { PhaseSegment } from '@/types';

import { useCallback, useState } from 'react';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { CARD_MARGIN, WORKING_DAYS, PARTS_PER_DAY } from '@/constants';
import { cellsToSegments, PHASE_FOCUS_RING_SOURCE } from '@/lib/planner-timeline';

export interface SwimlaneSegmentEditFrameProps {
  cells: boolean[];
  /** Вертикальные отступы строки (как у TaskBar): top, bottom, zIndex */
  containerStyle: React.CSSProperties;
  rangeStartCell: number;
  /** Знаменатель для процентов по ширине таймлайна */
  timelineTotalParts?: number;
  totalCells: number;
  onCancel: () => void;
  onCellsChange: (next: boolean[]) => void;
  onSave: (segments: PhaseSegment[]) => void;
}

/**
 * Режим редактирования отрезков на свимлейне: обводка вокруг полного диапазона (с зазорами)
 * и невидимые кнопки по ячейкам; карточки остаются под слоем.
 */
export function SwimlaneSegmentEditFrame({
  cells,
  onCellsChange,
  rangeStartCell,
  timelineTotalParts = WORKING_DAYS * PARTS_PER_DAY,
  totalCells,
  containerStyle,
  onSave,
  onCancel,
}: SwimlaneSegmentEditFrameProps) {
  const [hoveredCellIndex, setHoveredCellIndex] = useState<number | null>(null);

  const leftPercent = (rangeStartCell / timelineTotalParts) * 100;
  const widthPercent = (totalCells / timelineTotalParts) * 100;
  const barLeft = `calc(${leftPercent}% + ${CARD_MARGIN}px)`;
  const barWidth = `calc(${widthPercent}% - ${CARD_MARGIN * 2}px)`;
  /** Как у PhaseSegmentInlineEditor / OccupancyLinkButton: левый край контейнера кнопки — правый край диапазона по сетке */
  const cancelButtonContainerLeft = `calc(${leftPercent}% + ${widthPercent}%)`;

  const toggle = useCallback(
    (index: number) => {
      const next = [...cells];
      next[index] = !cells[index];
      onCellsChange(next);
    },
    [cells, onCellsChange],
  );

  const handleFinish = useCallback(() => {
    const segments = cellsToSegments(rangeStartCell, cells);
    const allOn = cells.every(Boolean);
    onSave(allOn ? [] : segments);
    onCancel();
  }, [cells, rangeStartCell, onSave, onCancel]);

  return (
    <div className="pointer-events-auto absolute left-0 right-0" style={containerStyle}>
      <div
        aria-hidden
        className={`pointer-events-none absolute rounded-lg ${PHASE_FOCUS_RING_SOURCE}`}
        style={{ left: barLeft, width: barWidth, top: 0, bottom: 0, zIndex: 0 }}
      />
      {/* Как в PhaseSegmentInlineEditor (занятость): скругление + overflow-hidden, сырые button без ghost — иначе «дырка» и лишний контраст ховера */}
      <div
        className="absolute z-[1] flex items-stretch overflow-hidden rounded-lg"
        style={{ left: barLeft, width: barWidth, top: 0, bottom: 0 }}
        onMouseLeave={() => setHoveredCellIndex(null)}
      >
        {cells.map((on, idx) => (
          <button
            key={idx}
            aria-label={on ? 'Выключить отрезок' : 'Включить отрезок'}
            className={`min-h-0 min-w-0 flex-1 cursor-pointer rounded-sm border-0 transition-colors ${
              hoveredCellIndex === idx
                ? 'bg-black/15 ring-1 ring-inset ring-black/25 dark:bg-white/15 dark:ring-white/30'
                : 'bg-transparent hover:bg-black/10 dark:hover:bg-white/5'
            }`}
            title={on ? 'Выключить отрезок' : 'Включить отрезок'}
            type="button"
            onClick={() => toggle(idx)}
            onMouseEnter={() => setHoveredCellIndex(idx)}
          />
        ))}
      </div>
      <div
        className="pointer-events-auto absolute flex w-8 items-center justify-end"
        style={{
          left: cancelButtonContainerLeft,
          top: 0,
          bottom: 0,
          zIndex: 2,
        }}
      >
        <Button
          aria-label="Закрыть редактор отрезков"
          className="!h-6 !w-6 !min-h-0 !min-w-0 !justify-center !p-0 text-blue-600 shadow-sm transition-opacity duration-300 ease-out transition-shadow duration-200 hover:!shadow-lg focus-visible:outline-none dark:text-blue-400 !border-gray-200 !bg-white hover:!bg-blue-50 dark:!border-gray-600 dark:!bg-gray-800 dark:hover:!bg-blue-900/30"
          title="Закрыть редактор отрезков"
          type="button"
          variant="outline"
          onClick={handleFinish}
        >
          <Icon className="h-3.5 w-3.5" name="x" />
        </Button>
      </div>
    </div>
  );
}
