/**
 * Профиль доступа пользователя в организации (роли + команды). Источник прав для API и сессии.
 */

import type { OrgMemberRole, UserOrganizationSummary } from '@/lib/organizations/types';

import { isProductSuperAdmin } from '@/lib/auth/superAdmin';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import { findOrganizationById } from '@/lib/organizations/organizationRepository';
import { listUserTeamMembershipsInOrganization } from '@/lib/organizations/userTeamMembershipRepository';

export interface TeamAccessEntry {
  isTeamLead: boolean;
  isTeamMember: boolean;
  teamId: string;
}

export interface AccessProfile {
  organizationId: string;
  orgRole: OrgMemberRole;
  teamMemberships: TeamAccessEntry[];
  userId: string;
}

export function canAccessAdminShell(profile: AccessProfile): boolean {
  if (profile.orgRole === 'org_admin' || profile.orgRole === 'team_lead') {
    return true;
  }
  return profile.teamMemberships.some((t) => t.isTeamLead);
}

export function isOrganizationAdminProfile(profile: AccessProfile): boolean {
  return profile.orgRole === 'org_admin';
}

export function isTeamLeadForTeam(profile: AccessProfile, teamId: string): boolean {
  return profile.teamMemberships.some((t) => t.teamId === teamId && t.isTeamLead);
}

/** Настройки команды и состав: org_admin или тимлид этой команды. */
export function canManageTeamInAdmin(profile: AccessProfile, teamId: string): boolean {
  if (isOrganizationAdminProfile(profile)) {
    return true;
  }
  return isTeamLeadForTeam(profile, teamId);
}

/**
 * org_admin — всегда; иначе нужна хотя бы одна команда (lead или member).
 */
export function canUsePlanner(profile: AccessProfile): boolean {
  if (profile.orgRole === 'org_admin') {
    return true;
  }
  return profile.teamMemberships.length > 0;
}

/**
 * Команды, которыми пользователь управляет в админке как тимлид.
 * `null` — org_admin (все команды организации); иначе список `team_id`.
 */
export function managedTeamIdsForAccessProfile(profile: AccessProfile): string[] | null {
  if (profile.orgRole === 'org_admin') {
    return null;
  }
  return profile.teamMemberships.filter((t) => t.isTeamLead).map((t) => t.teamId);
}

/** Команды, доступные в планере: org_admin — все переданные; иначе только с членством (member или lead). */
export function filterTeamsVisibleInPlanner<T extends { id: string }>(
  profile: AccessProfile,
  teams: T[]
): T[] {
  if (profile.orgRole === 'org_admin') {
    return teams;
  }
  const allowed = new Set(
    profile.teamMemberships
      .filter((m) => m.isTeamMember || m.isTeamLead)
      .map((m) => m.teamId)
  );
  return teams.filter((t) => allowed.has(t.id));
}

export async function resolveAccessProfile(
  userId: string,
  organizationId: string
): Promise<AccessProfile | null> {
  const membership = await findOrganizationMembership(organizationId, userId);
  if (membership) {
    const rows = await listUserTeamMembershipsInOrganization(organizationId, userId);
    const teamMemberships: TeamAccessEntry[] = rows.map((r) => ({
      isTeamLead: r.is_team_lead,
      isTeamMember: r.is_team_member,
      teamId: r.team_id,
    }));
    return {
      organizationId,
      orgRole: membership.role,
      teamMemberships,
      userId,
    };
  }
  if (await isProductSuperAdmin(userId)) {
    const org = await findOrganizationById(organizationId);
    if (!org) {
      return null;
    }
    return {
      organizationId,
      orgRole: 'org_admin',
      teamMemberships: [],
      userId,
    };
  }
  return null;
}

/** Добавляет canAccessAdmin / canUsePlanner к строкам из listUserOrganizations. */
export async function enrichOrganizationSummariesForUser(
  userId: string,
  summaries: UserOrganizationSummary[]
): Promise<UserOrganizationSummary[]> {
  return Promise.all(
    summaries.map(async (o) => {
      const profile = await resolveAccessProfile(userId, o.organization_id);
      if (!profile) {
        return {
          ...o,
          canAccessAdmin: false,
          canUsePlanner: false,
          managedTeamIds: [],
        };
      }
      return {
        ...o,
        canAccessAdmin: canAccessAdminShell(profile),
        canUsePlanner: canUsePlanner(profile),
        managedTeamIds: managedTeamIdsForAccessProfile(profile),
      };
    })
  );
}
