/**
 * Компонент действий для TasksTab
 */

'use client';

import { Button } from '@/components/Button';
import { useConfirmDialog } from '@/components/ConfirmDialog';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';

interface TasksTabActionsProps {
  onAutoAssignTasks?: () => void;
  onReturnAllTasks?: () => void;
}

export function TasksTabActions({
  onAutoAssignTasks,
  onReturnAllTasks,
}: TasksTabActionsProps) {
  const { t } = useI18n();
  const { confirm, DialogComponent } = useConfirmDialog();

  if (!onReturnAllTasks && !onAutoAssignTasks) {
    return null;
  }

  return (
    <>
      <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 space-y-2">
        {onAutoAssignTasks && (
          <Button
            className="h-8 w-full rounded-md px-3 text-xs font-semibold"
            title={t('sidebar.tasksTabActions.autoAssignTitle')}
            type="button"
            variant="primary"
            onClick={() => {
              onAutoAssignTasks();
            }}
          >
            <Icon className="mr-1.5 h-3.5 w-3.5" name="sparkles" />
            {t('sidebar.tasksTabActions.autoAssignButton')}
          </Button>
        )}
        {onReturnAllTasks && (
          <Button
            className="h-8 w-full rounded-md px-3 text-xs font-semibold"
            title={t('sidebar.tasksTabActions.returnTitle')}
            type="button"
            variant="dangerOutline"
            onClick={async () => {
              const confirmed = await confirm(t('sidebar.tasksTabActions.returnConfirm'), {
                title: t('sidebar.tasksTabActions.returnConfirmTitle'),
                variant: 'default',
              });
              if (confirmed) {
                onReturnAllTasks();
              }
            }}
          >
            {t('sidebar.tasksTabActions.returnButton')}
          </Button>
        )}
      </div>
      {/* Диалог подтверждения */}
      {DialogComponent}
    </>
  );
}

