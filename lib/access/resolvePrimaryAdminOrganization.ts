import type { UserOrganizationSummary } from '@/lib/organizations';

/**
 * Организация контекста админки: одна запись с {@link UserOrganizationSummary.canAccessAdmin}.
 */
export function resolvePrimaryAdminOrganization(
  orgs: readonly UserOrganizationSummary[]
): UserOrganizationSummary | null {
  return orgs.find((o) => o.canAccessAdmin) ?? null;
}

export function resolvePrimaryAdminOrganizationId(
  orgs: readonly UserOrganizationSummary[]
): string {
  return resolvePrimaryAdminOrganization(orgs)?.organization_id ?? '';
}
