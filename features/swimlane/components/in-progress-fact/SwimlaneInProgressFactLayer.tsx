'use client';

import type { SwimlaneInProgressFactSegment } from '@/features/swimlane/utils/mergeInProgressDurationsForAssignee';
import type { Developer, Task } from '@/types';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

import { useLayoutEffect } from 'react';
import Xarrow from 'react-xarrows';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { ZIndex } from '@/constants';
import { SWIMLANE_FACT_ROW_RIGHT_INSET_PX } from '@/features/swimlane/utils/in-progress-fact/swimlaneInProgressFactLayerConstants';
import {
  buildArrowPairsForSameTask,
  buildLanes,
  buildWithPhases,
  hexToRgbaArrow,
} from '@/features/swimlane/utils/in-progress-fact/swimlaneInProgressFactLayerHelpers';
import {
  getSwimlaneInProgressFactLayerHeightPx,
  SWIMLANE_IN_PROGRESS_FACT_BOTTOM_INSET_PX,
  SWIMLANE_IN_PROGRESS_LANE_ROW_HEIGHT,
} from '@/features/swimlane/utils/mergeInProgressDurationsForAssignee';
import {
  dateTimeToFractionalCellInRange,
  OCCUPANCY_FACT_PHASE_GAP_PX,
  PHASE_ROW_INSET_PX,
  TOTAL_PARTS,
} from '@/lib/planner-timeline';
import { getPhaseLinkArrowDefaultHex } from '@/utils/statusColors';

import { SwimlaneFactLaneFlexRow } from './SwimlaneFactLaneFlexRow';

export { swimlaneFactBarElementId } from '@/features/swimlane/utils/in-progress-fact/swimlaneInProgressFactLayerHelpers';

interface SwimlaneInProgressFactLayerProps {
  assigneeRole: Developer['role'];
  changelogsByTaskId: Map<string, ChangelogEntry[]>;
  commentsByTaskId: Map<string, IssueComment[]>;
  developerMap: Map<string, Developer>;
  layerId: string;
  segments: SwimlaneInProgressFactSegment[];
  sprintStartDate: Date;
  /** Задачи, отображаемые карточками на этой строке — для них в тултипе факта не дублируем KEY: name */
  swimlaneRowTaskIds: Set<string>;
  tasksMap: Map<string, Task>;
  /** Подсветка карточки задачи при наведении на соответствующую колбасу факта */
  onFactSegmentHover?: (taskId: string | null) => void;
  /** Подсветка колбасы факта по hover карточки/факта конкретной задачи */
  factHoveredTaskId?: string | null;
  requestArrowRedraw: () => void;
}

/**
 * Таймлайн факта (в работе, ревью, дефект, воронка теста, закрыто): отдельная полоса на задачу; при пересечении — вторая дорожка.
 * Закрытие — маркер с галочкой, как в занятости. Соседние по времени фазы одной задачи — линии слева направо.
 */
export function SwimlaneInProgressFactLayer({
  assigneeRole,
  changelogsByTaskId,
  commentsByTaskId,
  developerMap,
  layerId,
  onFactSegmentHover,
  factHoveredTaskId = null,
  requestArrowRedraw,
  segments,
  sprintStartDate,
  swimlaneRowTaskIds,
  tasksMap,
}: SwimlaneInProgressFactLayerProps) {
  const phaseCardColorScheme = usePhaseCardColorScheme();
  const totalParts = TOTAL_PARTS;
  const toCell = (d: Date) => dateTimeToFractionalCellInRange(sprintStartDate, d, totalParts);
  const nowCell = Math.min(toCell(new Date()), totalParts);
  const timelineStartCell = 0;
  const spanCells = nowCell - timelineStartCell;
  const leftPercent = (timelineStartCell / totalParts) * 100;
  const widthPercent = spanCells > 0 ? (spanCells / totalParts) * 100 : 0;

  const totalLayerHeight = getSwimlaneInProgressFactLayerHeightPx(segments);
  const factBottomInset = SWIMLANE_IN_PROGRESS_FACT_BOTTOM_INSET_PX;
  const lanesInnerHeight = Math.max(0, totalLayerHeight - factBottomInset);
  const laneRowHeight = SWIMLANE_IN_PROGRESS_LANE_ROW_HEIGHT;
  const laneStackGap = OCCUPANCY_FACT_PHASE_GAP_PX;

  const withPhases =
    segments.length === 0 || spanCells <= 0
      ? []
      : buildWithPhases(segments, sprintStartDate, nowCell, timelineStartCell, totalParts);

  const arrowPairs =
    withPhases.length === 0 ? [] : buildArrowPairsForSameTask(withPhases, layerId);
  const lanes = withPhases.length === 0 ? [] : buildLanes(withPhases);
  const arrowPairsKey = arrowPairs.map((p) => `${p.from}->${p.to}`).join('|');

  useLayoutEffect(() => {
    if (arrowPairsKey.length === 0) return;
    const id = requestAnimationFrame(() => requestArrowRedraw());
    return () => cancelAnimationFrame(id);
  }, [arrowPairsKey, requestArrowRedraw, segments, layerId, withPhases.length]);

  if (segments.length === 0 || spanCells <= 0 || withPhases.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute left-0 right-0 bottom-0 pointer-events-none z-[1]"
      style={{ height: totalLayerHeight }}
    >
      <div
        className="absolute flex pointer-events-none"
        style={{
          left: `calc(${leftPercent}% + ${PHASE_ROW_INSET_PX}px)`,
          bottom: factBottomInset,
          width: `max(0px, calc(${widthPercent}% - ${PHASE_ROW_INSET_PX}px - ${SWIMLANE_FACT_ROW_RIGHT_INSET_PX}px))`,
          height: lanesInnerHeight,
        }}
      >
        <div className="relative flex-1 min-w-0">
          {arrowPairs.length > 0 && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-visible"
              style={{ zIndex: ZIndex.base }}
            >
              {arrowPairs.map((pair) => {
                const task = tasksMap.get(pair.taskId);
                const hex = getPhaseLinkArrowDefaultHex(
                  phaseCardColorScheme,
                  task?.originalStatus,
                  task?.statusColorKey
                );
                return (
                <Xarrow
                  key={`${pair.from}->${pair.to}`}
                  animateDrawing={false}
                  color={hexToRgbaArrow(hex, 0.55)}
                  curveness={0.42}
                  dashness={false}
                  end={pair.to}
                  endAnchor="left"
                  path="smooth"
                  showHead={false}
                  showTail={false}
                  start={pair.from}
                  startAnchor="right"
                  strokeWidth={2}
                />
                );
              })}
            </div>
          )}

          {lanes.map((laneItems, laneIndex) => (
            <div
              key={`${layerId}-lane-${laneIndex}`}
              className="absolute left-0 right-0 flex items-stretch"
              style={{
                bottom: laneIndex * (laneRowHeight + laneStackGap),
                height: laneRowHeight,
                zIndex: ZIndex.contentOverlay,
              }}
            >
              <SwimlaneFactLaneFlexRow
                assigneeRole={assigneeRole}
                changelogsByTaskId={changelogsByTaskId}
                commentsByTaskId={commentsByTaskId}
                developerMap={developerMap}
                laneItems={laneItems}
                laneRowHeight={laneRowHeight}
                layerId={layerId}
                spanCells={spanCells}
                swimlaneRowTaskIds={swimlaneRowTaskIds}
                tasksMap={tasksMap}
                timelineStartCell={timelineStartCell}
                factHoveredTaskId={factHoveredTaskId}
                onFactSegmentHover={onFactSegmentHover}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
