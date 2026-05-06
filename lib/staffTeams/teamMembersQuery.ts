/**
 * Участники команд и поиск staff в PostgreSQL приложения (tenant).
 */

import type { TeamMember } from '@/types/team';

import { query } from '@/lib/db';
import { canReadRegistryFromPublicSchema } from '@/lib/dbContract';
import { isOnPremMode } from '@/lib/deploymentMode';

import { getTeamByBoardId } from './teamsRepository';

/** Данные сотрудника из таблицы staff */
export interface StaffRegistryItem {
  avatarUrl?: string | null;
  birthdate?: string | null;
  displayName: string;
  email?: string | null;
  trackerId: string;
}

interface PublicRegistryRow {
  avatar_link: string | null;
  birthdate: Date | string | null;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  name: string | null;
  patronymic: string | null;
  surname: string | null;
  tracker_id: string | number | null;
  uuid: string;
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

function displayNameFromPublicRegistry(row: PublicRegistryRow): string {
  const last = (row.last_name ?? row.surname ?? '').trim();
  const first = (row.first_name ?? row.name ?? '').trim();
  // Для UI отображаем "Имя Фамилия" без отчества (middle/patronymic).
  if (first && last) return `${first} ${last}`;
  if (last) return last;
  if (first) return first;
  return '';
}

function normalizeBirthdate(value: Date | string | null): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return value.toISOString().slice(0, 10);
}

function publicRegistryToItem(row: PublicRegistryRow): StaffRegistryItem {
  const displayName = displayNameFromPublicRegistry(row);
  return {
    trackerId: String(row.tracker_id ?? row.uuid).trim() || row.uuid,
    displayName: displayName || row.uuid,
    avatarUrl: row.avatar_link ?? null,
    birthdate: normalizeBirthdate(row.birthdate),
    email: null,
  };
}

interface TeamMemberQueryRow {
  role_slug: string | null;
  staff_avatar_url: string | null;
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
    avatarUrl: row.staff_avatar_url ?? manualFlagString(flags, 'avatarUrl'),
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
  const onPrem = isOnPremMode();
  const team = await getTeamByBoardId(organizationId, boardId);
  if (!team) {
    return [];
  }

  if (onPrem) {
    const overseerRes = await query<TeamMemberQueryRow>(
      `SELECT
          role_pick.slug AS role_slug,
          COALESCE(re.uuid::text, re.id::text) AS staff_id,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', re.name, re.surname)), ''),
            NULLIF(TRIM(re.fullname), ''),
            COALESCE(re.uuid::text, re.id::text)
          ) AS staff_display_name,
          re.email AS staff_email,
          re.avatar_link AS staff_avatar_url,
          NULLIF(TRIM(re.tracker_id::text), '') AS staff_tracker_user_id,
          NULL::jsonb AS staff_manual_override_flags,
          t.uid::text AS team_id,
          t.slug AS team_slug,
          t.title AS team_title,
          t.queue AS team_tracker_queue_key,
          t.board::text AS team_tracker_board_id,
          COALESCE(t.active, TRUE) AS team_active
       FROM overseer.teams t
       INNER JOIN overseer.staff_teams st ON st.team_uid = t.uid
       INNER JOIN public.registry_employees re ON re.uuid = st.staff_uid
       LEFT JOIN LATERAL (
         SELECT r.slug
         FROM overseer.staff_roles sr
         INNER JOIN overseer.roles r ON r.uid = sr.role_uid
         WHERE sr.staff_uid = st.staff_uid
           AND COALESCE(r.active, TRUE) = TRUE
         ORDER BY r.slug ASC
         LIMIT 1
       ) role_pick ON TRUE
       WHERE t.uid::text = $1
       ORDER BY staff_display_name ASC`,
      [team.id]
    );
    return overseerRes.rows.map(mapTeamMemberRow);
  }

  const res = await query<TeamMemberQueryRow>(
    onPrem
      ? `SELECT tm.role_slug,
            s.id AS staff_id,
            s.display_name AS staff_display_name,
            s.email AS staff_email,
            NULL::text AS staff_avatar_url,
            s.tracker_user_id AS staff_tracker_user_id,
            s.manual_override_flags AS staff_manual_override_flags,
            t.id AS team_id,
            t.slug AS team_slug,
            t.title AS team_title,
            t.tracker_queue_key AS team_tracker_queue_key,
            t.tracker_board_id::text AS team_tracker_board_id,
            t.active AS team_active
       FROM team_members tm
       INNER JOIN teams t ON t.id = tm.team_id
       INNER JOIN staff s ON s.id = tm.staff_id
       WHERE tm.team_id = $1::uuid
       ORDER BY s.display_name ASC`
      : `SELECT tm.role_slug,
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
    onPrem ? [team.id] : [organizationId, team.id]
  );

  return res.rows.map(mapTeamMemberRow);
}

/**
 * Все участники активных команд организации (для поиска по имени).
 */
export async function fetchAllTeamMembersForOrg(
  organizationId: string
): Promise<TeamMember[]> {
  const onPrem = isOnPremMode();
  if (onPrem) {
    const overseerRes = await query<TeamMemberQueryRow>(
      `SELECT
          role_pick.slug AS role_slug,
          COALESCE(re.uuid::text, re.id::text) AS staff_id,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', re.name, re.surname)), ''),
            NULLIF(TRIM(re.fullname), ''),
            COALESCE(re.uuid::text, re.id::text)
          ) AS staff_display_name,
          re.email AS staff_email,
          re.avatar_link AS staff_avatar_url,
          NULLIF(TRIM(re.tracker_id::text), '') AS staff_tracker_user_id,
          NULL::jsonb AS staff_manual_override_flags,
          t.uid::text AS team_id,
          t.slug AS team_slug,
          t.title AS team_title,
          t.queue AS team_tracker_queue_key,
          t.board::text AS team_tracker_board_id,
          COALESCE(t.active, TRUE) AS team_active
       FROM overseer.teams t
       INNER JOIN overseer.staff_teams st ON st.team_uid = t.uid
       INNER JOIN public.registry_employees re ON re.uuid = st.staff_uid
       LEFT JOIN LATERAL (
         SELECT r.slug
         FROM overseer.staff_roles sr
         INNER JOIN overseer.roles r ON r.uid = sr.role_uid
         WHERE sr.staff_uid = st.staff_uid
           AND COALESCE(r.active, TRUE) = TRUE
         ORDER BY r.slug ASC
         LIMIT 1
       ) role_pick ON TRUE
       WHERE COALESCE(t.active, TRUE) = TRUE
       ORDER BY staff_display_name ASC`
    );
    return overseerRes.rows.map(mapTeamMemberRow);
  }

  const res = await query<TeamMemberQueryRow>(
    `SELECT tm.role_slug,
            s.id AS staff_id,
            s.display_name AS staff_display_name,
            s.email AS staff_email,
            NULL::text AS staff_avatar_url,
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
  void organizationId; // поиск идёт по registry_employees (public), не по tenant staff
  if (!canReadRegistryFromPublicSchema()) {
    return [];
  }
  const registryRes = await query<PublicRegistryRow>(
    `SELECT
        uuid,
        tracker_id,
        name,
        surname,
        patronymic,
        NULL::text AS first_name,
        NULL::text AS last_name,
        NULL::text AS middle_name,
        avatar_link,
        birthdate
     FROM public.registry_employees
     WHERE (
       coalesce(surname, '') ILIKE $1
       OR coalesce(name, '') ILIKE $1
       OR coalesce(patronymic, '') ILIKE $1
       OR coalesce(fullname, '') ILIKE $1
     )
     ORDER BY surname ASC NULLS LAST, name ASC NULLS LAST
     LIMIT 30`,
    [pattern]
  );
  return registryRes.rows.map(publicRegistryToItem);
}

export async function getStaffByTrackerUserIdInOrg(
  organizationId: string,
  trackerUserId: string
): Promise<StaffRegistryItem | null> {
  void organizationId; // данные берём из registry_employees (public), не из tenant staff
  if (!canReadRegistryFromPublicSchema()) {
    return null;
  }
  const registryRes = await query<PublicRegistryRow>(
    `SELECT
        uuid,
        tracker_id,
        name,
        surname,
        patronymic,
        NULL::text AS first_name,
        NULL::text AS last_name,
        NULL::text AS middle_name,
        avatar_link,
        birthdate
     FROM public.registry_employees
     WHERE tracker_id::text = $1 OR uuid::text = $1
     LIMIT 1`,
    [trackerUserId]
  );
  const registryRow = registryRes.rows[0];
  return registryRow ? publicRegistryToItem(registryRow) : null;
}

export async function getStaffByTrackerUserIdsInOrg(
  organizationId: string,
  trackerUserIds: string[]
): Promise<StaffRegistryItem[]> {
  if (trackerUserIds.length === 0) {
    return [];
  }
  if (canReadRegistryFromPublicSchema()) {
    const registryRes = await query<PublicRegistryRow>(
      `SELECT
          uuid,
          tracker_id,
          name,
          surname,
          patronymic,
          NULL::text AS first_name,
          NULL::text AS last_name,
          NULL::text AS middle_name,
          avatar_link,
          birthdate
      FROM public.registry_employees
      WHERE tracker_id::text = ANY($1::text[]) OR uuid::text = ANY($1::text[])`,
      [trackerUserIds]
    );
    if (registryRes.rows.length > 0) {
      return registryRes.rows.map(publicRegistryToItem);
    }
  }
  void organizationId; // staff fallback запрещен, если нет доступа к public.registry_employees
  return [];
}
