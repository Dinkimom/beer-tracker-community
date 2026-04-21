import type { TrackerIntegrationStored } from './schema';
import type { TaskStatus } from '@/utils/statusMapper';

import { mapStatus } from '@/utils/statusMapper';

import { isTaskStatus } from './schema';

/**
 * Категория статуса по конфигу организации; undefined — не менять переданное базовое значение.
 * Override только с `visualToken` не блокирует переход к defaults по типу статуса.
 */
export function resolveStatusCategoryFromIntegration(
  statusKey: string | undefined,
  statusTypeKey: string | undefined,
  statuses: TrackerIntegrationStored['statuses']
): TaskStatus | undefined {
  if (!statuses) {
    return undefined;
  }
  const sk = statusKey?.trim();
  if (sk && statuses.overridesByStatusKey?.[sk]) {
    const c = statuses.overridesByStatusKey[sk].category;
    if (c !== undefined && isTaskStatus(c)) {
      return c;
    }
  }
  const tk = statusTypeKey?.trim();
  if (tk && statuses.defaultsByTrackerStatusType?.[tk]) {
    const c = statuses.defaultsByTrackerStatusType[tk];
    return isTaskStatus(c) ? c : undefined;
  }
  return undefined;
}

/**
 * Итоговая категория для UI/админки: интеграция → эвристика по ключу статуса (`mapStatus`).
 */
export function resolveEffectiveStatusCategory(
  statusKey: string,
  statusTypeKey: string | undefined,
  statuses: TrackerIntegrationStored['statuses'] | undefined
): TaskStatus | undefined {
  const fromConfig = resolveStatusCategoryFromIntegration(statusKey, statusTypeKey, statuses);
  return fromConfig ?? mapStatus(statusKey);
}
