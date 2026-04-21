/**
 * Членство пользователей в организациях (organization_members).
 */

import type {
  OrganizationMemberRow,
  OrgMemberRole,
  UserOrganizationSummary,
} from './types';

import { pool, qualifyBeerTrackerTables, query } from '@/lib/db';

export async function findOrganizationMembership(
  organizationId: string,
  userId: string
): Promise<OrganizationMemberRow | null> {
  const res = await query<OrganizationMemberRow>(
    `SELECT id, organization_id, user_id, role, created_at
     FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId]
  );
  return res.rows[0] ?? null;
}

export async function listUserOrganizations(
  userId: string
): Promise<UserOrganizationSummary[]> {
  const res = await query<UserOrganizationSummary>(
    `SELECT o.id AS organization_id, o.name, o.slug, o.initial_sync_completed_at, om.role
     FROM organization_members om
     INNER JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1
     ORDER BY o.name ASC`,
    [userId]
  );
  return res.rows;
}

export async function listOrganizationMembers(
  organizationId: string
): Promise<OrganizationMemberRow[]> {
  const res = await query<OrganizationMemberRow>(
    `SELECT id, organization_id, user_id, role, created_at
     FROM organization_members
     WHERE organization_id = $1
     ORDER BY created_at ASC`,
    [organizationId]
  );
  return res.rows;
}

/** Команды пользователя в организации (из user_team_memberships). */
export interface OrganizationMemberDirectoryTeam {
  is_team_lead: boolean;
  is_team_member: boolean;
  team_id: string;
  title: string;
}

export function parseMemberDirectoryTeamsJson(raw: unknown): OrganizationMemberDirectoryTeam[] {
  if (raw == null) {
    return [];
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OrganizationMemberDirectoryTeam[]) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as OrganizationMemberDirectoryTeam[]) : [];
}

/** Все участники организации с email и признаком membership в командах org (user_team_memberships). */
export interface OrganizationMemberDirectoryRow {
  created_at: Date;
  email: string;
  has_team_membership: boolean;
  org_role: OrgMemberRole;
  teams_json: OrganizationMemberDirectoryTeam[] | null;
  user_id: string;
}

export async function listOrganizationMemberDirectory(
  organizationId: string
): Promise<OrganizationMemberDirectoryRow[]> {
  const res = await query<OrganizationMemberDirectoryRow>(
    `SELECT om.user_id, om.role AS org_role, u.email, om.created_at,
            EXISTS (
              SELECT 1
              FROM user_team_memberships utm
              INNER JOIN teams t ON t.id = utm.team_id AND t.organization_id = om.organization_id
              WHERE utm.user_id = om.user_id
            ) AS has_team_membership,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'team_id', t.id,
                    'title', t.title,
                    'is_team_lead', utm.is_team_lead,
                    'is_team_member', utm.is_team_member
                  )
                  ORDER BY t.title
                )
                FROM user_team_memberships utm
                INNER JOIN teams t ON t.id = utm.team_id AND t.organization_id = om.organization_id
                WHERE utm.user_id = om.user_id
              ),
              '[]'::json
            ) AS teams_json
     FROM organization_members om
     INNER JOIN users u ON u.id = om.user_id
     WHERE om.organization_id = $1
     ORDER BY om.created_at ASC`,
    [organizationId]
  );
  return res.rows;
}

export async function userHasOrganizationRole(
  organizationId: string,
  userId: string,
  role: OrgMemberRole
): Promise<boolean> {
  const row = await findOrganizationMembership(organizationId, userId);
  return row?.role === role;
}

export async function insertOrganizationMember(
  organizationId: string,
  userId: string,
  role: OrgMemberRole
): Promise<OrganizationMemberRow> {
  const res = await query<OrganizationMemberRow>(
    `INSERT INTO organization_members (organization_id, user_id, role)
     VALUES ($1, $2, $3)
     RETURNING id, organization_id, user_id, role, created_at`,
    [organizationId, userId, role]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('insertOrganizationMember: no row returned');
  }
  return row;
}

export async function countOrganizationMembersByRole(
  organizationId: string,
  role: OrgMemberRole
): Promise<number> {
  const res = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM organization_members
     WHERE organization_id = $1 AND role = $2`,
    [organizationId, role]
  );
  const n = Number.parseInt(res.rows[0]?.count ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: OrgMemberRole
): Promise<OrganizationMemberRow | null> {
  const res = await query<OrganizationMemberRow>(
    `UPDATE organization_members
     SET role = $3
     WHERE organization_id = $1 AND user_id = $2
     RETURNING id, organization_id, user_id, role, created_at`,
    [organizationId, userId, role]
  );
  return res.rows[0] ?? null;
}

export async function deleteOrganizationMember(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const res = await query(
    `DELETE FROM organization_members
     WHERE organization_id = $1 AND user_id = $2`,
    [organizationId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

/**
 * Удаляет учётную запись пользователя, если он состоит в этой организации.
 * Снимает строки team_members по совпадению email со staff, удаляет «осиротевший» staff без команд,
 * затем удаляет users (CASCADE: organization_members, user_team_memberships).
 */
export async function deleteOrganizationUserAccount(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const emailRes = await client.query<{ email: string }>(
      qualifyBeerTrackerTables(
        `SELECT u.email::text AS email
         FROM users u
         INNER JOIN organization_members om
           ON om.user_id = u.id AND om.organization_id = $1
         WHERE u.id = $2`
      ),
      [organizationId, userId]
    );
    const emailNorm = emailRes.rows[0]?.email?.trim().toLowerCase();

    if (emailNorm) {
      await client.query(
        qualifyBeerTrackerTables(
          `DELETE FROM team_members tm
           WHERE tm.team_id IN (SELECT id FROM teams t WHERE t.organization_id = $1)
             AND tm.staff_id IN (
               SELECT s.id FROM staff s
               WHERE s.organization_id = $1
                 AND s.email IS NOT NULL
                 AND LOWER(TRIM(s.email)) = $2
             )`
        ),
        [organizationId, emailNorm]
      );

      await client.query(
        qualifyBeerTrackerTables(
          `DELETE FROM staff s
           WHERE s.organization_id = $1
             AND s.email IS NOT NULL
             AND LOWER(TRIM(s.email)) = $2
             AND NOT EXISTS (SELECT 1 FROM team_members tm WHERE tm.staff_id = s.id)`
        ),
        [organizationId, emailNorm]
      );
    }

    const del = await client.query(
      qualifyBeerTrackerTables(
        `DELETE FROM users u
         WHERE u.id = $2
           AND EXISTS (
             SELECT 1 FROM organization_members om
             WHERE om.organization_id = $1 AND om.user_id = u.id
           )`
      ),
      [organizationId, userId]
    );

    await client.query('COMMIT');
    return (del.rowCount ?? 0) > 0;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
