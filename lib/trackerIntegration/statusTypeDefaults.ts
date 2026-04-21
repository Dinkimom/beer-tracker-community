import type { TrackerMetadataStatusDto } from './fetchTrackerOrgMetadata';
import type { TaskStatus } from '@/utils/statusMapper';

import { TaskStatusCategorySchema } from './schema';

/**
 * Эвристика: ключ типа статуса трекера → категория планера.
 * Дополняется вручную в админке при необходимости.
 */
export function mapTrackerStatusTypeKeyToCategory(typeKey: string): TaskStatus | undefined {
  const k = typeKey.trim().toLowerCase().replace(/\s+/g, '');
  if (
    k.includes('start') ||
    k === 'new' ||
    k.includes('backlog') ||
    k.includes('open') ||
    k.includes('начал')
  ) {
    return 'todo';
  }
  if (
    k.includes('progress') ||
    k.includes('review') ||
    k.includes('test') ||
    k.includes('работе') ||
    k.includes('вработе')
  ) {
    return 'in-progress';
  }
  if (k.includes('pause') || k.includes('block') || k.includes('пауз')) {
    return 'paused';
  }
  if (
    k.includes('done') ||
    k.includes('close') ||
    k.includes('complete') ||
    k.includes('release') ||
    k.includes('закры') ||
    k.includes('выполн')
  ) {
    return 'done';
  }
  return undefined;
}

export type StatusDefaultsByType = Record<string, TaskStatus>;

/**
 * Строит defaultsByTrackerStatusType по списку статусов API (по ключу **типа** статуса).
 * При нескольких статусах одного типа категория одна; при конфликте побеждает первый нетривиальный маппинг.
 */
export function buildStatusDefaultsFromTrackerStatuses(
  statuses: TrackerMetadataStatusDto[]
): StatusDefaultsByType {
  const out: StatusDefaultsByType = {};
  for (const s of statuses) {
    const typeKey = s.statusType?.key?.trim();
    if (!typeKey || out[typeKey]) {
      continue;
    }
    const cat = mapTrackerStatusTypeKeyToCategory(typeKey);
    if (cat && TaskStatusCategorySchema.safeParse(cat).success) {
      out[typeKey] = cat;
    }
  }
  return out;
}
