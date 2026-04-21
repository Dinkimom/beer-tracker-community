/**
 * Состав команд (team_members) с проверкой принадлежности team/staff организации.
 */

import type { TeamMemberRow, TeamMemberWithStaffRow } from './types';

import { pool, qualifyBeerTrackerTables, query } from '@/lib/db';

export async function listTeamMembersWithStaff(
  organizationId: string,
  teamId: string
): Promise<TeamMemberWithStaffRow[]> {
  const res = await query<TeamMemberWithStaffRow>(
    `SELECT tm.team_id, tm.staff_id, tm.role_slug,
            s.display_name AS staff_display_name,
            s.email AS staff_email,
            s.tracker_user_id AS staff_tracker_user_id,
            (
              SELECT u.id
              FROM users u
              INNER JOIN organization_members om
                ON om.user_id = u.id AND om.organization_id = $1
              WHERE s.email IS NOT NULL AND u.email = s.email
              LIMIT 1
            ) AS product_user_id,
            (
              SELECT utm.is_team_lead
              FROM user_team_memberships utm
              INNER JOIN users u ON u.id = utm.user_id
              INNER JOIN organization_members om
                ON om.user_id = u.id AND om.organization_id = $1
              WHERE utm.team_id = tm.team_id
                AND s.email IS NOT NULL
                AND u.email = s.email
              LIMIT 1
            ) AS product_planner_is_team_lead,
            (s.email IS NOT NULL AND EXISTS (
               SELECT 1
               FROM organization_members om
               INNER JOIN users u ON u.id = om.user_id
               WHERE om.organization_id = $1 AND u.email = s.email
             )) AS product_user_in_org,
            (s.email IS NOT NULL AND EXISTS (
               SELECT 1
               FROM organization_members om
               INNER JOIN users u ON u.id = om.user_id
               INNER JOIN user_team_memberships utm
                 ON utm.user_id = u.id AND utm.team_id = tm.team_id
               WHERE om.organization_id = $1 AND u.email = s.email
             )) AS product_team_access,
            (s.email IS NOT NULL AND EXISTS (
               SELECT 1
               FROM organization_invitations oi
               WHERE oi.organization_id = $1
                 AND oi.team_id = tm.team_id
                 AND oi.email = s.email
                 AND oi.consumed_at IS NULL
                 AND oi.revoked_at IS NULL
             )) AS pending_product_invitation
     FROM team_members tm
     INNER JOIN teams t ON t.id = tm.team_id AND t.organization_id = $1
     INNER JOIN staff s ON s.id = tm.staff_id AND s.organization_id = $1
     WHERE tm.team_id = $2
     ORDER BY s.display_name ASC`,
    [organizationId, teamId]
  );
  return res.rows;
}

export async function listTeamIdsForStaffInOrganization(
  organizationId: string,
  staffId: string
): Promise<string[]> {
  const res = await query<{ team_id: string }>(
    `SELECT tm.team_id
     FROM team_members tm
     INNER JOIN teams t ON t.id = tm.team_id AND t.organization_id = $1
     WHERE tm.staff_id = $2::uuid`,
    [organizationId, staffId]
  );
  return res.rows.map((r) => r.team_id);
}

export async function addTeamMember(
  organizationId: string,
  teamId: string,
  staffId: string,
  roleSlug?: string | null
): Promise<TeamMemberRow | null> {
  const res = await query<TeamMemberRow>(
    `INSERT INTO team_members (team_id, staff_id, role_slug)
     SELECT $2::uuid, $3::uuid, $4
     WHERE EXISTS (
       SELECT 1 FROM teams t
       WHERE t.id = $2::uuid AND t.organization_id = $1
     )
     AND EXISTS (
       SELECT 1 FROM staff s
       WHERE s.id = $3::uuid AND s.organization_id = $1
     )
     ON CONFLICT (team_id, staff_id) DO UPDATE SET role_slug = EXCLUDED.role_slug
     RETURNING team_id, staff_id, role_slug`,
    [organizationId, teamId, staffId, roleSlug ?? null]
  );
  return res.rows[0] ?? null;
}

export async function updateTeamMemberRole(
  organizationId: string,
  teamId: string,
  staffId: string,
  roleSlug: string | null
): Promise<TeamMemberRow | null> {
  const res = await query<TeamMemberRow>(
    `UPDATE team_members tm
     SET role_slug = $4
     FROM teams t
     WHERE tm.team_id = t.id
       AND t.organization_id = $1
       AND tm.team_id = $2::uuid
       AND tm.staff_id = $3::uuid
     RETURNING tm.team_id, tm.staff_id, tm.role_slug`,
    [organizationId, teamId, staffId, roleSlug]
  );
  return res.rows[0] ?? null;
}

/**
 * Удаляет участника из `team_members` и снимает права планера в этой команде:
 * строка `user_team_memberships` для пользователя с тем же email, что у staff (иначе списки и ACL расходятся).
 */
export async function removeTeamMember(
  organizationId: string,
  teamId: string,
  staffId: string
): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const delTm = await client.query(
      qualifyBeerTrackerTables(
        `DELETE FROM team_members
         WHERE team_id = $2::uuid
           AND staff_id = $3::uuid
           AND EXISTS (
             SELECT 1 FROM teams
             WHERE teams.id = team_members.team_id
               AND teams.organization_id = $1
           )`
      ),
      [organizationId, teamId, staffId]
    );
    if ((delTm.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query(
      qualifyBeerTrackerTables(
        `DELETE FROM user_team_memberships utm
         WHERE utm.team_id = $2::uuid
           AND EXISTS (
             SELECT 1
             FROM staff s
             INNER JOIN users u
               ON s.email IS NOT NULL
              AND LOWER(TRIM(BOTH FROM s.email::text)) = LOWER(TRIM(BOTH FROM u.email::text))
             INNER JOIN organization_members om
               ON om.user_id = u.id AND om.organization_id = $1
             WHERE s.id = $3::uuid
               AND s.organization_id = $1
               AND utm.user_id = u.id
           )`
      ),
      [organizationId, teamId, staffId]
    );
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
