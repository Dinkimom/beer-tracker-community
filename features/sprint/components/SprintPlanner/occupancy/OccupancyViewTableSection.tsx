'use client';

import type { DragEndEvent } from '@dnd-kit/core';
import type { ComponentProps } from 'react';

import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';

import { OccupancyCommentDragOverlay } from './components/other/OccupancyCommentDragOverlay';
import { OccupancyTableBody } from './components/table/OccupancyTableBody';
import { OccupancyTableHeader } from './components/table/OccupancyTableHeader';
import { OccupancyTaskArrows } from './components/task-arrows';

export interface OccupancyViewTableSectionProps {
  bodyProps: ComponentProps<typeof OccupancyTableBody>;
  dayColumnWidth: number | undefined;
  displayColumnCount: number;
  handleTableClickCapture: NonNullable<ComponentProps<'table'>['onClickCapture']>;
  headerProps: ComponentProps<typeof OccupancyTableHeader>;
  tableScrollRef: React.RefObject<HTMLDivElement | null>;
  tableWidth: number | undefined;
  taskArrowsProps: ComponentProps<typeof OccupancyTaskArrows> | null;
  taskColumnWidth: number;
  onDragEnd: (event: DragEndEvent) => void;
}

/**
 * Скролл-область, DnD заметок, таблица занятости и оверлей стрелок связей.
 * Вынесено из {@link OccupancyView}, чтобы снизить когнитивную сложность корневого компонента.
 */
export function OccupancyViewTableSection({
  tableScrollRef,
  onDragEnd,
  tableWidth,
  taskColumnWidth,
  displayColumnCount,
  dayColumnWidth,
  handleTableClickCapture,
  headerProps,
  bodyProps,
  taskArrowsProps,
}: OccupancyViewTableSectionProps) {
  const commentDndSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  return (
    <div
      ref={tableScrollRef}
      className="flex w-full min-w-0 flex-1 flex-col overflow-y-auto overflow-x-auto relative scrollbar-thin-custom scrollbar-gutter-stable"
    >
      <DndContext collisionDetection={closestCenter} sensors={commentDndSensors} onDragEnd={onDragEnd}>
        {/*
          flex-col + align-items stretch (default): обёртка тянется на всю ширину скролл-области.
          min-width: max(100%, tableWidth) — без пустоты справа, если вьюпорт шире расчётной таблицы;
          при узком экране остаётся горизонтальный скролл.
          overflow-x: clip — подрезка без отдельного scroll-container (sticky колонка задач).
        */}
        <div
          className={
            typeof tableWidth === 'number' && tableWidth > 0
              ? 'relative box-border w-full max-w-none shrink-0'
              : 'relative min-w-0'
          }
          style={
            typeof tableWidth === 'number' && tableWidth > 0
              ? {
                  width: '100%',
                  minWidth: `max(100%, ${tableWidth}px)`,
                  overflowX: 'clip' as const,
                }
              : undefined
          }
        >
          <table
            className="border-collapse table-fixed"
            data-occupancy-table
            style={{
              tableLayout: 'fixed',
              ...(typeof tableWidth === 'number' && tableWidth > 0
                ? { width: '100%', minWidth: tableWidth }
                : {}),
            }}
            onClickCapture={handleTableClickCapture}
          >
            <colgroup>
              <col style={{ width: taskColumnWidth, minWidth: taskColumnWidth }} />
              {Array.from({ length: displayColumnCount }, (_, i) => (
                <col
                  key={i}
                  style={
                    dayColumnWidth != null
                      ? { width: dayColumnWidth, minWidth: dayColumnWidth }
                      : undefined
                  }
                />
              ))}
            </colgroup>
            <OccupancyTableHeader {...headerProps} />
            <OccupancyTableBody {...bodyProps} />
          </table>
          <OccupancyCommentDragOverlay />
          {taskArrowsProps != null ? <OccupancyTaskArrows {...taskArrowsProps} /> : null}
        </div>
        <div
          aria-hidden="true"
          className="h-8 w-full shrink-0 border-t border-ds-border-subtle bg-gradient-to-b from-transparent to-white/70 dark:to-gray-800/70"
          style={
            typeof tableWidth === 'number' && tableWidth > 0
              ? { minWidth: `max(100%, ${tableWidth}px)` }
              : undefined
          }
        />
      </DndContext>
    </div>
  );
}
