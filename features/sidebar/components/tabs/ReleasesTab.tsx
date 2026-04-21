'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

import { Button } from '@/components/Button';
import { useI18n } from '@/contexts/LanguageContext';
import { useTaskSidebar } from '@/features/sidebar/contexts/TaskSidebarContext';
import { TaskCard } from '@/features/task/components/TaskCard/TaskCard';
import { usePlannerIntegrationRules } from '@/hooks/usePlannerIntegrationRules';
import { useProductTenantOrganizations } from '@/hooks/useProductTenantOrganizations';
import {
  releaseReadinessEmptyListHintSpec,
  taskMatchesReleaseReadinessFilter,
} from '@/lib/trackerIntegration/releaseReadinessPlanner';

export function ReleasesTab() {
  const { t } = useI18n();
  const {
    allSprintTasksForMetrics,
    goalsTasks,
    developers,
    selectedSprintId,
    onContextMenu,
    contextMenuBlurOtherCards,
    contextMenuTaskId,
  } = useTaskSidebar();

  const { activeOrganizationId } = useProductTenantOrganizations({
    pollIntervalMs: 30_000,
  });
  const { data: plannerRules } = usePlannerIntegrationRules(activeOrganizationId);
  const releaseRules = plannerRules?.releaseReadiness ?? {
    readyStatusKey: null,
    showReleasesTab: true,
  };

  const allTasks = allSprintTasksForMetrics ?? goalsTasks;
  const releaseTasks = allTasks.filter((task) =>
    taskMatchesReleaseReadinessFilter(task, releaseRules)
  );

  const emptyHintSpec = releaseReadinessEmptyListHintSpec(releaseRules);
  const emptyHint =
    emptyHintSpec.kind === 'default_rc'
      ? t('sidebar.releasesTab.emptyNoTasksRc')
      : t('sidebar.releasesTab.emptyNoTasksStatus', { status: emptyHintSpec.statusKey });

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleTaskSelected = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const handleCopyReleaseMessage = async () => {
    const selectedTasks = releaseTasks.filter((t) => selectedIds.has(t.id));
    if (selectedTasks.length === 0) return;

    const escapeHtml = (value: string): string =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const lines = selectedTasks.map((task) => {
      const mrLink = task.MergeRequestLink ?? '';
      const escapedId = escapeHtml(task.id);
      const escapedName = escapeHtml(task.name);
      const escapedLink = escapeHtml(task.link);
      const trackerHtml = `<a href="${escapedLink}">${escapedId}</a>`;
      const nameHtml = mrLink
        ? `<a href="${escapeHtml(mrLink)}">${escapedName}</a>`
        : escapedName;
      return `${trackerHtml} - ${nameHtml}`;
    });

    const claim = t('sidebar.releasesTab.copyLineClaimRelease');
    const releaseMixed = t('sidebar.releasesTab.copyLineReleaseMixed');
    const rollbackMixed = t('sidebar.releasesTab.copyLineRollbackMixed');

    const htmlContent = [
      claim,
      '&nbsp; &nbsp;',
      ...lines,
      '&nbsp; &nbsp;',
      releaseMixed,
      rollbackMixed,
    ].join('<br/>');

    const plainContent = [
      claim,
      '',
      '',
      ...selectedTasks.map((task) => {
        const mrPart = task.MergeRequestLink ? ` (${task.MergeRequestLink})` : '';
        return `${task.id} - ${task.name}${mrPart}`;
      }),
      '',
      '',
      releaseMixed,
      rollbackMixed,
    ].join('\n');

    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([htmlContent], { type: 'text/html' }),
          'text/plain': new Blob([plainContent], { type: 'text/plain' }),
        }),
      ]);
      toast.success(t('sidebar.releasesTab.copySuccess'));
    } catch (error) {
      console.error('Failed to copy release message', error);
      toast.error(t('sidebar.releasesTab.copyError'));
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white dark:bg-gray-800">
      <div className="px-4 pt-3 flex-shrink-0 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-50">
          {t('sidebar.releasesTab.heading')}
        </h3>
      </div>

      {releaseTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center px-4 py-6">
          <p className="text-sm text-gray-500 dark:text-slate-300 text-center">{emptyHint}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {releaseTasks.map((task) => {
            const isChecked = selectedIds.has(task.id);
            return (
              <div
                key={task.id}
                className="flex items-start gap-2 cursor-pointer"
                onClick={() => toggleTaskSelected(task.id)}
              >
                <div className="flex-shrink-0 mt-3 pointer-events-none">
                  <div
                    className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      isChecked
                        ? 'bg-violet-500 border-violet-500'
                        : 'bg-transparent border-gray-400 dark:border-gray-500'
                    }`}
                  >
                    {isChecked && (
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={3}
                        viewBox="0 0 12 12"
                      >
                        <polyline points="1.5,6 4.5,9.5 10.5,2.5" />
                      </svg>
                    )}
                  </div>
                </div>
                <TaskCard
                  className="flex-1 cursor-pointer"
                  developers={developers}
                  dimmedByContextMenu={
                    Boolean(contextMenuBlurOtherCards) &&
                    contextMenuTaskId != null &&
                    contextMenuTaskId !== task.id
                  }
                  isContextMenuOpen={contextMenuTaskId === task.id}
                  selectedSprintId={selectedSprintId ?? undefined}
                  task={task}
                  variant="sidebar"
                  onContextMenu={
                    onContextMenu ? (e, task) => onContextMenu(e, task, false) : undefined
                  }
                />
              </div>
            );
          })}
        </div>
      )}

      {releaseTasks.length > 0 && (
        <div className="flex-shrink-0 border-t border-gray-100 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button
              className="h-auto min-h-0 p-0 text-xs font-medium text-violet-600 hover:bg-transparent hover:underline dark:text-violet-300"
              type="button"
              variant="ghost"
              onClick={() => {
                if (selectedIds.size === releaseTasks.length) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(releaseTasks.map((x) => x.id)));
                }
              }}
            >
              {selectedIds.size === releaseTasks.length
                ? t('sidebar.releasesTab.clearAll')
                : t('sidebar.releasesTab.selectAll')}
            </Button>
            <span className="text-xs text-gray-600 dark:text-slate-300">
              {t('sidebar.releasesTab.selectedCount', { count: selectedIds.size })}
            </span>
          </div>
          <Button
            className="w-full gap-1.5 bg-violet-600 py-1.5 text-xs font-semibold shadow-sm hover:bg-violet-700 disabled:bg-violet-400 dark:bg-violet-500 dark:hover:bg-violet-400 dark:disabled:bg-violet-800 dark:disabled:opacity-60"
            disabled={selectedIds.size === 0}
            type="button"
            variant="primary"
            onClick={handleCopyReleaseMessage}
          >
            {t('sidebar.releasesTab.buildReleaseMessage')}
          </Button>
        </div>
      )}
    </div>
  );
}
