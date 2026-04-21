'use client';

import type { SprintListItem } from '@/types/tracker';

import { useDroppable } from '@dnd-kit/core';

import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { DaysHeaderStatusBadge } from '@/features/sprint/components/DaysHeader/components/DaysHeaderStatusBadge';
import { DraggableTask } from '@/features/task/components/DraggableTask';
import { useTasks } from '@/features/task/hooks/useTasks';
import { getSprintPointsTotals } from '@/lib/pointsUtils';

interface SprintColumnProps {
  boardId: number | null;
  sprint: SprintListItem;
}

export function SprintColumn({ sprint, boardId }: SprintColumnProps) {
  const { language, t } = useI18n();
  const dateLocale = language === 'en' ? 'en-US' : 'ru-RU';
  const { setNodeRef, isOver } = useDroppable({
    id: `sprint-column-${sprint.id}`,
  });

  const { data, isLoading, error, refetch } = useTasks(sprint.id, boardId);
  const tasks = data?.tasks || [];
  const developers = data?.developers || [];

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(dateLocale, {
      day: '2-digit',
      month: '2-digit',
    });
  };

  const formatSprintDates = (startDate: string, endDate: string) => {
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  };

  // Подсчёт SP и TP через единую точку (lib/pointsUtils)
  const { totalSP, totalTP } = getSprintPointsTotals(tasks);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-[420px] border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col shadow-sm ${
        isOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate min-w-0">
            {sprint.name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400 flex-shrink-0">
            <Icon className="w-3.5 h-3.5" name="calendar" />
            <span>{formatSprintDates(sprint.startDate, sprint.endDate)}</span>
          </div>
          <DaysHeaderStatusBadge archived={sprint.archived} status={sprint.status} />
          {(totalSP > 0 || totalTP > 0) && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 flex-shrink-0">
              {totalSP > 0 && <span>{totalSP}sp</span>}
              {totalSP > 0 && totalTP > 0 && <span>·</span>}
              {totalTP > 0 && <span>{totalTP}tp</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {isLoading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
            <Icon className="animate-spin h-4 w-4 mx-auto mb-2" name="spinner" />
            {t('backlog.sprintColumn.loading')}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 px-3 text-center">
            <Icon className="h-4 w-4 text-red-500 dark:text-red-400" name="circle-x" />
            <div className="text-red-500 dark:text-red-400 text-sm">
              <p>{t('backlog.sprintColumn.loadErrorTitle')}</p>
              <p className="text-xs mt-1">
                {error instanceof Error ? error.message : t('common.unknownError')}
              </p>
            </div>
            <Button className="gap-2 px-3 py-2" type="button" variant="outline" onClick={() => refetch()}>
              <Icon className="h-4 w-4" name="refresh" />
              {t('backlog.sprintColumn.retry')}
            </Button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
            {t('backlog.sprintColumn.empty')}
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTask
              key={task.id}
              developers={developers}
              selectedSprintId={sprint.id}
              task={task}
              viewMode="compact"
            />
          ))
        )}
      </div>
    </div>
  );
}

