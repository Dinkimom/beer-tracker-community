import type { SprintInfo, TimelineSettings } from './components/table/OccupancyTableHeader';
import type { OccupancyRowFieldsVisibility, OccupancyTimelineScale } from '@/hooks/useLocalStorage';
import type { OccupancyTaskOrder } from '@/lib/beerTrackerApi';
import type { Comment, Developer, Task, TaskPosition } from '@/types';
import type { QuarterlyAvailability } from '@/types/quarterly';
import type { ChecklistItem } from '@/types/tracker';
import type { MouseEvent } from 'react';

export type { SprintInfo };

/** Заметки и их отображение в планировщике занятости. */
export interface OccupancyViewCommentsConfig {
  comments?: Comment[];
  commentsVisible?: boolean;
  openCommentEditId?: string | null;
}

/** Раскладка колонок, сайдбара и режимов отображения таймлайна. */
export interface OccupancyViewLayoutConfig {
  cellsPerDay?: 1 | 3;
  legacyCompactLayout?: boolean;
  plannerSidebarOpen?: boolean;
  plannerSidebarWidth?: number;
  quarterlyPhaseStyle?: boolean;
  rowFieldsVisibility?: OccupancyRowFieldsVisibility;
  timelineScale?: OccupancyTimelineScale;
  twoLineDayHeader?: boolean;
}

/** Колбэки взаимодействия с таблицей занятости. */
export interface OccupancyViewCallbacks {
  onAddLink?: (link: { fromTaskId: string; id: string; toTaskId: string }) => void;
  onCommentCreate?: (comment: Comment) => void;
  onCommentDelete?: (id: string) => void;
  onCommentMove?: (
    id: string,
    payload: Partial<{ assigneeId: string; day: number; part: number; taskId: string | null; x: number; y: number }>
  ) => void;
  onCommentPositionUpdate?: (id: string, x: number, y: number, assigneeId?: string) => void;
  onCommentUpdate?: (id: string, text: string) => void;
  onContextMenu?: (e: MouseEvent, task: Task, isBacklogTask?: boolean, hideRemoveFromPlan?: boolean) => void;
  onCreateTaskForParent?: (row: { display: string; id: string; key?: string }) => void;
  onDeleteLink?: (linkId: string) => void;
  onOpenAssigneePicker?: (data: {
    anchorRect: DOMRect;
    position: TaskPosition;
    task: Task;
    taskName: string;
  }) => void;
  onPositionSave?: (position: TaskPosition, isQa: boolean, devTaskKey?: string) => Promise<void> | void;
  onSegmentEditCancel?: () => void;
  onSegmentEditSave?: (
    position: TaskPosition,
    segments: Array<{ duration: number; startDay: number; startPart: number }>,
    isQa: boolean
  ) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskOrderChange?: (order: OccupancyTaskOrder) => void;
}

export interface OccupancyViewProps {
  availability?: QuarterlyAvailability | null;
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  deliveryChecklistItems?: ChecklistItem[];
  developers: Developer[];
  discoveryChecklistItems?: ChecklistItem[];
  factVisible: boolean;
  globalNameFilter?: string;
  linksDimOnHover?: boolean;
  occupancyCallbacks?: OccupancyViewCallbacks;
  occupancyComments?: OccupancyViewCommentsConfig;
  occupancyLayout?: OccupancyViewLayoutConfig;
  parentKeyToPlanPhase?: Map<string, TaskPosition>;
  plannedInSprintMaxStack?: Map<string, number>;
  plannedInSprintPositions?: Map<string, TaskPosition[]>;
  releaseInSprintKeys?: Set<string>;
  segmentEditTaskId?: string | null;
  selectedAssigneeIds?: Set<string>;
  sprintInfos?: SprintInfo[];
  sprintStartDate: Date;
  /** Число рабочих колонок для одного спринта; если задан sprintInfos — не используется. */
  sprintWorkingDaysCount?: number;
  swimlaneLinksVisible?: boolean;
  taskLinks: Array<{ fromTaskId: string; id: string; toTaskId: string }>;
  taskOrder?: OccupancyTaskOrder;

  taskPositions: Map<string, TaskPosition>;
  tasks: Task[];
  timelineSettings: TimelineSettings;
  /**
   * true — фильтр по имени, меню, сегменты и фокус комментария из {@link SprintPlannerUiStore}
   * (основной планер). false/не задано — только пропсы (эпики и внешние встраивания).
   */
  usePlannerUiStore?: boolean;
}
