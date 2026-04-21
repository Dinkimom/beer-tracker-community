/**
 * Компонент кнопки создания QA задачи для TaskBar
 */

'use client';

import type { Task } from '@/types';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { ZIndex } from '@/constants';

interface TaskBarQACreateButtonProps {
  hasQATaskInSwimlane: boolean;
  isDragging: boolean;
  isInError?: boolean;
  isQATask: boolean;
  isSelected: boolean;
  task: Task;
  onCreateQATask?: (taskId: string, anchorRect?: DOMRect) => void;
}

export function TaskBarQACreateButton({
  hasQATaskInSwimlane,
  isDragging,
  isInError,
  isQATask,
  isSelected,
  onCreateQATask,
  task,
}: TaskBarQACreateButtonProps) {
  const { t } = useI18n();
  if (
    isQATask ||
    task.hideTestPointsByIntegration === true ||
    task.testPoints === undefined ||
    task.testPoints <= 0 ||
    !onCreateQATask ||
    task.team === 'QA' ||
    hasQATaskInSwimlane ||
    isSelected ||
    isDragging ||
    isInError
  ) {
    return null;
  }

  return (
    <Button
      className={`absolute -right-2 -top-3 !h-6 !w-6 !min-h-0 !min-w-0 !justify-center !rounded-full !border-0 !bg-amber-500 !p-0 text-white shadow-lg transition-all duration-200 hover:!scale-110 hover:!bg-amber-600 ${ZIndex.class('floatingControls')}`}
      style={{ zIndex: ZIndex.floatingControls }}
      title={t('task.taskBar.addQaTaskTitle')}
      type="button"
      variant="primary"
      onClick={(e) => {
        e.stopPropagation();
        const el = e.currentTarget;
        onCreateQATask(task.id, el.getBoundingClientRect());
      }}
    >
      <Icon className="h-3.5 w-3.5" name="plus" />
    </Button>
  );
}

