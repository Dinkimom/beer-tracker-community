/**
 * Компонент секции модальных окон
 * Отвечает за отображение контекстного меню, модального окна учета работы и диалога подтверждения
 */

import type { BoardViewMode } from '@/hooks/useLocalStorage';
import type { TransitionField } from '@/lib/beerTrackerApi';
import type { Task } from '@/types';
import type { TaskPosition } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { observer } from 'mobx-react-lite';

import { AccountWorkModal } from '@/features/account/components/AccountWorkModal';
import { ContextMenu } from '@/features/context-menu/components/ContextMenu';
import { useRootStore } from '@/lib/layers';

import { TransitionFieldsModal } from './TransitionFieldsModal';

interface ModalsSectionProps {
  DialogComponent: React.ReactNode;
  selectedSprintId: number | null;
  sprints: SprintListItem[];
  taskPositions?: Map<string, TaskPosition>;
  transitionModal?: {
    taskId: string;
    transitionId: string;
    targetStatusKey: string;
    targetStatusDisplay?: string;
    fields: TransitionField[];
    task?: Task;
  } | null;
  viewMode?: BoardViewMode;
  onAccountWork: (data: {
    burnedStoryPoints: number;
    burnedTestPoints: number;
    newTaskTitle: string;
    remainingStoryPoints: number;
    remainingTestPoints: number;
    targetSprintId: number | null;
  }) => Promise<void>;
  onChangeAssignee?: (task: Task) => void;
  onCloseTransitionModal?: () => void;
  onEstimateUpdateSuccess?: () => void;
  onMoveToSprint: (taskId: string, sprintId: number) => Promise<void>;
  onRemoveFromPlan?: (taskId: string) => void;
  onRemoveFromSprint: (taskId: string) => Promise<void>;
  onSplitPhaseIntoSegments?: (task: Task) => void;
  onStatusChange: (taskId: string, transitionId: string, targetStatusKey?: string, targetStatusDisplay?: string, screenId?: string) => Promise<void>;
  onTransitionSubmit?: (values: Record<string, unknown>) => Promise<void>;
  onUpdateEstimate?: (task: Task, newEstimate: number, isTestPoints: boolean) => void;
}

export const ModalsSection = observer(function ModalsSection({
  selectedSprintId,
  sprints,
  taskPositions,
  viewMode = 'full',
  DialogComponent,
  onAccountWork,
  onChangeAssignee,
  onMoveToSprint,
  onRemoveFromPlan,
  onRemoveFromSprint,
  onSplitPhaseIntoSegments,
  onStatusChange,
  onUpdateEstimate,
  onEstimateUpdateSuccess,
  transitionModal,
  onCloseTransitionModal,
  onTransitionSubmit,
}: ModalsSectionProps) {
  const { sprintPlannerUi } = useRootStore();
  const contextMenu = sprintPlannerUi.contextMenu;
  const accountWorkModal = sprintPlannerUi.accountWorkModal;

  return (
    <>
      {/* Контекстное меню */}
      {contextMenu && (
        <ContextMenu
          anchorRect={contextMenu.anchorRect ?? null}
          currentSprintId={selectedSprintId}
          hideRemoveFromPlan={contextMenu.hideRemoveFromPlan}
          isBacklogTask={contextMenu.isBacklogTask || false}
          isKanbanView={viewMode === 'kanban'}
          position={contextMenu.position}
          sprints={sprints}
          task={contextMenu.task}
          taskPositions={taskPositions}
          onAccountWork={sprintPlannerUi.setAccountWorkModal}
          onChangeAssignee={onChangeAssignee}
          onClose={sprintPlannerUi.closeContextMenu}
          onEstimateUpdateSuccess={onEstimateUpdateSuccess}
          onMoveToSprint={onMoveToSprint}
          onRemoveFromPlan={onRemoveFromPlan}
          onRemoveFromSprint={onRemoveFromSprint}
          onSplitPhaseIntoSegments={
            viewMode === 'kanban' ? undefined : onSplitPhaseIntoSegments
          }
          onStatusChange={onStatusChange}
          onUpdateEstimate={onUpdateEstimate}
        />
      )}

      {/* Модальное окно для учета работы */}
      <AccountWorkModal
        currentSprintId={selectedSprintId}
        isOpen={accountWorkModal !== null}
        sprints={sprints}
        task={accountWorkModal}
        onClose={() => sprintPlannerUi.setAccountWorkModal(null)}
        onConfirm={onAccountWork}
      />

      {/* Модалка полей перехода (комментарий и др.) */}
      {transitionModal && onCloseTransitionModal && onTransitionSubmit && (
        <TransitionFieldsModal
          fields={transitionModal.fields}
          isOpen
          sprints={sprints}
          targetStatusDisplay={transitionModal.targetStatusDisplay}
          task={transitionModal.task}
          onClose={onCloseTransitionModal}
          onSubmit={onTransitionSubmit}
        />
      )}

      {/* Диалог подтверждения */}
      {DialogComponent}
    </>
  );
});
