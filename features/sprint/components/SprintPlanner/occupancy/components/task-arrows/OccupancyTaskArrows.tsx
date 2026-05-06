'use client';

import type { Task, TaskPosition } from '@/types';

import { useContext, useEffect, useMemo, useState } from 'react';
import Xarrow from 'react-xarrows';

import { usePhaseCardColorScheme } from '@/components/PhaseCardColorSchemeContext';
import { ZIndex } from '@/constants';
import {
  buildOccupancySegmentArrowLinks,
  buildOccupancyDevToQaLinks,
  filterOccupancyUserTaskLinks,
  getOccupancyRowTaskIds,
  getOccupancyTaskPositionsSignature,
  resolveOccupancyArrowEndpoints,
} from '@/features/sprint/components/SprintPlanner/occupancy/utils/task-arrows/occupancyTaskArrowsHelpers';
import { hexToRgbaArrow } from '@/features/swimlane/utils/in-progress-fact/swimlaneInProgressFactLayerHelpers';
import { filterTaskLinksForSegmentEdit, TASK_ARROWS_DEV_QA_LINK_PREFIX } from '@/features/swimlane/utils/task-arrows/taskArrowsHelpers';
import { getPhaseLinkArrowDefaultHex } from '@/utils/statusColors';

import { OccupancyArrowRedrawContext } from '../../OccupancyArrowRedrawContext';
import { useOccupancyArrowsVisibleIds } from '../../OccupancyArrowsVisibilityCtx';

interface OccupancyTaskArrowsProps {
  devToQaTaskId: Map<string, string>;
  hoveredPhaseTaskId: string | null;
  /** Режим добавления связи — без подсветки стрелок от ховера фаз и без ховера для удаления. */
  linkingFromTaskId?: string | null;
  /** ID задачи в режиме редактирования отрезков — связи с этой задачей не показываем */
  segmentEditTaskId?: string | null;
  taskIdsOrder: string[];
  taskLinks: Array<{ fromTaskId: string; toTaskId: string; id: string }>;
  taskPositions: Map<string, TaskPosition>;
  tasksMap: Map<string, Task>;
  onDeleteLink?: (linkId: string) => void;
}

export function OccupancyTaskArrows({
  devToQaTaskId,
  hoveredPhaseTaskId,
  linkingFromTaskId = null,
  segmentEditTaskId = null,
  taskLinks,
  taskIdsOrder,
  taskPositions,
  tasksMap,
  onDeleteLink,
}: OccupancyTaskArrowsProps) {
  const phaseCardColorScheme = usePhaseCardColorScheme();
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);
  const requestArrowRedraw = useContext(OccupancyArrowRedrawContext);
  const visibleIdsCtx = useOccupancyArrowsVisibleIds();
  const positionsSignature = useMemo(
    () => getOccupancyTaskPositionsSignature(taskPositions),
    [taskPositions]
  );

  const visibleTaskIdsRef = visibleIdsCtx?.visibleTaskIds;
  const visibleSignature = visibleTaskIdsRef
    ? Array.from(visibleTaskIdsRef).sort().join(',')
    : '';

  useEffect(() => {
    if (!requestArrowRedraw) return;
    const id = requestAnimationFrame(() => {
      requestArrowRedraw();
    });
    return () => cancelAnimationFrame(id);
  }, [positionsSignature, segmentEditTaskId, visibleSignature, requestArrowRedraw]);

  useEffect(() => {
    if (linkingFromTaskId != null) setHoveredLinkId(null);
  }, [linkingFromTaskId]);

  const userLinks = filterOccupancyUserTaskLinks(taskLinks, taskIdsOrder, devToQaTaskId);
  const devToQALinks = buildOccupancyDevToQaLinks(
    devToQaTaskId,
    taskPositions,
    taskIdsOrder
  );

  const allLinksRaw = [...userLinks, ...devToQALinks];
  const allLinks = filterTaskLinksForSegmentEdit(allLinksRaw, segmentEditTaskId);
  const segmentArrowLinks = buildOccupancySegmentArrowLinks(taskPositions, taskIdsOrder);

  const getRowTaskIds = useMemo(
    () => (taskId: string) =>
      getOccupancyRowTaskIds(taskId, devToQaTaskId, taskPositions, tasksMap),
    [devToQaTaskId, taskPositions, tasksMap]
  );

  if (allLinks.length === 0 && segmentArrowLinks.length === 0) return null;

  return (
    <div
      aria-hidden
      className="absolute inset-0 overflow-hidden pointer-events-none"
      style={{ zIndex: ZIndex.contentOverlay }}
    >
      {segmentArrowLinks.map((link) => {
        const task = tasksMap.get(link.taskId);
        const baseColor = getPhaseLinkArrowDefaultHex(
          phaseCardColorScheme,
          task?.originalStatus,
          task?.statusColorKey
        );
        const bothEndsVisible =
          visibleIdsCtx == null || visibleIdsCtx.visibleTaskIds.has(link.taskId);
        if (!bothEndsVisible) return null;

        return (
          <Xarrow
            key={link.id}
            animateDrawing={false}
            color={hexToRgbaArrow(baseColor, 0.5)}
            curveness={0.3}
            dashness
            end={link.endElement}
            endAnchor="left"
            headSize={4}
            path="smooth"
            start={link.startElement}
            startAnchor="right"
            strokeWidth={2}
            zIndex={ZIndex.contentOverlay}
          />
        );
      })}
      {allLinks.map((link) => {
        const fromTask = tasksMap.get(link.fromTaskId);
        const isDevQALink = link.id.startsWith(TASK_ARROWS_DEV_QA_LINK_PREFIX);
        const isHovered = hoveredLinkId === link.id;
        const isRelatedToHoveredPhase =
          linkingFromTaskId == null &&
          hoveredPhaseTaskId != null &&
          (link.fromTaskId === hoveredPhaseTaskId || link.toTaskId === hoveredPhaseTaskId);
        const canDelete = onDeleteLink && !isDevQALink;
        const arrowPointerEventsEnabled = linkingFromTaskId == null;
        const baseColor =
          arrowPointerEventsEnabled && isHovered && canDelete
            ? '#ef4444'
            : getPhaseLinkArrowDefaultHex(
                phaseCardColorScheme,
                fromTask?.originalStatus,
                fromTask?.statusColorKey
              );
        const opacity = isHovered || isRelatedToHoveredPhase ? 1 : 0.5;
        const arrowColor = hexToRgbaArrow(baseColor, opacity);

        const { arrowEndTaskId, arrowStartTaskId, endAnchor, endElement } =
          resolveOccupancyArrowEndpoints(
            link,
            isDevQALink,
            taskIdsOrder,
            taskPositions,
            getRowTaskIds
          );

        const bothEndsVisible =
          visibleIdsCtx == null ||
          (visibleIdsCtx.visibleTaskIds.has(arrowStartTaskId) &&
            visibleIdsCtx.visibleTaskIds.has(arrowEndTaskId));
        if (!bothEndsVisible) return null;

        return (
          <div
            key={link.id}
            className={arrowPointerEventsEnabled ? 'pointer-events-auto' : 'pointer-events-none'}
            style={{
              cursor:
                arrowPointerEventsEnabled && canDelete && isHovered ? 'pointer' : 'default',
            }}
            onClick={() =>
              arrowPointerEventsEnabled && canDelete && isHovered && onDeleteLink?.(link.id)
            }
            onMouseEnter={() =>
              arrowPointerEventsEnabled && canDelete && setHoveredLinkId(link.id)
            }
            onMouseLeave={() => arrowPointerEventsEnabled && setHoveredLinkId(null)}
          >
            <Xarrow
              animateDrawing={false}
              color={arrowColor}
              curveness={0.3}
              dashness={false}
              end={endElement}
              endAnchor={endAnchor}
              headSize={4}
              path="smooth"
              start={`occupancy-end-${arrowStartTaskId}`}
              startAnchor="right"
              strokeWidth={2}
              zIndex={ZIndex.contentOverlay}
            />
          </div>
        );
      })}
    </div>
  );
}
