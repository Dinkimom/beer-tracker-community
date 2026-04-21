'use client';

import { TaskTimelineEmpty } from './TaskTimeline/components/TaskTimelineEmpty';
import { TaskTimelineError } from './TaskTimeline/components/TaskTimelineError';
import { TaskTimelineLoading } from './TaskTimeline/components/TaskTimelineLoading';
import { TaskTimelineStatusItem } from './TaskTimeline/components/TaskTimelineStatusItem';
import { useTaskTimeline } from './TaskTimeline/hooks/useTaskTimeline';

interface TaskTimelineProps {
  issueKey: string;
}

export function TaskTimeline({ issueKey }: TaskTimelineProps) {
  const { loading, error, statusSummaries, statusDurations, comments } = useTaskTimeline(issueKey);

  if (loading) {
    return <TaskTimelineLoading />;
  }

  if (error) {
    return <TaskTimelineError error={error} />;
  }

  if (statusDurations.length === 0) {
    return <TaskTimelineEmpty />;
  }

  if (statusSummaries.length === 0) {
    return <TaskTimelineEmpty hasNoData />;
  }

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
      {/* Заголовок */}
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
        Время в статусах
      </h3>

      {/* Детальная статистика по статусам */}
      <div className="space-y-1.5 mb-3">
        {statusSummaries.map((status, index) => (
          <TaskTimelineStatusItem
            key={status.statusKey}
            comments={index === 0 ? comments : []}
            status={status}
          />
        ))}
      </div>

      {/* Разделитель */}
      <div className="border-t border-gray-200 dark:border-gray-700" />
    </div>
  );
}
