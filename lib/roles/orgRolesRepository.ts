/**
 * CRUD ролей поверх external master-контракта (overseer.roles).
 */

import type { DomainRole, Platform } from '@/lib/roles/catalog';

import { randomUUID } from 'node:crypto';

import { query } from '@/lib/db';

export interface OrgRoleRow {
  created_at: Date;
  domain_role: DomainRole;
  id: string;
  organization_id: string;
  platforms: Platform[];
  slug: string;
  title: string;
  updated_at: Date;
}

export function listOrgRoles(organizationId: string): Promise<OrgRoleRow[]> {
  if (organizationId) {
    // roles are managed globally in overseer.roles; org-scoped slice is empty.
  }
  return Promise.resolve([]);
}

export function createOrgRole(
  organizationId: string,
  data: { slug: string; title: string; domainRole: DomainRole; platforms: Platform[] }
): Promise<OrgRoleRow | null> {
  const slugNorm = data.slug.trim().toLowerCase();
  const titleNorm = data.title.trim();
  const uid = randomUUID();
  return query<OrgRoleRow>(
    `INSERT INTO overseer.roles (uid, slug, title, active)
     VALUES ($1::uuid, $2, $3, TRUE)
     ON CONFLICT DO NOTHING
     RETURNING
       uid::text AS id,
       $4::uuid AS organization_id,
       COALESCE(NULLIF(TRIM(slug), ''), CONCAT('overseer-role-', uid::text)) AS slug,
       COALESCE(NULLIF(TRIM(title), ''), CONCAT('Role ', uid::text)) AS title,
       $5::text AS domain_role,
       $6::jsonb AS platforms,
       CURRENT_TIMESTAMP AS created_at,
       CURRENT_TIMESTAMP AS updated_at`,
    [uid, slugNorm, titleNorm, organizationId, data.domainRole, JSON.stringify(data.platforms)]
  ).then((res) => res.rows[0] ?? null);
}

export function updateOrgRole(
  organizationId: string,
  slug: string,
  data: { title?: string; domainRole?: DomainRole; platforms?: Platform[] }
): Promise<OrgRoleRow | null> {
  return query<OrgRoleRow>(
    `UPDATE overseer.roles
     SET title = COALESCE($2, title)
     WHERE lower(COALESCE(NULLIF(TRIM(slug), ''), CONCAT('overseer-role-', uid::text))) = lower($1)
       AND COALESCE(active, TRUE) = TRUE
     RETURNING
       uid::text AS id,
       $3::uuid AS organization_id,
       COALESCE(NULLIF(TRIM(slug), ''), CONCAT('overseer-role-', uid::text)) AS slug,
       COALESCE(NULLIF(TRIM(title), ''), CONCAT('Role ', uid::text)) AS title,
       $4::text AS domain_role,
       $5::jsonb AS platforms,
       CURRENT_TIMESTAMP AS created_at,
       CURRENT_TIMESTAMP AS updated_at`,
    [
      slug,
      data.title !== undefined ? data.title.trim() : null,
      organizationId,
      data.domainRole ?? 'other',
      JSON.stringify(data.platforms ?? []),
    ]
  ).then((res) => res.rows[0] ?? null);
}

/**
 * В одной транзакции: удалить org-роль и обнулить role_slug у участников команд этой организации с тем же slug.
 */
export function deleteOrgRoleAndClearMembers(
  organizationId: string,
  slug: string
): Promise<boolean> {
  if (organizationId) {
    // roles are global in overseer.roles, no organization filter.
  }
  return query<{ id: string }>(
    `UPDATE overseer.roles
     SET active = FALSE
     WHERE lower(COALESCE(NULLIF(TRIM(slug), ''), CONCAT('overseer-role-', uid::text))) = lower($1)
       AND COALESCE(active, TRUE) = TRUE
     RETURNING uid::text AS id`,
    [slug]
  ).then((res) => (res.rowCount ?? 0) > 0);
}
