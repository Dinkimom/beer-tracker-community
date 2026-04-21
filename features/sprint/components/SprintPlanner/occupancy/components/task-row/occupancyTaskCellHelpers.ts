import type { OccupancyRowFieldsVisibility } from '@/hooks/useLocalStorage';
import type { SidebarTasksTab, Task } from '@/types';

export const DEFAULT_OCCUPANCY_ROW_FIELDS: OccupancyRowFieldsVisibility = {
  showAssignee: true,
  showKey: true,
  showPriority: true,
  showQa: true,
  showSeverity: true,
  showStatus: true,
  showStoryPoints: true,
  showTeam: true,
  showTestPoints: true,
  showType: true,
};

export function mergeOccupancyRowFields(
  rowFieldsVisibility?: Partial<OccupancyRowFieldsVisibility>
): OccupancyRowFieldsVisibility {
  return { ...DEFAULT_OCCUPANCY_ROW_FIELDS, ...rowFieldsVisibility };
}

export function shouldShowTestPoints(task: Task, hasQa: boolean, qaTask: Task | null | undefined): boolean {
  if (task.hideTestPointsByIntegration === true) {
    return false;
  }
  return task.team === 'QA' || (hasQa && !!qaTask);
}

export function getIncidentSeverityTagClasses(severity: string): string {
  const severityUpper = severity.toUpperCase();
  if (severityUpper === 'S1' || severityUpper === 'P0' || severityUpper === 'P1') {
    return 'bg-red-600 text-white border-red-800 dark:bg-red-950 dark:text-red-200 dark:border-red-500/90 incident-fire-badge';
  }
  if (severityUpper === 'S2' || severityUpper === 'P2') {
    return 'bg-orange-500 text-white border-orange-700 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-400/90';
  }
  if (severityUpper === 'S3' || severityUpper === 'P3') {
    return 'bg-amber-400 text-amber-950 border-amber-700 dark:bg-yellow-950 dark:text-yellow-100 dark:border-yellow-500/80';
  }
  if (severityUpper === 'S4' || severityUpper === 'P4') {
    return 'bg-gray-500 text-white border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-500';
  }
  return 'bg-gray-500 text-white border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-500';
}

export function unplannedWarningMessage(unplannedWarning: SidebarTasksTab | null): string | null {
  if (unplannedWarning === 'all') return 'Не запланирована';
  if (unplannedWarning === 'dev') return 'Не запланирована разработка';
  if (unplannedWarning === 'qa') return 'Не запланировано тестирование';
  return null;
}

export function computeHasAssigneeRowContent(params: {
  assigneeDisplayName?: string;
  fields: OccupancyRowFieldsVisibility;
  qaDisplayName?: string;
  shouldShowTp: boolean;
  task: Task;
}): boolean {
  const { assigneeDisplayName, fields, qaDisplayName, shouldShowTp, task } = params;
  return (
    (fields.showAssignee && !!assigneeDisplayName) ||
    (fields.showAssignee && fields.showTeam && !!task.team && task.team !== 'QA') ||
    (fields.showQa && shouldShowTp && !!qaDisplayName) ||
    (fields.showAssignee &&
      !assigneeDisplayName &&
      !(task.team && fields.showTeam) &&
      !qaDisplayName)
  );
}
