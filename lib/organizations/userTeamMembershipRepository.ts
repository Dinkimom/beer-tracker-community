/**
 * Связь пользователя продукта с командами (user_team_memberships) — ACL, не staff/team_members.
 */

import type { OrgMemberRole } from './types';

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
  const res = await query<UserTeamMembershipRow>(
    `SELECT utm.id, utm.user_id, utm.team_id, utm.is_team_lead, utm.is_team_member, utm.created_at
     FROM user_team_memberships utm
     INNER JOIN teams t ON t.id = utm.team_id AND t.organization_id = $1
     WHERE utm.user_id = $2
     ORDER BY utm.created_at ASC`,
    [organizationId, userId]
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

export async function upsertUserTeamMembership(input: {
  isTeamLead: boolean;
  isTeamMember: boolean;
  teamId: string;
  userId: string;
}): Promise<void> {
  await query(
    `INSERT INTO user_team_memberships (user_id, team_id, is_team_lead, is_team_member)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, team_id) DO UPDATE SET
       is_team_lead = user_team_memberships.is_team_lead OR EXCLUDED.is_team_lead,
       is_team_member = user_team_memberships.is_team_member OR EXCLUDED.is_team_member`,
    [input.userId, input.teamId, input.isTeamLead, input.isTeamMember]
  );
}

/** Заменить роль в команде (планер), не OR-слияние флагов. */
export async function updateUserTeamMembershipRole(
  organizationId: string,
  teamId: string,
  userId: string,
  role: ProductTeamRole
): Promise<boolean> {
  const { isTeamLead, isTeamMember } = productTeamRoleToFlags(role);
  const res = await query(
    `UPDATE user_team_memberships utm
     SET is_team_lead = $4, is_team_member = $5
     FROM teams t
     WHERE utm.team_id = t.id
       AND t.organization_id = $1
       AND t.id = $3::uuid
       AND utm.user_id = $2::uuid
       AND utm.team_id = $3::uuid`,
    [organizationId, userId, teamId, isTeamLead, isTeamMember]
  );
  return (res.rowCount ?? 0) > 0;
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
    `SELECT om.user_id, om.role AS org_role, u.email, om.created_at
     FROM organization_members om
     INNER JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM user_team_memberships utm
         INNER JOIN teams t ON t.id = utm.team_id AND t.organization_id = $1
         WHERE utm.user_id = om.user_id
       )
     ORDER BY om.created_at ASC`,
    [organizationId]
  );
  return res.rows;
}

export async function userHasTeamMembershipInOrganization(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const res = await query<{ one: number }>(
    `SELECT 1 AS one
     FROM user_team_memberships utm
     INNER JOIN teams t ON t.id = utm.team_id AND t.organization_id = $1
     WHERE utm.user_id = $2
     LIMIT 1`,
    [organizationId, userId]
  );
  return res.rows.length > 0;
}

/** Снимает все строки планера user_team_memberships пользователя в командах этой организации. */
export async function deleteUserTeamMembershipsForUserInOrganization(
  organizationId: string,
  userId: string
): Promise<void> {
  await query(
    `DELETE FROM user_team_memberships utm
     WHERE utm.user_id = $2::uuid
       AND EXISTS (
         SELECT 1
         FROM teams t
         WHERE t.id = utm.team_id
           AND t.organization_id = $1
       )`,
    [organizationId, userId]
  );
}
