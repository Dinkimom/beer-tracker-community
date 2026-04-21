/**
 * Участники команд и поиск staff в PostgreSQL приложения (tenant).
 */

import type { TeamMember } from '@/types/team';

import { query } from '@/lib/db';

import { getTeamByBoardId } from './teamsRepository';

/** Данные сотрудника из таблицы staff */
export interface StaffRegistryItem {
  avatarUrl?: string | null;
  birthdate?: string | null;
  displayName: string;
  email?: string | null;
  trackerId: string;
}

function manualFlagString(
  flags: Record<string, unknown> | null,
  key: string
): string | null {
  if (!flags || typeof flags !== 'object') {
    return null;
  }
  const v = flags[key];
  if (typeof v !== 'string' || !v.trim()) {
    return null;
  }
  return v.trim();
}

function splitDisplayName(displayName: string): { firstName: string; lastName: string } {
  const t = displayName.trim();
  if (!t) {
    return { firstName: '', lastName: '' };
  }
  const parts = t.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? '', lastName: '' };
  }
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

function staffRowToRegistryItem(row: {
  display_name: string;
  email: string | null;
  manual_override_flags: Record<string, unknown> | null;
  tracker_user_id: string | null;
}): StaffRegistryItem | null {
  if (!row.tracker_user_id) {
    return null;
  }
  const flags = row.manual_override_flags;
  return {
    trackerId: row.tracker_user_id,
    displayName: row.display_name,
    email: row.email ?? null,
    avatarUrl: manualFlagString(flags, 'avatarUrl'),
    birthdate: manualFlagString(flags, 'birthdate'),
  };
}

interface TeamMemberQueryRow {
  role_slug: string | null;
  staff_display_name: string;
  staff_email: string | null;
  staff_id: string;
  staff_manual_override_flags: Record<string, unknown> | null;
  staff_tracker_user_id: string | null;
  team_active: boolean;
  team_id: string;
  team_slug: string;
  team_title: string;
  team_tracker_board_id: string;
  team_tracker_queue_key: string;
}

function mapTeamMemberRow(row: TeamMemberQueryRow): TeamMember {
  const { firstName, lastName } = splitDisplayName(row.staff_display_name);
  const email = row.staff_email ?? undefined;
  const flags = row.staff_manual_override_flags;
  const roleSlug = row.role_slug?.trim();
  const boardNum = Number.parseInt(String(row.team_tracker_board_id), 10);

  return {
    uid: row.staff_id,
    tracker_uid: row.staff_tracker_user_id,
    login: email?.split('@')[0] ?? '',
    firstName,
    lastName,
    middleName: undefined,
    email,
    displayName: row.staff_display_name,
    avatarUrl: manualFlagString(flags, 'avatarUrl'),
    team: {
      uid: row.team_id,
      slug: row.team_slug,
      title: row.team_title,
      queue: row.team_tracker_queue_key,
      board: Number.isFinite(boardNum) ? boardNum : 0,
    },
    role: roleSlug
      ? { uid: roleSlug, slug: roleSlug, title: roleSlug }
      : undefined,
    active: row.team_active !== false,
  };
}

/**
 * Участники команды по boardId трекера в рамках организации.
 */
export async function fetchTeamMembersByBoardIdForOrg(
  organizationId: string,
  boardId: number
): Promise<TeamMember[]> {
  const team = await getTeamByBoardId(organizationId, boardId);
  if (!team) {
    return [];
  }

  const res = await query<TeamMemberQueryRow>(
    `SELECT tm.role_slug,
            s.id AS staff_id,
            s.display_name AS staff_display_name,
            s.email AS staff_email,
            s.tracker_user_id AS staff_tracker_user_id,
            s.manual_override_flags AS staff_manual_override_flags,
            t.id AS team_id,
            t.slug AS team_slug,
            t.title AS team_title,
            t.tracker_queue_key AS team_tracker_queue_key,
            t.tracker_board_id::text AS team_tracker_board_id,
            t.active AS team_active
     FROM team_members tm
     INNER JOIN teams t ON t.id = tm.team_id AND t.organization_id = $1
     INNER JOIN staff s ON s.id = tm.staff_id AND s.organization_id = $1
     WHERE tm.team_id = $2::uuid
     ORDER BY s.display_name ASC`,
    [organizationId, team.id]
  );

  return res.rows.map(mapTeamMemberRow);
}

/**
 * Все участники активных команд организации (для поиска по имени).
 */
export async function fetchAllTeamMembersForOrg(
  organizationId: string
): Promise<TeamMember[]> {
  const res = await query<TeamMemberQueryRow>(
    `SELECT tm.role_slug,
            s.id AS staff_id,
            s.display_name AS staff_display_name,
            s.email AS staff_email,
            s.tracker_user_id AS staff_tracker_user_id,
            s.manual_override_flags AS staff_manual_override_flags,
            t.id AS team_id,
            t.slug AS team_slug,
            t.title AS team_title,
            t.tracker_queue_key AS team_tracker_queue_key,
            t.tracker_board_id::text AS team_tracker_board_id,
            t.active AS team_active
     FROM team_members tm
     INNER JOIN teams t ON t.id = tm.team_id AND t.organization_id = $1
     INNER JOIN staff s ON s.id = tm.staff_id AND s.organization_id = $1
     WHERE t.active = TRUE
     ORDER BY s.display_name ASC`,
    [organizationId]
  );

  return res.rows.map(mapTeamMemberRow);
}

/**
 * Поиск staff по display_name / email (как registry ILIKE).
 */
export async function searchStaffInOrg(
  organizationId: string,
  queryText: string
): Promise<StaffRegistryItem[]> {
  const q = queryText.trim();
  if (!q || q.length < 2) {
    return [];
  }
  const pattern = `%${q.replace(/%/g, '\\%')}%`;
  const res = await query<{
    display_name: string;
    email: string | null;
    manual_override_flags: Record<string, unknown> | null;
    tracker_user_id: string | null;
  }>(
    `SELECT tracker_user_id, display_name, email, manual_override_flags
     FROM staff
     WHERE organization_id = $1
       AND tracker_user_id IS NOT NULL
       AND (
         display_name ILIKE $2
         OR COALESCE(email, '') ILIKE $2
       )
     ORDER BY display_name ASC
     LIMIT 30`,
    [organizationId, pattern]
  );

  return res.rows
    .map(staffRowToRegistryItem)
    .filter((x): x is StaffRegistryItem => x !== null);
}

export async function getStaffByTrackerUserIdInOrg(
  organizationId: string,
  trackerUserId: string
): Promise<StaffRegistryItem | null> {
  const res = await query<{
    display_name: string;
    email: string | null;
    manual_override_flags: Record<string, unknown> | null;
    tracker_user_id: string | null;
  }>(
    `SELECT tracker_user_id, display_name, email, manual_override_flags
     FROM staff
     WHERE organization_id = $1 AND tracker_user_id = $2`,
    [organizationId, trackerUserId]
  );
  const row = res.rows[0];
  if (!row) {
    return null;
  }
  return staffRowToRegistryItem(row);
}

export async function getStaffByTrackerUserIdsInOrg(
  organizationId: string,
  trackerUserIds: string[]
): Promise<StaffRegistryItem[]> {
  if (trackerUserIds.length === 0) {
    return [];
  }
  const res = await query<{
    display_name: string;
    email: string | null;
    manual_override_flags: Record<string, unknown> | null;
    tracker_user_id: string | null;
  }>(
    `SELECT tracker_user_id, display_name, email, manual_override_flags
     FROM staff
     WHERE organization_id = $1 AND tracker_user_id = ANY($2::text[])`,
    [organizationId, trackerUserIds]
  );
  return res.rows
    .map(staffRowToRegistryItem)
    .filter((x): x is StaffRegistryItem => x !== null);
}
