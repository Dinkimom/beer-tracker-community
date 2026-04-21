'use client';

import { SprintScoreBlock } from '@/features/sidebar/components/tabs/SprintScoreBlock';
import { useTaskSidebar } from '@/features/sidebar/contexts/TaskSidebarContext';
import { TASK_GROUP_KEY_UNASSIGNED } from '@/features/task/constants/taskGroupKeys';
import {
  calculateMetricsByAssignee,
  calculateMetricsByStatus,
} from '@/features/sprint/utils/sprintMetrics';
import { useI18n } from '@/contexts/LanguageContext';
import { translateStatus } from '@/utils/translations';

export function MetricsTab() {
  const { t } = useI18n();
  const { allSprintTasksForMetrics, developers, goalTaskIds, goalsTasks, selectedSprintId } = useTaskSidebar();
  // Разбивка по исполнителям и итоги — по всем задачам спринта, а не только по запланированным
  const tasksForMetrics = allSprintTasksForMetrics ?? goalsTasks;
  const hideTp = tasksForMetrics.some((task) => task.hideTestPointsByIntegration === true);
  const developerMap = new Map(developers.map(d => [d.id, d]));
  const byStatus = calculateMetricsByStatus(tasksForMetrics, goalTaskIds);
  const byAssignee = calculateMetricsByAssignee(tasksForMetrics, goalTaskIds, developerMap);

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto bg-white dark:bg-gray-800">
      {selectedSprintId != null && selectedSprintId > 0 && (
        <SprintScoreBlock sprintId={selectedSprintId} />
      )}

      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('sidebar.metrics.byStatus')}
        </h3>
        <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
          <div className={`grid ${hideTp ? 'grid-cols-[1fr_3.5rem]' : 'grid-cols-[1fr_3.5rem_3.5rem]'} gap-x-3 items-center bg-gray-100 dark:bg-gray-700/50 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300`}>
            <div>{t('sidebar.metrics.statusColumn')}</div>
            <div
              className="text-right tabular-nums text-blue-600 dark:text-blue-400"
              title={t('sidebar.metrics.storyPointsTitle')}
            >
              SP
            </div>
            {!hideTp && (
              <div
                className="text-right tabular-nums text-amber-600 dark:text-amber-400"
                title={t('sidebar.metrics.testPointsTitle')}
              >
                TP
              </div>
            )}
          </div>
          {byStatus.map((row, index) => (
            <div
              key={row.statusKey}
              className={`grid ${hideTp ? 'grid-cols-[1fr_3.5rem]' : 'grid-cols-[1fr_3.5rem_3.5rem]'} gap-x-3 items-center px-3 py-2 min-h-[2.25rem] ${
                index % 2 === 0
                  ? 'bg-white dark:bg-gray-800'
                  : 'bg-gray-100 dark:bg-gray-700/70'
              }`}
            >
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 truncate block">
                {row.statusKey === '__none__' ? t('sidebar.metrics.noStatus') : translateStatus(row.statusKey)}
              </span>
              <div className="text-sm tabular-nums text-right text-gray-700 dark:text-gray-300">
                {row.totalSP > 0 ? (
                  <span className="font-medium text-blue-600 dark:text-blue-400">
                    {row.totalSP}
                  </span>
                ) : (
                  <span className="text-gray-400 dark:text-gray-500">—</span>
                )}
              </div>
              {!hideTp && (
                <div className="text-sm tabular-nums text-right text-gray-700 dark:text-gray-300">
                  {row.totalTP > 0 ? (
                    <span className="font-medium text-amber-600 dark:text-amber-400">
                      {row.totalTP}
                    </span>
                  ) : (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t('sidebar.metrics.byAssignee')}
        </h3>
        {byAssignee.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">{t('sidebar.metrics.noTasksWithAssignees')}</p>
        ) : (
          <div className="rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden min-w-0">
            <div className="grid grid-cols-[1fr_auto] gap-x-3 items-center bg-gray-100 dark:bg-gray-700/50 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300">
              <div className="min-w-0">{t('sidebar.metrics.assigneeColumn')}</div>
              <div
                className="text-right"
                title={hideTp ? t('sidebar.metrics.doneTotalSp') : t('sidebar.metrics.doneTotalSpTp')}
              >
                {t('sidebar.metrics.metricColumn')}
              </div>
            </div>
            {byAssignee.map((row, index) => (
              <div
                key={row.personId}
                className={`grid grid-cols-[1fr_auto] gap-x-3 items-center px-3 py-2 min-h-[2.25rem] ${
                  index % 2 === 0
                    ? 'bg-white dark:bg-gray-800'
                    : 'bg-gray-100 dark:bg-gray-700/70'
                }`}
              >
                <span
                  className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-0 truncate block"
                  title={
                    row.personName === TASK_GROUP_KEY_UNASSIGNED
                      ? t('task.grouping.unassigned')
                      : row.personName
                  }
                >
                  {row.personName === TASK_GROUP_KEY_UNASSIGNED
                    ? t('task.grouping.unassigned')
                    : row.personName}
                </span>
                <div className="text-sm tabular-nums text-right flex flex-col items-end gap-0.5">
                  {(row.totalSP > 0 || (hideTp && row.totalTP > 0)) && (
                    <span className="text-blue-600 dark:text-blue-400">
                      {row.completedSP} / {row.totalSP}
                      <span className="text-gray-500 dark:text-gray-400"> ({row.percentSP}%)</span>
                    </span>
                  )}
                  {!hideTp && row.totalTP > 0 && (
                    <span className="text-amber-600 dark:text-amber-400">
                      {row.completedTP} / {row.totalTP}
                      <span className="text-gray-500 dark:text-gray-400"> ({row.percentTP}%)</span>
                    </span>
                  )}
                  {row.totalSP === 0 && row.totalTP === 0 && (
                    <span className="text-gray-400 dark:text-gray-500">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
