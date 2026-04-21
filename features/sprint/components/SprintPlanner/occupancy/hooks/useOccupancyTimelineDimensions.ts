'use client';

import type { OccupancyTimelineScale } from '@/hooks/useLocalStorage';

import { useMemo, type RefObject } from 'react';

import { OCCUPANCY_HEADER_ROW_HEIGHT_PX } from '../components/table/OccupancyTableHeader';
import { resolveOccupancyTimelineWidths } from '../occupancyViewHelpers';

import { useOccupancyTableLayout } from './useOccupancyTableLayout';

export function useOccupancyTimelineDimensions({
  displayAsWeeks,
  displayColumnCount,
  plannerSidebarOpen,
  plannerSidebarWidth,
  quarterlyPhaseStyle,
  sprintCount,
  tableScrollRef,
  taskColumnWidth,
  timelineScale,
  workingDays,
}: {
  displayAsWeeks: boolean;
  displayColumnCount: number;
  plannerSidebarOpen: boolean;
  plannerSidebarWidth: number;
  quarterlyPhaseStyle: boolean;
  sprintCount: number;
  tableScrollRef: RefObject<HTMLDivElement | null>;
  taskColumnWidth: number;
  timelineScale: OccupancyTimelineScale;
  workingDays: number;
}) {
  const {
    dayColumnWidth: baseDayColumnWidth,
    tableWidth: baseTableWidth,
    timelinePartWidth,
  } = useOccupancyTableLayout({
    tableScrollRef,
    taskColumnWidth,
    timelineScale,
    plannerSidebarOpen,
    plannerSidebarWidth,
    workingDaysCount: workingDays,
  });

  const { dayColumnWidth, tableWidth } = useMemo(
    () =>
      resolveOccupancyTimelineWidths({
        baseDayColumnWidth,
        baseTableWidth,
        displayAsWeeks,
        displayColumnCount,
        quarterlyPhaseStyle,
        sprintCount,
        taskColumnWidth,
        timelinePartWidth,
        workingDays,
      }),
    [
      baseDayColumnWidth,
      baseTableWidth,
      displayAsWeeks,
      displayColumnCount,
      quarterlyPhaseStyle,
      sprintCount,
      taskColumnWidth,
      timelinePartWidth,
      workingDays,
    ]
  );

  const headerHeight = sprintCount > 1 ? 82 : OCCUPANCY_HEADER_ROW_HEIGHT_PX;

  return {
    dayColumnWidth,
    headerHeight,
    tableWidth,
  };
}
