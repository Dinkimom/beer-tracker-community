import { findUserById } from '@/lib/auth';
import { CATALOG_TEAMLEAD_SLUG } from '@/lib/organizations/invitedTeamRoleFromCatalogSlug';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import {
  listUserTeamMembershipsInOrganization,
  type ProductTeamRole,
} from '@/lib/organizations/userTeamMembershipRepository';
import {
  addTeamMember,
  findStaffByOrganizationAndEmailNorm,
  findTeamById,
  insertStaff,
  listTeamIdsForStaffInOrganization,
  removeTeamMember,
} from '@/lib/staffTeams';

function displayNameFromUserEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at > 0) {
    return e.slice(0, at);
  }
  return e.length > 0 ? e : 'Пользователь';
}

export type SetOrganizationMemberTeamResult =
  { error: string; status: number } | { ok: true };

/**
 * Снимает пользователя со всех команд организации (staff + team_members)
 * и при необходимости добавляет в указанную команду с ролью планера.
 */
export async function setOrganizationMemberTeam(input: {
  organizationId: string;
  userId: string;
  /** null — только снять с команд */
  teamId: string | null;
  /**
   * Роль при назначении, если не сохраняем прежнюю.
   * При `preservePlannerTeamRole: true` берётся из текущего членства до снятия.
   */
  teamRoleOnAssign?: ProductTeamRole;
  /** Сохранить team_lead / team_member планера при смене команды */
  preservePlannerTeamRole?: boolean;
}): Promise<SetOrganizationMemberTeamResult> {
  const { organizationId: orgId, userId, teamId: targetTeamId } = input;

  const membership = await findOrganizationMembership(orgId, userId);
  if (!membership) {
    return { error: 'Пользователь не состоит в организации', status: 404 };
  }

  const userRow = await findUserById(userId);
  if (!userRow) {
    return { error: 'Пользователь не найден', status: 404 };
  }

  const existingAtStart = await listUserTeamMembershipsInOrganization(orgId, userId);

  if (
    targetTeamId != null &&
    existingAtStart.length === 1 &&
    existingAtStart[0]!.team_id === targetTeamId
  ) {
    return { ok: true };
  }

  if (targetTeamId == null && existingAtStart.length === 0) {
    return { ok: true };
  }

  let roleForAssign: ProductTeamRole = input.teamRoleOnAssign ?? 'team_member';
  if (input.preservePlannerTeamRole && existingAtStart.length > 0) {
    roleForAssign = existingAtStart[0]!.is_team_lead ? 'team_lead' : 'team_member';
  }

  const emailNorm = String(userRow.email).trim().toLowerCase();
  let staffRow = await findStaffByOrganizationAndEmailNorm(orgId, emailNorm);

  if (staffRow) {
    const teamIds = await listTeamIdsForStaffInOrganization(orgId, staffRow.id);
    for (const tid of teamIds) {
      await removeTeamMember(orgId, tid, staffRow.id);
    }
  }

  if (targetTeamId == null) {
    return { ok: true };
  }

  const team = await findTeamById(orgId, targetTeamId);
  if (!team) {
    return { error: 'Команда не найдена', status: 404 };
  }

  if (!staffRow) {
    staffRow = await insertStaff(orgId, {
      display_name: displayNameFromUserEmail(emailNorm),
      email: emailNorm,
      tracker_user_id: null,
    });
  }

  const roleSlug = roleForAssign === 'team_lead' ? CATALOG_TEAMLEAD_SLUG : null;
  const member = await addTeamMember(orgId, targetTeamId, staffRow.id, roleSlug);
  if (!member) {
    return { error: 'Не удалось добавить: команда или сотрудник не найдены', status: 404 };
  }

  if (!userId) {
    return { error: 'Пользователь не найден', status: 404 };
  }

  return { ok: true };
}
