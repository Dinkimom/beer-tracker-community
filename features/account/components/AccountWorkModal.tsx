'use client';

import type { Task } from '@/types';
import type { SprintListItem } from '@/types/tracker';

import { createPortal } from 'react-dom';

import { ZIndex } from '@/constants';
import { useI18n } from '@/contexts/LanguageContext';
import { TaskCard } from '@/features/task/components/TaskCard/TaskCard';
import { TaskTimeline } from '@/features/task/components/TaskTimeline';

import { AccountWorkForm } from './AccountWorkModal/components/AccountWorkForm';
import { useAccountWorkModal } from './AccountWorkModal/hooks/useAccountWorkModal';

interface AccountWorkModalProps {
  currentSprintId: number | null;
  isOpen: boolean;
  sprints: SprintListItem[];
  task: Task | null;
  onClose: () => void;
  onConfirm: (data: {
    burnedStoryPoints: number;
    burnedTestPoints: number;
    newTaskTitle: string;
    remainingStoryPoints: number;
    remainingTestPoints: number;
    targetSprintId: number | null;
  }) => Promise<void>;
}

export function AccountWorkModal({
  isOpen,
  onClose,
  task,
  sprints,
  currentSprintId,
  onConfirm,
}: AccountWorkModalProps) {
  const { t } = useI18n();
  const {
    burnedStoryPoints,
    setBurnedStoryPoints,
    burnedTestPoints,
    setBurnedTestPoints,
    remainingStoryPoints,
    setRemainingStoryPoints,
    remainingTestPoints,
    setRemainingTestPoints,
    newTaskTitle,
    setNewTaskTitle,
    targetSprintId,
    setTargetSprintId,
    isLoading,
    availableSprints,
    handleSubmit,
  } = useAccountWorkModal({
    isOpen,
    task,
    sprints,
    currentSprintId,
    onConfirm,
    onClose,
  });

  if (!isOpen || !task) return null;

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 dark:bg-black/70"
      style={{ zIndex: ZIndex.modalBackdrop }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            {t('account.workModal.title')}
          </h2>

          {/* Карточка задачи */}
          <div className="mb-3">
            <TaskCard
              className="pointer-events-auto"
              isContextMenuOpen={false}
              isDragging={false}
              isResizing={false}
              isSelected={false}
              task={task}
              variant="sidebar"
              widthPercent={100}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
            />
          </div>

          {/* Таймлайн задачи */}
          {task && <TaskTimeline issueKey={task.id} />}

          <AccountWorkForm
            availableSprints={availableSprints}
            burnedStoryPoints={burnedStoryPoints}
            burnedTestPoints={burnedTestPoints}
            isLoading={isLoading}
            newTaskTitle={newTaskTitle}
            remainingStoryPoints={remainingStoryPoints}
            remainingTestPoints={remainingTestPoints}
            setBurnedStoryPoints={setBurnedStoryPoints}
            setBurnedTestPoints={setBurnedTestPoints}
            setNewTaskTitle={setNewTaskTitle}
            setRemainingStoryPoints={setRemainingStoryPoints}
            setRemainingTestPoints={setRemainingTestPoints}
            setTargetSprintId={setTargetSprintId}
            targetSprintId={targetSprintId}
            onCancel={onClose}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
