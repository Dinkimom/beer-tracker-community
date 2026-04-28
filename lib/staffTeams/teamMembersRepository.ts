/**
 * Состав команд (team_members) с проверкой принадлежности team/staff организации.
 */

import type { TeamMemberRow, TeamMemberWithStaffRow } from './types';

import { pool, query } from '@/lib/db';

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
              WHERE s.email IS NOT NULL AND u.email = s.email
              LIMIT 1
            ) AS product_user_id,
            (
              SELECT EXISTS (
                SELECT 1
                FROM public.registry_employees re
                INNER JOIN overseer.staff_roles sr ON sr.staff_uid = re.uuid
                INNER JOIN overseer.roles r ON r.uid = sr.role_uid
                WHERE s.email IS NOT NULL
                  AND re.email IS NOT NULL
                  AND LOWER(TRIM(re.email)) = LOWER(TRIM(s.email))
                  AND COALESCE(r.active, TRUE) = TRUE
                  AND (
                    LOWER(COALESCE(r.slug, '')) LIKE '%lead%'
                    OR LOWER(COALESCE(r.title, '')) LIKE '%lead%'
                    OR LOWER(COALESCE(r.slug, '')) LIKE '%рук%'
                    OR LOWER(COALESCE(r.title, '')) LIKE '%рук%'
                  )
              )
              LIMIT 1
            ) AS product_planner_is_team_lead,
            (s.email IS NOT NULL AND EXISTS (
               SELECT 1
               FROM users u
               WHERE LOWER(TRIM(u.email)) = LOWER(TRIM(s.email))
             )) AS product_user_in_org,
            (s.email IS NOT NULL AND EXISTS (
               SELECT 1
               FROM public.registry_employees re
               INNER JOIN overseer.staff_teams st ON st.staff_uid = re.uuid
               WHERE re.email IS NOT NULL
                 AND LOWER(TRIM(re.email)) = LOWER(TRIM(s.email))
                 AND st.team_uid::text = tm.team_id::text
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

/** Добавляет участника в команду в master-контракте (overseer.staff_teams). */
export async function addOverseerTeamMember(teamId: string, staffUid: string): Promise<boolean> {
  const res = await query<{ ok: number }>(
    `INSERT INTO overseer.staff_teams (team_uid, staff_uid)
     VALUES ($1::uuid, $2::uuid)
     ON CONFLICT DO NOTHING
     RETURNING 1 AS ok`,
    [teamId, staffUid]
  );
  return Boolean(res.rows[0]);
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
 * Удаляет участника из `team_members`.
 */
export async function removeTeamMember(
  organizationId: string,
  teamId: string,
  staffId: string
): Promise<boolean> {
  if (organizationId) {
    // В текущем контракте состав команд хранится в overseer.staff_teams.
    // organizationId оставляем в сигнатуре ради обратной совместимости вызовов.
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const delTm = await client.query(
      `DELETE FROM overseer.staff_teams
       WHERE team_uid = $1::uuid
         AND staff_uid = $2::uuid`,
      [teamId, staffId]
    );
    if ((delTm.rowCount ?? 0) === 0) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    return true;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
