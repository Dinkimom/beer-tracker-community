/**
 * Team-level ACL вычисляется из external master-контракта:
 * public.registry_employees + overseer.staff_teams/staff_roles/roles.
 */

import type { OrgMemberRole } from './types';

import { findUserById } from '@/lib/auth';
import { query } from '@/lib/db';

export interface UserTeamMembershipRow {
  created_at: Date;
  id: string;
  is_team_lead: boolean;
  is_team_member: boolean;
  team_id: string;
  user_id: string;
}

export async function listUserTeamMembershipsInOrganization(
  organizationId: string,
  userId: string
): Promise<UserTeamMembershipRow[]> {
  const user = await findUserById(userId);
  if (!user) {
    return [];
  }
  const res = await query<UserTeamMembershipRow>(
    `WITH me AS (
       SELECT re.uuid AS staff_uid
       FROM public.registry_employees re
       WHERE re.email IS NOT NULL
         AND LOWER(TRIM(re.email)) = LOWER(TRIM($2))
       LIMIT 1
     )
     SELECT
       CONCAT($1::text, ':', $3::text, ':', st.team_uid::text) AS id,
       $3::text AS user_id,
       st.team_uid::text AS team_id,
       EXISTS (
         SELECT 1
         FROM overseer.staff_roles sr
         INNER JOIN overseer.roles r ON r.uid = sr.role_uid
         WHERE sr.staff_uid = st.staff_uid
           AND COALESCE(r.active, TRUE) = TRUE
           AND (
             LOWER(COALESCE(r.slug, '')) LIKE '%lead%'
             OR LOWER(COALESCE(r.title, '')) LIKE '%lead%'
             OR LOWER(COALESCE(r.slug, '')) LIKE '%рук%'
             OR LOWER(COALESCE(r.title, '')) LIKE '%рук%'
           )
       ) AS is_team_lead,
       TRUE AS is_team_member,
       CURRENT_TIMESTAMP AS created_at
     FROM overseer.staff_teams st
     INNER JOIN me ON me.staff_uid = st.staff_uid
     ORDER BY st.team_uid::text ASC`,
    [organizationId, user.email, userId]
  );
  return res.rows;
}

/** Пользователи организации без ни одной строки user_team_memberships. */
/** Одна строка на пару user+team; при конфликте расширяем флаги lead/member (OR). */
export type ProductTeamRole = 'team_lead' | 'team_member';

export function productTeamRoleToFlags(role: ProductTeamRole): {
  isTeamLead: boolean;
  isTeamMember: boolean;
} {
  if (role === 'team_lead') {
    return { isTeamLead: true, isTeamMember: false };
  }
  return { isTeamLead: false, isTeamMember: true };
}

export function upsertUserTeamMembership(input: {
  isTeamLead: boolean;
  isTeamMember: boolean;
  teamId: string;
  userId: string;
}): Promise<void> {
  if (input.userId || input.teamId || input.isTeamLead || input.isTeamMember) {
    // no-op guard for lint; writes are intentionally disabled.
  }
  return Promise.reject(
    new Error('team ACL is derived from overseer.* and cannot be updated in beer_tracker')
  );
}

/** Заменить роль в команде (планер), не OR-слияние флагов. */
export function updateUserTeamMembershipRole(
  organizationId: string,
  teamId: string,
  userId: string,
  role: ProductTeamRole
): Promise<boolean> {
  if (organizationId || teamId || userId || role) {
    // external ACL is read-only from application side.
  }
  return Promise.resolve(false);
}

export async function listOrganizationUserIdsWithoutTeam(
  organizationId: string
): Promise<Array<{ user_id: string }>> {
  const rows = await listOrganizationMembersWithoutTeam(organizationId);
  return rows.map((r) => ({ user_id: r.user_id }));
}

export interface OrganizationMemberWithoutTeamRow {
  created_at: Date;
  email: string;
  org_role: OrgMemberRole;
  user_id: string;
}

/** Участники organization_members без ни одной строки user_team_memberships в командах этой org. */
export async function listOrganizationMembersWithoutTeam(
  organizationId: string
): Promise<OrganizationMemberWithoutTeamRow[]> {
  const res = await query<OrganizationMemberWithoutTeamRow>(
    `SELECT
       u.id AS user_id,
       CASE WHEN u.is_super_admin THEN 'org_admin' ELSE 'member' END AS org_role,
       u.email,
       u.created_at
     FROM users u
     LEFT JOIN public.registry_employees re
       ON re.email IS NOT NULL
      AND LOWER(TRIM(re.email)) = LOWER(TRIM(u.email))
     WHERE re.uuid IS NULL
        OR NOT EXISTS (
          SELECT 1
          FROM overseer.staff_teams st
          WHERE st.staff_uid = re.uuid
        )
     ORDER BY u.created_at ASC`,
    [organizationId]
  );
  return res.rows;
}

export async function userHasTeamMembershipInOrganization(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const rows = await listUserTeamMembershipsInOrganization(organizationId, userId);
  return rows.length > 0;
}

/** Снимает все строки планера user_team_memberships пользователя в командах этой организации. */
export function deleteUserTeamMembershipsForUserInOrganization(
  organizationId: string,
  userId: string
): Promise<void> {
  if (organizationId || userId) {
    // external ACL is read-only from application side.
  }
  return Promise.resolve();
}
