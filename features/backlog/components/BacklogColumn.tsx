'use client';

import type { Developer, Task } from '@/types';

import { useDroppable } from '@dnd-kit/core';

import { useI18n } from '@/contexts/LanguageContext';
import { DraggableTask } from '@/features/task/components/DraggableTask';
import { getSprintPointsTotals } from '@/lib/pointsUtils';

interface BacklogColumnProps {
  developers: Developer[];
  loading: boolean;
  tasks: Task[];
}

export function BacklogColumn({ developers, loading, tasks }: BacklogColumnProps) {
  const { t } = useI18n();
  const { setNodeRef, isOver } = useDroppable({
    id: 'backlog-column',
  });

  const { totalSP, totalTP } = getSprintPointsTotals(tasks);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-96 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col shadow-sm ${
        isOver ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      <div className="flex-shrink-0 px-4 py-3.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('backlog.column.title')}</h2>
          {!loading && (totalSP > 0 || totalTP > 0) && (
            <div className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
              {totalSP > 0 && <span>{totalSP}sp</span>}
              {totalSP > 0 && totalTP > 0 && <span>·</span>}
              {totalTP > 0 && <span>{totalTP}tp</span>}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {loading ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
            {t('backlog.column.loadingTasks')}
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
            {t('backlog.column.empty')}
          </div>
        ) : (
          tasks.map((task) => (
            <DraggableTask
              key={task.id}
              developers={developers}
              task={task}
              viewMode="compact"
            />
          ))
        )}
      </div>
    </div>
  );
}

