'use client';

import { Button } from '@/components/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { useTaskSidebar } from '@/features/sidebar/contexts/TaskSidebarContext';
import {
  TASK_GROUP_KEY_NO_PARENT,
  TASK_GROUP_KEY_UNASSIGNED,
} from '@/features/task/constants/taskGroupKeys';
import type { ValidationIssue } from '@/features/task/utils/taskValidation';
import { getSidebarTaskGroupKey } from '@/features/task/utils/taskSidebarGroupKey';

function validationMessage(issue: ValidationIssue, t: (k: string, p?: Record<string, string | number>) => string) {
  return t(`task.validation.${issue.type}`, issue.params);
}

function formatInvalidTabGroupLabel(
  groupKey: string,
  t: (k: string, p?: Record<string, string | number>) => string
): string {
  if (groupKey === TASK_GROUP_KEY_UNASSIGNED) {
    return t('task.grouping.unassigned');
  }
  if (groupKey === TASK_GROUP_KEY_NO_PARENT) {
    return t('task.grouping.noParent');
  }
  return groupKey;
}

export function InvalidTab() {
  const { t } = useI18n();
  const {
    invalidTasks,
    groupBy,
    setGroupBy,
    groupKeys,
    groupedTasks,
    developers,
  } = useTaskSidebar();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-shrink-0 px-4 pt-4 pb-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide whitespace-nowrap">
            {t('task.invalidTab.groupingLabel')}
          </span>
          <div className="flex gap-1">
            <Button
              className="rounded px-2.5 py-1 text-xs font-medium"
              title={t('task.invalidTab.groupNoneTitle')}
              type="button"
              variant={groupBy === 'none' ? 'primary' : 'secondary'}
              onClick={() => setGroupBy('none')}
            >
              {t('task.invalidTab.groupNoneButton')}
            </Button>
            <Button
              className="rounded px-2.5 py-1 text-xs font-medium"
              title={t('task.invalidTab.groupAssigneeTitle')}
              type="button"
              variant={groupBy === 'assignee' ? 'primary' : 'secondary'}
              onClick={() => setGroupBy('assignee')}
            >
              {t('task.invalidTab.groupAssigneeButton')}
            </Button>
            <Button
              className="rounded px-2.5 py-1 text-xs font-medium"
              title={t('task.invalidTab.groupParentTitle')}
              type="button"
              variant={groupBy === 'parent' ? 'primary' : 'secondary'}
              onClick={() => setGroupBy('parent')}
            >
              {t('task.invalidTab.groupParentButton')}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 min-h-0">
        {invalidTasks.length === 0 ? (
          <div className="flex min-h-full items-center justify-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('task.invalidTab.allGood')}</p>
          </div>
        ) : (
          groupKeys.map((groupKey, groupIndex) => {
            const tasksInGroup = groupedTasks[groupKey];
            if (tasksInGroup.length === 0) return null;

            const isLastGroup = groupIndex === groupKeys.length - 1;

            const invalidTasksInGroup = invalidTasks.filter(({ task }) => {
              if (groupBy === 'none') return true;
              const taskGroupKey = getSidebarTaskGroupKey(task, groupBy, developers);
              return taskGroupKey === groupKey;
            });

            return (
              <div
                key={groupKey}
                className={
                  groupBy !== 'none' && !isLastGroup
                    ? 'mb-4 pb-4'
                    : groupBy !== 'none'
                      ? 'mb-4'
                      : ''
                }
              >
                {groupBy !== 'none' && (
                  <div className="mb-3">
                    <h3 className="w-full text-center text-xs font-semibold text-gray-800 dark:text-gray-200 px-3 py-1.5 bg-gray-200 dark:bg-gray-700 rounded-md">
                      {formatInvalidTabGroupLabel(groupKey, t)}
                      <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold text-white bg-blue-600 rounded-full">
                        {invalidTasksInGroup.length}
                      </span>
                    </h3>
                  </div>
                )}
                <div className="space-y-2.5">
                  {invalidTasksInGroup.map(({ task, issues }) => (
                    <div
                      key={task.id}
                      className="bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-800 rounded-lg p-3"
                    >
                      <div className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
                        <a
                          className="text-blue-600 dark:text-blue-400 hover:underline"
                          href={task.link}
                          rel="noopener noreferrer"
                          target="_blank"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {task.id}
                        </a>
                        <span className="font-semibold">
                          {' - ['}
                          {task.team}
                          {']'}
                          {task.productTeam?.length ? task.productTeam.map((p) => ` [${p}]`).join('') : ''}{' '}
                          {task.name}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                          {t('task.invalidTab.issuesLabel')}
                        </span>
                        <ul className="space-y-0.5 text-xs text-gray-700 dark:text-gray-300">
                          {issues.map((issue) => (
                            <li key={`${task.id}-${issue.type}`}>• {validationMessage(issue, t)}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
