'use client';

import type { OccupancyTaskCellProps } from './occupancyTaskCell.types';
import type { MouseEvent, ReactNode } from 'react';

import { Icon } from '@/components/Icon';
import { useI18n } from '@/contexts/LanguageContext';
import { getTaskTrackerIssueUrl } from '@/features/task/utils/taskUtils';
import { formatTaskTestPointsForDisplay } from '@/lib/pointsUtils';
import { copyTextToClipboard } from '@/utils/copyToClipboard';

import {
  OccupancyTaskCellCompactSingleRowLayout,
  OccupancyTaskCellCompactWithFactLayout,
} from './OccupancyTaskCellCompactLayouts';
import {
  computeHasAssigneeRowContent,
  mergeOccupancyRowFields,
  shouldShowTestPoints,
  unplannedWarningMessage,
} from './occupancyTaskCellHelpers';
import { OccupancyTaskCellStandardLayout } from './OccupancyTaskCellStandardLayout';
import { OccupancyTaskCellToolbar } from './OccupancyTaskCellToolbar';

export type { OccupancyTaskCellProps } from './occupancyTaskCell.types';

export function OccupancyTaskCell({
  assigneeDisplayName,
  displayKey,
  dragHandle,
  goalStoryEpicNames: _goalStoryEpicNames,
  hasFact,
  hasQa,
  isPlanned,
  mainTask,
  devAvatarUrl,
  devAvatarVariant = 'default',
  devInitials,
  legacyCompactLayout,
  rowFieldsVisibility,
  rowHeightMinusBorder,
  rowOpacity = 1,
  qaDisplayName,
  qaAvatarUrl,
  qaInitials,
  qaTask,
  unplannedWarning,
  setTaskRowRef,
  task,
  taskColumnWidth,
  onContextMenu,
  onTaskClick,
}: OccupancyTaskCellProps) {
  const { t } = useI18n();
  const tpSource = hasQa && qaTask ? qaTask : task;
  const formattedTpCompact = formatTaskTestPointsForDisplay(tpSource, 'compact');
  const formattedTpSpaced = formatTaskTestPointsForDisplay(tpSource, 'spaced');
  const shouldShowTp = shouldShowTestPoints(task, hasQa, qaTask ?? null);
  const unplannedMsg = unplannedWarningMessage(unplannedWarning);

  const rawFields = mergeOccupancyRowFields(rowFieldsVisibility);
  const fields = {
    ...rawFields,
    showTestPoints:
      rawFields.showTestPoints && task.hideTestPointsByIntegration !== true,
  };
  const formattedSp = typeof task.storyPoints === 'number' ? `${task.storyPoints} sp` : '? sp';
  const formattedTp = formattedTpSpaced;

  const handleCopyTaskKey = (e: React.MouseEvent) => {
    e.stopPropagation();
    void copyTextToClipboard(displayKey, t('sprintPlanner.occupancy.toastTaskKeyCopied'));
  };

  const handleCopyTaskLink = (e: MouseEvent) => {
    e.stopPropagation();
    void copyTextToClipboard(
      getTaskTrackerIssueUrl(mainTask),
      t('sprintPlanner.occupancy.toastLinkCopied')
    );
  };

  const handleOpenMenu = (e: MouseEvent) => {
    onContextMenu?.(e, mainTask, false, true);
  };

  const hasAssigneeRowContent = computeHasAssigneeRowContent({
    assigneeDisplayName,
    fields,
    qaDisplayName,
    shouldShowTp,
    task,
  });

  const compactShared = {
    assigneeDisplayName,
    devAvatarUrl,
    devAvatarVariant,
    devInitials,
    displayKey,
    fields,
    formattedSp,
    formattedTp,
    qaAvatarUrl,
    qaDisplayName,
    qaInitials,
    shouldShowTp,
    task,
  };

  let taskCellContent: ReactNode;
  if (!legacyCompactLayout) {
    taskCellContent = (
      <OccupancyTaskCellStandardLayout
        assigneeDisplayName={assigneeDisplayName}
        displayKey={displayKey}
        fields={fields}
        formattedTpCompact={formattedTpCompact}
        hasAssigneeRowContent={hasAssigneeRowContent}
        qaDisplayName={qaDisplayName}
        shouldShowTp={shouldShowTp}
        task={task}
        unplannedMessage={unplannedMsg}
      />
    );
  } else if (hasFact) {
    taskCellContent = <OccupancyTaskCellCompactWithFactLayout {...compactShared} />;
  } else {
    taskCellContent = <OccupancyTaskCellCompactSingleRowLayout {...compactShared} />;
  }

  return (
    <td
      className="sticky left-0 z-[11] bg-gray-50 dark:bg-gray-900 p-0 align-top relative"
      style={{
        height: rowHeightMinusBorder,
        minWidth: taskColumnWidth,
        opacity: rowOpacity,
        transition: 'opacity 0.2s ease',
        verticalAlign: 'top',
        width: taskColumnWidth,
      }}
    >
      <div
        className="absolute right-0 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 pointer-events-none"
        style={{ zIndex: 12 }}
      />
      <div
        className={`flex items-start gap-0 h-full border-l-2 ${
          isPlanned
            ? 'border-l-transparent'
            : 'border-l-amber-400 dark:border-l-amber-500 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20'
        }`}
      >
        {dragHandle && (
          <div
            {...dragHandle.attributes}
            {...dragHandle.listeners}
            className={`cursor-grab active:cursor-grabbing flex-shrink-0 p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors ${legacyCompactLayout ? 'mt-0.5 p-1' : 'mt-1.5'}`}
            title={t('sprintPlanner.occupancy.dragToReorder')}
            onClick={(e) => e.stopPropagation()}
          >
            <Icon
              className={`text-gray-400 dark:text-gray-500 ${legacyCompactLayout ? 'w-3.5 h-3.5' : 'w-4 h-4'}`}
              name="grip-vertical"
            />
          </div>
        )}
        <div
          ref={setTaskRowRef(task.id)}
          className={`group relative flex-1 min-w-0 h-full overflow-hidden cursor-pointer transition-colors duration-200 border-l-2 ${
            legacyCompactLayout
              ? 'flex items-center h-10 min-h-[2.5rem] px-2'
              : 'flex flex-col min-h-[3rem] px-3 py-2.5 gap-y-1.5'
          } ${
            isPlanned
              ? 'border-l-transparent hover:bg-gray-100 dark:hover:bg-gray-800'
              : 'border-l-transparent'
          }`}
          data-context-menu-source="occupancy-task-row"
          data-task-id={task.id}
          role="button"
          tabIndex={0}
          title={task.name}
          onClick={() => onTaskClick?.(mainTask.id)}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu?.(e, mainTask, false, true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onTaskClick?.(mainTask.id);
            }
          }}
        >
          <OccupancyTaskCellToolbar
            onCopyKey={handleCopyTaskKey}
            onCopyLink={handleCopyTaskLink}
            onOpenMenu={handleOpenMenu}
          />
          {taskCellContent}
        </div>
      </div>
    </td>
  );
}
