import type { Task, TaskPosition } from '@/types';

export type PositionPreview = Pick<
  TaskPosition,
  'duration' | 'startDay' | 'startPart'
>;

export interface OccupancyPhaseBarProps {
  assigneeDisplayName?: string | null;
  avatarUrl?: string | null;
  badgeClass?: string;
  barHeight?: number;
  barTopOffset?: number;
  cellsPerDay?: 1 | 3;
  /** Затемнить остальные фазы, когда открыто контекстное меню с якорем (как у карточек). */
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  disableDragAndResize?: boolean;
  elevationAbove?: boolean;
  errorTooltip?: string;
  externalDragStartCell?: number | null;
  forceDevColor?: boolean;
  forceReleaseStyle?: boolean;
  hideExtraDuration?: boolean;
  hideLinkRing?: boolean;
  hoveredErrorTaskId?: string | null;
  initials: string;
  isBlurredBySiblingDrag?: boolean;
  isDimmedByLinkHover?: boolean;
  isInError?: boolean;
  isInHoveredConnectionGroup?: boolean;
  isLinkSource?: boolean;
  isLinkTarget?: boolean;
  isOverlapping?: boolean;
  isQa: boolean;
  originalStatus?: string;
  phaseDateRangeLabel?: string;
  phaseDurationLabel?: string;
  plannedInSprintVariant?: boolean;
  pointerEventsNone?: boolean;
  position: TaskPosition;
  readonly?: boolean;
  /** Несколько отрезков плана — бейдж «i/N» как на карточке свимлейна */
  segmentBadge?: { index: number; total: number } | null;
  segmentEndAnchorId?: string;
  segmentStartAnchorId?: string;
  showEndAnchor?: boolean;
  showPhaseId?: boolean;
  showStartAnchor?: boolean;
  showToolsEmoji?: boolean;
  task: Task;
  taskId: string;
  teamBorder: string;
  teamColor: string;
  teamPlanVariant?: boolean;
  totalParts?: number;
  onCompleteLink?: (toTaskId: string) => void;
  onContextMenu?: (
    e: React.MouseEvent,
    task: Task,
    isBacklogTask?: boolean,
    hideRemoveFromPlan?: boolean
  ) => void;
  onPhaseHoverEnter?: () => void;
  onPhaseHoverLeave?: () => void;
  onPreviewChange?: (preview: PositionPreview | null) => void;
  onSave?: (position: TaskPosition) => void;
}
