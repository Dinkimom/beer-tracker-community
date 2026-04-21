import type { SwimlaneInProgressFactSegment } from '@/features/swimlane/utils/mergeInProgressDurationsForAssignee';
import type { TaskResizeParams } from '@/features/task/hooks/useTaskResize';
import type { OccupancyErrorReason } from '@/lib/planner-timeline';
import type { Comment, Developer, LayoutViewMode, PhaseSegment, Task, TaskPosition } from '@/types';
import type { TechSprintEntry, VacationEntry } from '@/types/quarterly';
import type { ChangelogEntry, IssueComment } from '@/types/tracker';

export interface SwimlaneProps {
  activeDraggableId?: string | null;
  activeTask: Task | null;
  activeTaskDuration: number | null;
  /** Доска (нужна для квартального плана отпусков) */
  boardId?: number | null;
  comments: Comment[];
  contextMenuBlurOtherCards?: boolean;
  contextMenuTaskId?: string | null;
  developer: Developer;
  /** Отпуска и техспринты исполнителя из квартального планирования */
  developerAvailability?: { vacations: VacationEntry[]; techSprints: TechSprintEntry[] };
  developers: Developer[];
  // Отключить закрытие сайдбара при клике на свимлейн (полезно для спринт планера)
  disableCloseSidebarOnClick?: boolean;
  /** Причины ошибок по taskId — для тултипа иконки ошибки на баре */
  errorReasons?: Map<string, OccupancyErrorReason[]>;
  /** ID задач, у которых фаза занятости участвует в ошибке планирования — подсветка и иконка на баре */
  errorTaskIds?: Set<string>;
  /** Наведение на сегмент факта (общее состояние секции свимлейнов) — затемнение карточек на всех строках */
  factHoveredTaskId: string | null;
  globalNameFilter?: string;
  /** Индексы дней (0..9), которые являются нерабочими/праздничными */
  holidayDayIndices?: Set<number>;
  /** При наведении на карточку — ID задач, связанных с ней. Остальные карточки затемняются (opacity 0.5). */
  hoverConnectedTaskIds?: Set<string> | null;
  hoveredCell: { assigneeId: string; day: number; part: number } | null;
  hoveredTaskId?: string | null;
  isDraggingTask?: boolean;
  participantsColumnWidth: number;
  qaTasksMap?: Map<string, Task>;
  /** Редактирование отрезков (PhaseSegmentInlineEditor, как в занятости). */
  segmentEditTaskId?: string | null;
  selectedSprintId?: number | null;
  selectedTaskId?: string | null;
  sidebarOpen?: boolean;
  sidebarWidth?: number;
  sprintStartDate: Date;
  /** Рабочих дней в таймлайне (длина спринта) */
  sprintTimelineWorkingDays?: number;
  swimlaneFactChangelogsByTaskId?: Map<string, ChangelogEntry[]>;
  swimlaneFactCommentsByTaskId?: Map<string, IssueComment[]>;
  swimlaneFactDeveloperMap?: Map<string, Developer>;
  /** Показывать полосу факта «В работе» под карточками (как в занятости) */
  swimlaneFactTimelineEnabled?: boolean;
  /** Фазы факта по changelog (зависят от типа задачи): отдельные полосы, при пересечении — разные дорожки */
  swimlaneInProgressDurations?: SwimlaneInProgressFactSegment[];
  taskPositions: Map<string, TaskPosition>;
  /** Список задач исполнителя. В рендере не используется (данные из taskPositions/tasksMap), нужен только для сравнения в React.memo. */
  tasks: Task[];
  /** Карта всех задач доски: по ней в свимлейне считаются только задачи, лежащие на строке (по taskPositions). */
  tasksMap: Map<string, Task>;
  viewMode?: LayoutViewMode;
  onCloseSidebar?: () => void;
  onCommentCreate?: (comment: Comment) => void;
  onCommentDelete?: (id: string) => void;
  onCommentPositionUpdate?: (id: string, x: number, y: number, assigneeId?: string) => void;
  onCommentUpdate?: (id: string, text: string) => void;
  onContextMenu?: (e: React.MouseEvent, task: Task) => void;
  onCreateQATask?: (taskId: string, anchorRect?: DOMRect) => void;
  onFactSegmentHover: (taskId: string | null) => void;
  onSegmentEditCancel?: () => void;
  onSegmentEditSave?: (position: TaskPosition, segments: PhaseSegment[], isQa: boolean) => void;
  onTaskClick?: (taskId: string) => void;
  onTaskHover?: (taskId: string | null) => void;
  onTaskResize: (taskId: string, params: TaskResizeParams) => void;
}
