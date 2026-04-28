/**
 * Членство пользователей в организации:
 * - админ-права из users.is_super_admin
 * - доступ к планеру из public.registry_employees (по email).
 */

import type {
  OrganizationMemberRow,
  OrgMemberRole,
  UserOrganizationSummary,
} from './types';

import { findUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { findOrganizationById, listAllOrganizationsAdminSummaries } from '@/lib/organizations/organizationRepository';

export async function findOrganizationMembership(
  organizationId: string,
  userId: string
): Promise<OrganizationMemberRow | null> {
  const [org, user] = await Promise.all([findOrganizationById(organizationId), findUserById(userId)]);
  if (!org || !user) {
    return null;
  }
  if (user.is_super_admin) {
    return {
      id: `${organizationId}:${userId}`,
      organization_id: organizationId,
      user_id: userId,
      role: 'org_admin',
      created_at: user.created_at,
    };
  }
  const registry = await query<{ one: number }>(
    `SELECT 1 AS one
     FROM public.registry_employees re
     WHERE re.email IS NOT NULL
       AND LOWER(TRIM(re.email)) = LOWER(TRIM($1))
     LIMIT 1`,
    [user.email]
  );
  if (registry.rows.length === 0) {
    return null;
  }
  return {
    id: `${organizationId}:${userId}`,
    organization_id: organizationId,
    user_id: userId,
    role: 'member',
    created_at: user.created_at,
  };
}

export async function listUserOrganizations(
  userId: string
): Promise<UserOrganizationSummary[]> {
  const user = await findUserById(userId);
  if (!user) {
    return [];
  }
  const orgs = await listAllOrganizationsAdminSummaries();
  if (user.is_super_admin) {
    return orgs;
  }
  return orgs.map((o) => ({ ...o, role: 'member' as const }));
}

export async function listOrganizationMembers(
  organizationId: string
): Promise<OrganizationMemberRow[]> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return [];
  }
  const res = await query<OrganizationMemberRow>(
    `SELECT u.id AS id, $1::uuid AS organization_id, u.id AS user_id,
            CASE WHEN u.is_super_admin THEN 'org_admin' ELSE 'member' END AS role,
            u.created_at
     FROM users u
     ORDER BY u.created_at ASC`,
    [organizationId]
  );
  return res.rows as OrganizationMemberRow[];
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

export interface TeamDirectoryMemberRow {
  avatar_link: string | null;
  email: string | null;
  full_name: string | null;
  name: string | null;
  patronymic: string | null;
  staff_uid: string;
  surname: string | null;
  tracker_id: string | null;
}

export interface TeamDirectoryRow {
  active: boolean;
  board: number | null;
  queue: string | null;
  team_id: string;
  team_slug: string | null;
  team_title: string;
}

export interface OrganizationTeamDirectoryItem {
  members: TeamDirectoryMemberRow[];
  team: TeamDirectoryRow;
}

export interface RegistryEmployeeDirectoryRow {
  avatar_link: string | null;
  email: string | null;
  employee_id: string;
  fired_date: string | null;
  full_name: string | null;
  name: string | null;
  patronymic: string | null;
  staff_uid: string;
  status: string | null;
  surname: string | null;
  teams: Array<{ team_id: string; team_title: string }>;
  tracker_id: string | null;
}

export async function listOrganizationTeamsWithMembersFromOverseer(
  organizationId: string
): Promise<OrganizationTeamDirectoryItem[]> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return [];
  }
  const teamsRes = await query<TeamDirectoryRow>(
    `SELECT
        t.uid::text AS team_id,
        t.slug AS team_slug,
        t.title AS team_title,
        t.queue,
        t.board,
        COALESCE(t.active, TRUE) AS active
     FROM overseer.teams t
     ORDER BY t.title ASC`
  );
  const teams = teamsRes.rows;
  if (teams.length === 0) {
    return [];
  }

  const membersRes = await query<
    TeamDirectoryMemberRow & {
      team_id: string;
    }
  >(
    `SELECT
        st.team_uid::text AS team_id,
        st.staff_uid::text AS staff_uid,
        re.tracker_id,
        re.avatar_link,
        re.email,
        re.name,
        re.surname,
        re.patronymic,
        re.fullname AS full_name
     FROM overseer.staff_teams st
     LEFT JOIN public.registry_employees re ON re.uuid = st.staff_uid`
  );

  const membersByTeam = new Map<string, TeamDirectoryMemberRow[]>();
  for (const row of membersRes.rows) {
    const arr = membersByTeam.get(row.team_id) ?? [];
    arr.push({
      avatar_link: row.avatar_link,
      email: row.email,
      full_name: row.full_name,
      name: row.name,
      patronymic: row.patronymic,
      staff_uid: row.staff_uid,
      surname: row.surname,
      tracker_id: row.tracker_id,
    });
    membersByTeam.set(row.team_id, arr);
  }

  return teams.map((team) => ({
    team,
    members: (membersByTeam.get(team.team_id) ?? []).sort((a, b) => {
      const aName = (a.full_name ?? `${a.surname ?? ''} ${a.name ?? ''}`.trim() ?? a.staff_uid).trim();
      const bName = (b.full_name ?? `${b.surname ?? ''} ${b.name ?? ''}`.trim() ?? b.staff_uid).trim();
      return aName.localeCompare(bName, 'ru');
    }),
  }));
}

export async function listRegistryEmployeesDirectory(
  organizationId: string
): Promise<RegistryEmployeeDirectoryRow[]> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return [];
  }

  const res = await query<RegistryEmployeeDirectoryRow>(
    `SELECT
        re.id::text AS employee_id,
        COALESCE(re.uuid::text, re.id::text) AS staff_uid,
        re.tracker_id,
        re.email,
        re.name,
        re.surname,
        re.patronymic,
        re.fullname AS full_name,
        re.status,
        re.avatar_link,
        re.fired_date::text AS fired_date,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'team_id', t.uid::text,
                'team_title', t.title
              )
              ORDER BY t.title
            )
            FROM overseer.staff_teams st
            INNER JOIN overseer.teams t ON t.uid = st.team_uid
            WHERE st.staff_uid = re.uuid
          ),
          '[]'::json
        ) AS teams
     FROM public.registry_employees re
     ORDER BY COALESCE(NULLIF(TRIM(re.fullname), ''), re.email, re.tracker_id::text, re.id::text) ASC`
  );

  return res.rows.map((row) => ({
    ...row,
    teams: Array.isArray(row.teams) ? row.teams : [],
  }));
}

export async function listOrganizationMemberDirectory(
  organizationId: string
): Promise<OrganizationMemberDirectoryRow[]> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return [];
  }
  const res = await query<OrganizationMemberDirectoryRow>(
    `SELECT u.id AS user_id,
            CASE WHEN u.is_super_admin THEN 'org_admin' ELSE 'member' END AS org_role,
            u.email,
            u.created_at,
            EXISTS (
              SELECT 1
              FROM public.registry_employees re
              INNER JOIN overseer.staff_teams st ON st.staff_uid = re.uuid
              WHERE re.email IS NOT NULL
                AND LOWER(TRIM(re.email)) = LOWER(TRIM(u.email))
            ) AS has_team_membership,
            COALESCE(
              (
                SELECT json_agg(
                  json_build_object(
                    'team_id', t.uid::text,
                    'title', t.title,
                    'is_team_lead', false,
                    'is_team_member', true
                  )
                  ORDER BY t.title
                )
                FROM public.registry_employees re
                INNER JOIN overseer.staff_teams st ON st.staff_uid = re.uuid
                INNER JOIN overseer.teams t ON t.uid = st.team_uid
                WHERE re.email IS NOT NULL
                  AND LOWER(TRIM(re.email)) = LOWER(TRIM(u.email))
              ),
              '[]'::json
            ) AS teams_json
     FROM users u
     ORDER BY u.created_at ASC`
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
  const user = await findUserById(userId);
  const org = await findOrganizationById(organizationId);
  if (!user || !org) {
    throw new Error('insertOrganizationMember: user or organization not found');
  }
  if (role === 'org_admin') {
    await query(`UPDATE users SET is_super_admin = TRUE WHERE id = $1`, [userId]);
  }
  return (await findOrganizationMembership(organizationId, userId)) as OrganizationMemberRow;
}

export async function countOrganizationMembersByRole(
  organizationId: string,
  role: OrgMemberRole
): Promise<number> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return 0;
  }
  if (role === 'org_admin') {
    const admins = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM users WHERE is_super_admin = TRUE`
    );
    const n = Number.parseInt(admins.rows[0]?.count ?? '0', 10);
    return Number.isFinite(n) ? n : 0;
  }
  const res = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users WHERE is_super_admin = FALSE`
  );
  const n = Number.parseInt(res.rows[0]?.count ?? '0', 10);
  return Number.isFinite(n) ? n : 0;
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: OrgMemberRole
): Promise<OrganizationMemberRow | null> {
  const current = await findOrganizationMembership(organizationId, userId);
  if (!current) {
    return null;
  }
  if (role === 'org_admin') {
    await query(`UPDATE users SET is_super_admin = TRUE WHERE id = $1`, [userId]);
  } else {
    await query(`UPDATE users SET is_super_admin = FALSE WHERE id = $1`, [userId]);
  }
  return findOrganizationMembership(organizationId, userId);
}

export async function deleteOrganizationMember(
  organizationId: string,
  userId: string
): Promise<boolean> {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    return false;
  }
  await query(`UPDATE users SET is_super_admin = FALSE WHERE id = $1`, [userId]);
  return true;
}

export function deleteOrganizationUserAccount(
  organizationId: string,
  userId: string
): Promise<boolean> {
  if (organizationId || userId) {
    // В новой модели удаление людей из реестра запрещено.
  }
  return Promise.resolve(false);
}
