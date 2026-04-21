import type { TaskResizeParams } from '@/features/task/hooks/useTaskResize';
import type { OccupancyErrorReason } from '@/lib/planner-timeline';
import type { Developer, PhaseSegment, Task, TaskPosition } from '@/types';
import type { Dispatch, MouseEvent, SetStateAction } from 'react';

export interface TaskLayerProps {
  activeDraggableId?: string | null;
  activeTask: Task | null;
  activeTaskDuration: number | null;
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId: string | null;
  currentCell: number;
  developers: Developer[];
  errorReasons?: Map<string, OccupancyErrorReason[]>;
  errorTaskIds?: Set<string>;
  factHoveredTaskId?: string | null;
  globalNameFilter?: string;
  hasTaskOverlaps: boolean;
  hoverConnectedTaskIds?: Set<string> | null;
  hoveredCell: { assigneeId: string; day: number; part: number } | null;
  hoveredTaskId?: string | null;
  isDark: boolean;
  /** Синхронизация с MobX: подсветка превью только во время активного drag */
  isDraggingTask?: boolean;
  layerHeight: number;
  positionedTasks: Array<{ task: Task; position: TaskPosition }>;
  qaTasksMap?: Map<string, Task>;
  segmentEditTaskId?: string | null;
  selectedSprintId?: number | null;
  selectedTaskId?: string | null;
  taskLayerMap: Map<string, number>;
  taskPositions: Map<string, TaskPosition>;
  /** Всего частей дня в таймлайне (рабочие дни × части дня) */
  timelineTotalParts: number;
  totalHeight: number;
  onContextMenu?: (e: MouseEvent, task: Task) => void;
  onCreateQATask?: (taskId: string, anchorRect?: DOMRect) => void;
  onSegmentEditCancel?: () => void;
  onSegmentEditSave?: (position: TaskPosition, segments: PhaseSegment[], isQa: boolean) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskHover?: (taskId: string | null) => void;
  onTaskResize: (taskId: string, params: TaskResizeParams) => void;
  requestArrowRedraw: () => void;
}

export type TaskLayerPositionedTaskItemProps = Omit<TaskLayerProps, 'positionedTasks'> & {
  position: TaskPosition;
  segmentEditDraftCells: boolean[] | null;
  setSegmentEditDraftCells: Dispatch<SetStateAction<boolean[] | null>>;
  task: Task;
};
