/**
 * Компонент действий для ContextMenu
 */

import type { Task, TaskPosition } from '@/types';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import {
  CONTEXT_MENU_GHOST_BUTTON_RESET,
  CONTEXT_MENU_ITEM_ROW,
  CONTEXT_MENU_ITEM_ROW_DESTRUCTIVE,
  CONTEXT_MENU_ITEM_ROW_NEUTRAL_HOVER,
  CONTEXT_MENU_SEPARATOR,
} from '@/features/context-menu/contextMenuClasses';

interface ContextMenuActionsProps {
  currentSprintId: number | null;
  hasPosition: boolean;
  /** Между шапкой меню и действиями уже есть строки (статус / спринт / оценка) — нужен разделитель перед первой группой */
  hasSubmenusAboveActions: boolean;
  hideRemoveFromPlan?: boolean;
  isBacklogTask: boolean;
  isKanbanView?: boolean;
  isLoading: boolean;
  task: Task;
  /** Позиция фазы (для «Разбить на отрезки») */
  taskPosition?: TaskPosition | null;
  onAccountWork?: (task: Task) => void;
  onChangeAssignee?: (task: Task) => void;
  onClose: () => void;
  onRemoveFromPlan?: () => void;
  onRemoveFromSprint: () => void;
  /** Открыть редактор отрезков фазы (дробление фазы) */
  onSplitPhaseIntoSegments?: (task: Task) => void;
}

export function ContextMenuActions({
  currentSprintId,
  hasPosition,
  hasSubmenusAboveActions,
  hideRemoveFromPlan = false,
  isLoading,
  isBacklogTask,
  isKanbanView = false,
  task,
  taskPosition,
  onAccountWork,
  onChangeAssignee,
  onClose,
  onRemoveFromPlan,
  onRemoveFromSprint,
  onSplitPhaseIntoSegments,
}: ContextMenuActionsProps) {
  // Учесть работу в этом спринте - не показываем для задач бэклога и сгенерированных QA задач
  const isGeneratedQaTask = task.team === 'QA' && !!task.originalTaskId;
  const showAccountWork = !isBacklogTask && currentSprintId !== null && onAccountWork && !isGeneratedQaTask;

  // Изменить исполнителя — для задач в спринте (в т.ч. без оценки SP/TP и без позиции на плане)
  const showChangeAssignee = !isBacklogTask && onChangeAssignee;

  // Редактировать отрезки — для фазы с позицией длиннее одной трети дня (иначе нечего дробить)
  const effectiveDuration =
    taskPosition?.segments?.length
      ? taskPosition.segments.reduce((s, seg) => s + seg.duration, 0)
      : taskPosition?.duration ?? 0;
  const showSplitPhase =
    hasPosition &&
    taskPosition &&
    onSplitPhaseIntoSegments &&
    !isKanbanView &&
    effectiveDuration > 1;

  // Удалить из плана - не показываем для бэклога, в режиме канбана и при открытии по клику по строке (occupancy)
  const showRemoveFromPlan =
    !hideRemoveFromPlan &&
    !isBacklogTask &&
    !isKanbanView &&
    currentSprintId !== null &&
    onRemoveFromPlan;

  // Убрать из спринта - не показываем для задач бэклога
  const showRemoveFromSprint = !isBacklogTask && currentSprintId !== null;

  if (!showAccountWork && !showChangeAssignee && !showSplitPhase && !showRemoveFromPlan && !showRemoveFromSprint) {
    return null;
  }

  // Группируем действия: обычные действия и деструктивные
  const hasRegularActions = showAccountWork || showChangeAssignee || showSplitPhase;
  const hasDestructiveActions = showRemoveFromPlan || showRemoveFromSprint;
  const showSeparatorBeforeRegular = hasRegularActions && hasSubmenusAboveActions;
  const showSeparatorBeforeDestructive =
    hasDestructiveActions && (hasRegularActions || hasSubmenusAboveActions);

  return (
    <>
      {/* Группа обычных действий */}
      {hasRegularActions && (
        <>
          {showSeparatorBeforeRegular && <div className={CONTEXT_MENU_SEPARATOR} role="separator" />}
          {showAccountWork && (
            <Button
              className={`${CONTEXT_MENU_ITEM_ROW} ${CONTEXT_MENU_ITEM_ROW_NEUTRAL_HOVER} ${CONTEXT_MENU_GHOST_BUTTON_RESET}`}
              disabled={isLoading}
              type="button"
              variant="ghost"
              onClick={() => {
                onAccountWork(task);
                onClose();
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" name="check-circle" />
              <span>Учесть работу в этом спринте</span>
            </Button>
          )}

          {showChangeAssignee && (
            <Button
              className={`${CONTEXT_MENU_ITEM_ROW} ${CONTEXT_MENU_ITEM_ROW_NEUTRAL_HOVER} ${CONTEXT_MENU_GHOST_BUTTON_RESET}`}
              disabled={isLoading}
              type="button"
              variant="ghost"
              onClick={() => {
                onChangeAssignee?.(task);
                onClose();
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" name="user" />
              <span>Изменить исполнителя</span>
            </Button>
          )}

          {showSplitPhase && (
            <Button
              className={`${CONTEXT_MENU_ITEM_ROW} ${CONTEXT_MENU_ITEM_ROW_NEUTRAL_HOVER} ${CONTEXT_MENU_GHOST_BUTTON_RESET}`}
              disabled={isLoading}
              type="button"
              variant="ghost"
              onClick={() => {
                onSplitPhaseIntoSegments?.(task);
                onClose();
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" name="phase-segments" />
              <span>Редактировать отрезки</span>
            </Button>
          )}
        </>
      )}

      {/* Группа деструктивных действий */}
      {hasDestructiveActions && (
        <>
          {showSeparatorBeforeDestructive && <div className={CONTEXT_MENU_SEPARATOR} role="separator" />}
          {showRemoveFromPlan && (
            <Button
              className={`${CONTEXT_MENU_ITEM_ROW_DESTRUCTIVE} ${CONTEXT_MENU_GHOST_BUTTON_RESET}`}
              disabled={isLoading}
              type="button"
              variant="ghost"
              onClick={() => {
                onRemoveFromPlan?.();
              }}
            >
              <Icon className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" name="circle-x" />
              <span>Удалить из плана</span>
            </Button>
          )}

          {showRemoveFromSprint && (
            <Button
              className={`${CONTEXT_MENU_ITEM_ROW_DESTRUCTIVE} ${CONTEXT_MENU_GHOST_BUTTON_RESET}`}
              disabled={isLoading}
              type="button"
              variant="ghost"
              onClick={onRemoveFromSprint}
            >
              <Icon className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" name="trash" />
              <span>Убрать из спринта</span>
            </Button>
          )}
        </>
      )}
    </>
  );
}

