import type { PlannerIntegrationRulesDto } from './toPlannerDto';

/**
 * Показывать ли таб «Релизы» в планере и в списке настроек сайдбара.
 * Пока нет ответа API для организации — не показываем (нет мигания «есть → скрыли»).
 * Без активной организации — по умолчанию показываем (запрос правил не выполняется).
 */
export function isPlannerReleasesTabOffered(
  organizationId: string | null | undefined,
  isFetched: boolean,
  rules: PlannerIntegrationRulesDto | undefined
): boolean {
  if (!organizationId) {
    return true;
  }
  if (!isFetched) {
    return false;
  }
  return rules?.releaseReadiness?.showReleasesTab !== false;
}
