'use client';

import type { Task } from '@/types';
import type { ChecklistItem, SprintListItem } from '@/types/tracker';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

import { Button } from '@/components/Button';
import { ZIndex } from '@/constants';
import { FinishSprintChat } from '@/features/sprint/components/FinishSprintModal/components/FinishSprintChat';
import { FinishSprintChecklist } from '@/features/sprint/components/FinishSprintModal/components/FinishSprintChecklist';
import { FinishSprintTaskTransfer } from '@/features/sprint/components/FinishSprintModal/components/FinishSprintTaskTransfer';
import { useFinishSprintModal } from '@/features/sprint/components/FinishSprintModal/hooks/useFinishSprintModal';

export interface GoalTaskWithItems {
  checklistItems: ChecklistItem[];
  id: string;
  /** Источник целей: трекер (задача) или таблица sprint_goals */
  source?: 'sprint_goals' | 'tracker';
}

interface FinishSprintModalProps {
  /** Задачи на цели с чеклистами (delivery + discovery) */
  goalTasks: GoalTaskWithItems[];
  isOpen: boolean;
  sprintInfo: {
    id: number;
    status: string;
    version?: number;
  } | null;
  sprints: SprintListItem[];
  tasks: Task[];
  onClose: () => void;
  onSprintStatusChange?: () => void;
  onTasksReload?: () => void;
}

export function FinishSprintModal({
  isOpen,
  onClose,
  goalTasks,
  sprintInfo,
  sprints,
  tasks,
  onSprintStatusChange,
  onTasksReload,
}: FinishSprintModalProps) {
  const initialChecklistItems = useMemo(
    () =>
      goalTasks.flatMap((g) =>
        g.checklistItems.map((item) => ({
          ...item,
          goalTaskId: g.id,
          goalSource: g.source ?? 'tracker',
        }))
      ),
    [goalTasks]
  );
  const [isDark, setIsDark] = useState(false);

  // Отслеживаем изменение темы
  useEffect(() => {
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };

    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => observer.disconnect();
  }, []);

  const finishSprint = useFinishSprintModal({
    goalTasks: goalTasks.map((g) => ({ id: g.id, source: g.source })),
    initialChecklistItems,
    sprintInfo,
    tasks,
    isOpen,
    onSprintStatusChange,
    onTasksReload,
  });

  // Получаем спринты в статусе draft
  const draftSprints = sprints.filter(
    s => (s.status === 'draft' || s.status === 'Draft') && !s.archived
  );

  const handleSubmit = async () => {
    await finishSprint.handleSubmit();
    onClose();
  };

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/50 dark:bg-black/70"
      style={{ zIndex: ZIndex.modalBackdrop }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-6">
            Завершить спринт
          </h2>

          <div className="space-y-6">
            {/* Цели спринта */}
            <FinishSprintChecklist
              checklistItems={finishSprint.checklistItems}
              updatingItems={finishSprint.updatingItems}
              onCheckboxChange={finishSprint.handleCheckboxChange}
            />

            {/* Перенос незавершенных задач */}
            <FinishSprintTaskTransfer
              draftSprints={draftSprints}
              isDark={isDark}
              moveTasksTo={finishSprint.moveTasksTo}
              selectedSprintId={finishSprint.selectedSprintId}
              onMoveTasksToChange={finishSprint.setMoveTasksTo}
              onSelectedSprintIdChange={finishSprint.setSelectedSprintId}
            />

            {/* Отправка в чат */}
            <FinishSprintChat
              selectedChat={finishSprint.selectedChat}
              sendToChat={finishSprint.sendToChat}
              onSelectedChatChange={finishSprint.setSelectedChat}
              onSendToChatChange={finishSprint.setSendToChat}
            />
          </div>

          {/* Кнопки действий */}
          <div className="flex gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              className="flex-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={finishSprint.isLoading}
              variant="secondary"
              onClick={onClose}
            >
              Отмена
            </Button>
            <Button
              className="flex-1 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={finishSprint.isLoading}
              variant="danger"
              onClick={handleSubmit}
            >
              {finishSprint.isLoading ? 'Завершение...' : 'Завершить спринт'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
