/**
 * Системная роль каталога «Тимлид» (slug в system_roles / org_roles) → права в приглашении / планере.
 * @see database/init.sql — seed slug `teamlead`
 */
export const CATALOG_TEAMLEAD_SLUG = 'teamlead';

export function invitedTeamRoleFromCatalogRoleSlug(
  slug: string | null | undefined
): 'team_lead' | 'team_member' {
  const s = slug?.trim().toLowerCase();
  if (s != null && s !== '' && s === CATALOG_TEAMLEAD_SLUG) {
    return 'team_lead';
  }
  return 'team_member';
}
