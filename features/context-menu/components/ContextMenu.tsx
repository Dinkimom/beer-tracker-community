'use client';

import type { Task, TaskPosition } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { ZIndex } from '@/constants';
import { EstimateSubmenu } from '@/features/context-menu/components/EstimateSubmenu';
import { SprintSubmenu } from '@/features/context-menu/components/SprintSubmenu';
import { StatusSubmenu } from '@/features/context-menu/components/StatusSubmenu';
import { getPositionEffectiveDuration } from '@/features/sprint/utils/occupancyUtils';
import { getTaskTrackerDisplayKey, getTaskTrackerIssueUrl } from '@/features/task/utils/taskUtils';
import { useThemeStorage } from '@/hooks/useLocalStorage';
import { timeslotsToStoryPoints } from '@/lib/pointsUtils';
import { copyTextToClipboard } from '@/utils/copyToClipboard';

import { CONTEXT_MENU_SEPARATOR } from '../contextMenuClasses';

import { ContextMenuActions } from './ContextMenu/components/ContextMenuActions';
import { ContextMenuLoading } from './ContextMenu/components/ContextMenuLoading';
import { useContextMenu } from './ContextMenu/hooks/useContextMenu';

interface ContextMenuProps {
  /** Якорь у карточки задачи — меню строится от границ карточки, не от курсора */
  anchorRect?: Pick<DOMRect, 'bottom' | 'height' | 'left' | 'right' | 'top' | 'width'> | null;
  currentSprintId: number | null;
  /** Скрыть пункт «Удалить из плана» (например, при открытии меню по клику по строке в occupancy) */
  hideRemoveFromPlan?: boolean;
  // Обработчик для учета работы
  isBacklogTask?: boolean;
  /** В режиме канбана скрываем переключение статусов и удаление из плана */
  isKanbanView?: boolean;
  position: { x: number; y: number };
  sprints: SprintListItem[];
  task: Task; // Флаг для задач бэклога
  taskPositions?: Map<string, TaskPosition>;
  onAccountWork?: (task: Task) => void;
  onChangeAssignee?: (task: Task) => void;
  onClose: () => void;
  onCloseByClickOutside?: () => void;
  onEstimateUpdateSuccess?: () => void;
  onMoveToSprint: (taskId: string, sprintId: number) => Promise<void>;
  onRemoveFromPlan?: (taskId: string) => void;
  onRemoveFromSprint: (taskId: string) => Promise<void>;
  onSplitPhaseIntoSegments?: (task: Task) => void;
  onStatusChange: (taskId: string, transitionId: string, targetStatusKey?: string, targetStatusDisplay?: string, screenId?: string) => Promise<void>;
  onUpdateEstimate?: (task: Task, newEstimate: number, isTestPoints: boolean) => void;
}

export function ContextMenu({
  task,
  sprints,
  currentSprintId,
  position,
  anchorRect = null,
  onClose,
  onStatusChange,
  onMoveToSprint,
  onRemoveFromPlan,
  onRemoveFromSprint,
  onSplitPhaseIntoSegments,
  onAccountWork,
  onChangeAssignee,
  onUpdateEstimate,
  onEstimateUpdateSuccess,
  onCloseByClickOutside,
  taskPositions,
  hideRemoveFromPlan = false,
  isBacklogTask = false,
  isKanbanView = false,
}: ContextMenuProps) {
  useThemeStorage(); // Используется для синхронизации темы, но переменная не нужна

  // Пункт «Изменить статус» показываем и для QA-задач (меняем статус самой QA-задачи).
  const showStatusSubmenu = !isBacklogTask && !isKanbanView;
  // «Перенести в спринт» — и для QA-строк (в т.ч. только TP / 0 SP), раньше скрывали всех team === 'QA'.
  const showSprintSubmenu = (sprints?.length ?? 0) > 0;
  const showEstimateSubmenu = taskPositions != null && !isBacklogTask && !isKanbanView;

  const {
    menuRef,
    statusButtonRef,
    sprintButtonRef,
    estimateButtonRef,
    isLoading,
    isStatusMenuOpen,
    isSprintMenuOpen,
    isEstimateMenuOpen,
    availableSprints,
    DialogComponent,
    handleStatusMenuToggle,
    handleSprintMenuToggle,
    handleEstimateMenuToggle,
    handleStatusSelect,
    handleSprintSelect,
    handleRemoveFromPlan,
    handleRemoveFromSprint,
  } = useContextMenu({
    task,
    sprints,
    currentSprintId,
    position,
    anchorRect,
    onClose,
    onStatusChange,
    onMoveToSprint,
    onRemoveFromPlan,
    onRemoveFromSprint,
    onCloseByClickOutside,
    isBacklogTask,
  });

  const sprintSectionVisible = availableSprints.length > 0 && showSprintSubmenu;
  /** Строки статуса / спринта / оценки между шапкой и блоком ContextMenuActions */
  const hasSubmenusAboveActions =
    showStatusSubmenu || sprintSectionVisible || showEstimateSubmenu;

  // Вычисляем предлагаемую оценку на основе текущей длительности фазы
  const taskPosition = taskPositions?.get(task.id);
  const taskDuration = taskPosition ? getPositionEffectiveDuration(taskPosition) : 0;
  const suggestedEstimate = timeslotsToStoryPoints(taskDuration);

  return (
    <>
      {/* Прозрачный бэкдроп на всю страницу: блокирует интеракцию и закрывает меню по клику */}
      <div
        aria-hidden
        className="fixed inset-0 bg-transparent"
        style={{ zIndex: ZIndex.contextMenu - 1 }}
        onClick={(e) => {
          e.stopPropagation();
          // Закрываем меню без подавления «следующего клика», чтобы оно открывалось с первого клика
          onClose();
        }}
      />
      <div
        ref={menuRef}
        className="fixed w-max min-w-[220px] max-w-[min(20rem,calc(100vw-2rem))] overflow-visible rounded-lg border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-800"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          zIndex: ZIndex.contextMenu,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          aria-label="Буфер обмена"
          className="flex items-stretch justify-end gap-1 border-b border-gray-100 px-2 py-2 dark:border-gray-700"
          role="group"
        >
          <Button
            aria-label="Скопировать ключ задачи"
            className="inline-flex min-h-11 min-w-[52px] flex-col gap-0.5 border-0 bg-transparent px-1.5 py-1 text-gray-500 shadow-none hover:!bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:!bg-gray-700 dark:hover:text-gray-100"
            title="Скопировать ключ задачи"
            type="button"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              void copyTextToClipboard(getTaskTrackerDisplayKey(task), 'Ключ задачи скопирован');
            }}
          >
            <Icon className="h-4 w-4 shrink-0" name="copy" />
            <span className="max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight text-gray-500 dark:text-gray-400">
              Ключ
            </span>
          </Button>
          <Button
            aria-label="Скопировать ссылку на задачу в трекере"
            className="inline-flex min-h-11 min-w-[52px] flex-col gap-0.5 border-0 bg-transparent px-1.5 py-1 text-gray-500 shadow-none hover:!bg-gray-50 hover:text-gray-800 dark:text-gray-400 dark:hover:!bg-gray-700 dark:hover:text-gray-100"
            title="Скопировать ссылку на задачу"
            type="button"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              void copyTextToClipboard(getTaskTrackerIssueUrl(task), 'Ссылка скопирована');
            }}
          >
            <Icon className="h-4 w-4 shrink-0" name="link" />
            <span className="max-w-[4.5rem] truncate text-center text-[10px] font-medium leading-tight text-gray-500 dark:text-gray-400">
              Ссылка
            </span>
          </Button>
        </div>
        {/* Изменить статус — не показываем для бэклога и в режиме канбана */}
        {showStatusSubmenu && (
          <StatusSubmenu
            buttonRef={statusButtonRef}
            isLoading={isLoading}
            isOpen={isStatusMenuOpen}
            menuRef={menuRef}
            task={task}
            taskIdForActions={task.id}
            onSelect={handleStatusSelect}
            onToggle={handleStatusMenuToggle}
          />
        )}

        {/* Добавить в спринт / Перенести в другой спринт - не показываем для QA задач */}
        {availableSprints.length > 0 && showSprintSubmenu && (
          <>
            {!isBacklogTask && showStatusSubmenu && (
              <div className={CONTEXT_MENU_SEPARATOR} role="separator" />
            )}
            <SprintSubmenu
              buttonRef={sprintButtonRef}
              currentSprintId={currentSprintId}
              isBacklogTask={isBacklogTask || false}
              isLoading={isLoading}
              isOpen={isSprintMenuOpen}
              menuRef={menuRef}
              sprints={sprints}
              onSelect={handleSprintSelect}
              onToggle={handleSprintMenuToggle}
            />
          </>
        )}

        {/* Изменить оценку — в режиме занятости/свимлейнов для любой задачи в плане (не только при наличии фазы) */}
        {showEstimateSubmenu && (
          <>
            {(showStatusSubmenu || (availableSprints.length > 0 && showSprintSubmenu)) && (
              <div className={CONTEXT_MENU_SEPARATOR} role="separator" />
            )}
            <EstimateSubmenu
              buttonRef={estimateButtonRef}
              isLoading={isLoading}
              isOpen={isEstimateMenuOpen}
              menuRef={menuRef}
              suggestedEstimate={suggestedEstimate}
              task={task}
              onClose={onClose}
              onSuccess={() => {
                onEstimateUpdateSuccess?.();
              }}
              onToggle={handleEstimateMenuToggle}
              onUpdateEstimate={onUpdateEstimate}
            />
          </>
        )}

        <ContextMenuActions
          currentSprintId={currentSprintId}
          hasPosition={!!taskPositions?.has(task.id)}
          hasSubmenusAboveActions={hasSubmenusAboveActions}
          hideRemoveFromPlan={hideRemoveFromPlan}
          isBacklogTask={isBacklogTask}
          isKanbanView={isKanbanView}
          isLoading={isLoading}
          task={task}
          taskPosition={taskPosition ?? undefined}
          onAccountWork={onAccountWork}
          onChangeAssignee={onChangeAssignee}
          onClose={onClose}
          onRemoveFromPlan={handleRemoveFromPlan}
          onRemoveFromSprint={handleRemoveFromSprint}
          onSplitPhaseIntoSegments={onSplitPhaseIntoSegments}
        />

        <ContextMenuLoading isLoading={isLoading} />
      </div>
      {/* Диалог подтверждения */}
      {DialogComponent}
    </>
  );
}
