'use client';

import type { PositionPreview } from '../components/task-row/plan/occupancyPhaseBar.types';
import type { Developer, Task, TaskPosition } from '@/types';

import { useCallback, useEffect, useRef, useState } from 'react';

import { PARTS_PER_DAY } from '@/constants';
import { getCombinedPhaseCellRange } from '@/features/sprint/utils/occupancyUtils';
import { formatOccupancyErrorTooltip } from '@/features/sprint/utils/occupancyValidation';
import { isEffectivelyQaTask } from '@/features/task/utils/taskUtils';

import {
  cellToPosition,
  PHASE_BAR_HEIGHT_COMPACT_PX,
  PHASE_BAR_HEIGHT_PX,
  PHASE_BAR_TOP_OFFSET_COMPACT_PX,
  PHASE_BAR_TOP_OFFSET_PX,
} from '../components/task-row/plan/occupancyPhaseBarConstants';

const DAYS_PER_WEEK = 5;

export interface UseOccupancyTaskRowStateParams {
  assignee?: Developer;
  assigneeIdToTaskPositions?: Map<string, Array<{ taskId: string; position: TaskPosition }>>;
  cellsPerDay?: 1 | 3;
  displayAsWeeks?: boolean;
  displayColumnCount?: number;
  /** Компактный режим — фазы ниже по высоте */
  legacyCompactLayout?: boolean;
  linkingFromTaskId?: string | null;
  occupancyErrorReasons: Map<string, string[]>;
  planRowHeight: number;
  position?: TaskPosition;
  qaAssignee?: Developer;
  qaPosition?: TaskPosition;
  qaTask?: Task;
  sourceRowEndCell?: number | null;
  sourceRowPhaseIds?: Set<string> | null;
  task: Task;
  taskLinks?: Array<{ fromTaskId: string; toTaskId: string; id: string }>;
  totalParts: number;
  workingDays?: number;
  handleEmptyCellClick: (
    targetTask: Task,
    dayIndex: number,
    partIndex: number,
    cellElement: HTMLElement,
    getAnchorRect?: (cell: HTMLElement) => DOMRect
  ) => void;
  handlePositionPreview: (taskId: string, preview: PositionPreview | null) => void;
  onPositionSave?: (position: TaskPosition, isQa: boolean, devTaskKey?: string) => Promise<void> | void;
}

export interface UseOccupancyTaskRowStateResult {
  assigneeOtherPositions: TaskPosition[];
  effectiveColSpan: number;
  effectivelyQa: boolean;
  hoveredCell: { taskId: string; dayIndex: number; partIndex: number } | null;
  linkAlreadyExistsFromSource: boolean;
  linkedQaPreviewStart: number | null;
  mainTask: Task;
  phaseBarHeightPx: number;
  phaseBarTopOffsetPx: number;
  planPhasesRef: React.RefObject<HTMLDivElement | null>;
  qaAssigneeOtherPositions: TaskPosition[];
  validTargetByTime: boolean;
  fromWeekPosition: (pos: TaskPosition) => TaskPosition;
  getErrorTooltip: (taskId: string) => string;
  handleDevPositionSave: (p: TaskPosition) => Promise<void>;
  handleDevPreviewChange: (preview: PositionPreview | null) => void;
  setHoveredCellBatched: (cell: { taskId: string; dayIndex: number; partIndex: number } | null) => void;
  toWeekPosition: (pos: TaskPosition) => TaskPosition;
  wrappedHandleEmptyCellClick: (
    targetTask: Task,
    dayIndex: number,
    partIndex: number,
    cellElement: HTMLElement
  ) => void;
}

export function useOccupancyTaskRowState(
  params: UseOccupancyTaskRowStateParams
): UseOccupancyTaskRowStateResult {
  const {
    task,
    qaTask,
    position,
    qaPosition,
    assignee,
    qaAssignee,
    assigneeIdToTaskPositions,
    totalParts: totalPartsParam,
    displayAsWeeks = false,
    displayColumnCount,
    workingDays = 10,
    planRowHeight,
    occupancyErrorReasons,
    legacyCompactLayout = false,
    cellsPerDay = 3,
    linkingFromTaskId = null,
    sourceRowPhaseIds = null,
    sourceRowEndCell = null,
    taskLinks = [],
    handlePositionPreview,
    onPositionSave,
    handleEmptyCellClick,
  } = params;

  const [hoveredCell, setHoveredCell] = useState<{
    taskId: string;
    dayIndex: number;
    partIndex: number;
  } | null>(null);
  const pendingHoverRef = useRef<{
    taskId: string;
    dayIndex: number;
    partIndex: number;
  } | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const planPhasesRef = useRef<HTMLDivElement | null>(null);
  const [linkedQaPreviewStart, setLinkedQaPreviewStart] = useState<number | null>(null);

  const TOTAL_PARTS = totalPartsParam;
  const phaseBarHeightPx = legacyCompactLayout ? PHASE_BAR_HEIGHT_COMPACT_PX : PHASE_BAR_HEIGHT_PX;
  const phaseBarTopOffsetPx = legacyCompactLayout ? PHASE_BAR_TOP_OFFSET_COMPACT_PX : PHASE_BAR_TOP_OFFSET_PX;

  const setHoveredCellBatched = useCallback((cell: { taskId: string; dayIndex: number; partIndex: number } | null) => {
    if (cell === null) {
      pendingHoverRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setHoveredCell(null);
      return;
    }
    pendingHoverRef.current = cell;
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        setHoveredCell(pendingHoverRef.current);
      });
    }
  }, []);

  useEffect(() => () => {
    if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
  }, []);

  const effectiveColSpan =
    displayAsWeeks && displayColumnCount != null ? displayColumnCount : workingDays;

  const toWeekPosition = useCallback(
    (pos: TaskPosition): TaskPosition => {
      if (!displayAsWeeks) return pos;
      const durationInDays = cellsPerDay === 1 ? pos.duration : pos.duration / PARTS_PER_DAY;
      return {
        ...pos,
        startDay: Math.floor(pos.startDay / DAYS_PER_WEEK),
        startPart: 0,
        duration: Math.max(1, Math.ceil(durationInDays / DAYS_PER_WEEK)),
      };
    },
    [displayAsWeeks, cellsPerDay]
  );

  const fromWeekPosition = useCallback(
    (pos: TaskPosition): TaskPosition => {
      if (!displayAsWeeks) return pos;
      return {
        ...pos,
        startDay: pos.startDay * DAYS_PER_WEEK,
        startPart: 0,
        duration:
          pos.duration * DAYS_PER_WEEK * (cellsPerDay === 1 ? 1 : PARTS_PER_DAY),
      };
    },
    [displayAsWeeks, cellsPerDay]
  );

  const getErrorTooltip = useCallback(
    (taskId: string) => {
      return formatOccupancyErrorTooltip(
        occupancyErrorReasons.get(taskId) as Parameters<typeof formatOccupancyErrorTooltip>[0]
      );
    },
    [occupancyErrorReasons]
  );

  const handleDevPreviewChange = useCallback(
    (preview: PositionPreview | null) => {
      handlePositionPreview(task.id, preview);
      if (!qaPosition || !preview) {
        setLinkedQaPreviewStart(null);
        return;
      }
      const qaOriginalStart = qaPosition.startDay * PARTS_PER_DAY + qaPosition.startPart;
      const newDevEndCell = preview.startDay * PARTS_PER_DAY + preview.startPart + preview.duration;
      if (newDevEndCell > qaOriginalStart) {
        setLinkedQaPreviewStart(
          Math.max(0, Math.min(TOTAL_PARTS - qaPosition.duration, newDevEndCell))
        );
      } else {
        setLinkedQaPreviewStart(null);
      }
    },
    [qaPosition, handlePositionPreview, task.id, TOTAL_PARTS]
  );

  const handleDevPositionSave = useCallback(
    async (p: TaskPosition) => {
      await onPositionSave?.(p, false);
      setLinkedQaPreviewStart(null);
      if (!qaPosition || !qaTask) return;
      const qaOriginalStart = qaPosition.startDay * PARTS_PER_DAY + qaPosition.startPart;
      const newDevEndCell = p.startDay * PARTS_PER_DAY + p.startPart + p.duration;
      if (newDevEndCell <= qaOriginalStart) return;
      const newQaStartCell = Math.max(0, Math.min(TOTAL_PARTS - qaPosition.duration, newDevEndCell));
      const { startDay: qaNewStartDay, startPart: qaNewStartPart } = cellToPosition(newQaStartCell);
      await onPositionSave?.(
        {
          ...qaPosition,
          startDay: qaNewStartDay,
          startPart: qaNewStartPart,
          plannedStartDay: qaNewStartDay,
          plannedStartPart: qaNewStartPart,
          plannedDuration: qaPosition.plannedDuration,
        },
        true,
        qaTask.originalTaskId
      );
    },
    [qaPosition, qaTask, onPositionSave, TOTAL_PARTS]
  );

  const wrappedHandleEmptyCellClick = useCallback(
    (targetTask: Task, dayIndex: number, partIndex: number, cellElement: HTMLElement) => {
      const getAnchorRect = (cell: HTMLElement) => {
        const r = cell.getBoundingClientRect();
        return new DOMRect(r.left, r.top, r.width, Math.min(r.height, planRowHeight));
      };
      handleEmptyCellClick(targetTask, dayIndex, partIndex, cellElement, getAnchorRect);
    },
    [handleEmptyCellClick, planRowHeight]
  );

  const linkAlreadyExistsFromSource =
    linkingFromTaskId != null &&
    sourceRowPhaseIds != null &&
    taskLinks.some(
      (l) =>
        sourceRowPhaseIds.has(l.fromTaskId) &&
        (l.toTaskId === task.id || (qaTask != null && l.toTaskId === qaTask.id))
    );

  const combinedPhaseRange =
    position || qaPosition
      ? getCombinedPhaseCellRange(position, qaPosition, qaTask)
      : null;
  const thisRowMinStartCell = combinedPhaseRange?.startCell ?? Infinity;
  const validTargetByTime = sourceRowEndCell == null || thisRowMinStartCell >= sourceRowEndCell;

  const assigneeOtherPositions =
    assignee && assigneeIdToTaskPositions
      ? (assigneeIdToTaskPositions.get(assignee.id) ?? [])
          .filter((e) => e.taskId !== task.id && e.taskId !== qaTask?.id)
          .map((e) => e.position)
      : [];

  const qaAssigneeOtherPositions =
    qaAssignee && assigneeIdToTaskPositions
      ? (assigneeIdToTaskPositions.get(qaAssignee.id) ?? [])
          .filter((e) => e.taskId !== qaTask?.id && e.taskId !== task.id)
          .map((e) => e.position)
      : [];

  const mainTask = task.originalTaskId ? (qaTask ?? task) : task;
  const effectivelyQa = isEffectivelyQaTask(task);

  return {
    hoveredCell,
    setHoveredCellBatched,
    planPhasesRef,
    linkedQaPreviewStart,
    phaseBarHeightPx,
    phaseBarTopOffsetPx,
    effectiveColSpan,
    toWeekPosition,
    fromWeekPosition,
    getErrorTooltip,
    handleDevPreviewChange,
    handleDevPositionSave,
    wrappedHandleEmptyCellClick,
    linkAlreadyExistsFromSource,
    validTargetByTime,
    assigneeOtherPositions,
    qaAssigneeOtherPositions,
    mainTask,
    effectivelyQa,
  };
}
