import type { SprintListItem } from '@/types/tracker';

const DATE_PARTS: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit' };

export function formatDraftSprintOptionLabel(sprint: SprintListItem): string {
  if (!sprint.startDate || !sprint.endDate) return sprint.name;
  const start = new Date(sprint.startDate).toLocaleDateString('ru-RU', DATE_PARTS);
  const end = new Date(sprint.endDate).toLocaleDateString('ru-RU', DATE_PARTS);
  return `${sprint.name} (${start} - ${end})`;
}
