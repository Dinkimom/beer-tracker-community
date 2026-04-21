import { query } from '@/lib/db';

/**
 * Сотрудник состоит хотя бы в одной команде организации (team_members).
 */
export async function staffHasTeamMembershipInOrganization(
  organizationId: string,
  staffId: string
): Promise<boolean> {
  const res = await query<{ one: number }>(
    `SELECT 1 AS one
     FROM team_members tm
     INNER JOIN teams t ON t.id = tm.team_id AND t.organization_id = $1
     WHERE tm.staff_id = $2::uuid
     LIMIT 1`,
    [organizationId, staffId]
  );
  return res.rows.length > 0;
}
