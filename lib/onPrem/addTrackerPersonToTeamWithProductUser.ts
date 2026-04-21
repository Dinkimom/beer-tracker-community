import type { OrgMemberRole } from '@/lib/organizations/types';

import { findUserByEmail } from '@/lib/auth';
import { invitedTeamRoleFromCatalogRoleSlug } from '@/lib/organizations/invitedTeamRoleFromCatalogSlug';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import {
  addTeamMember,
  findStaffByTrackerUserId,
  findTeamById,
  insertStaff,
  removeTeamMember,
  type TeamMemberRow,
} from '@/lib/staffTeams';

import { provisionProductUserForTrackerJoin } from './provisionProductUserForTrackerJoin';

export class AddTrackerTeamMemberError extends Error {
  override readonly name = 'AddTrackerTeamMemberError';

  constructor(
    message: string,
    public readonly httpStatus: number
  ) {
    super(message);
  }
}

/**
 * Добавляет сотрудника из трекера в организацию (роль в organization_members) и при необходимости в команду
 * с ролью каталога; выдаёт учётку продукта без приглашений.
 */
export async function addTrackerPersonToOrganizationWithProductUser(input: {
  displayName?: string | null;
  emailStr: string;
  organizationId: string;
  orgRole: Extract<OrgMemberRole, 'member' | 'team_lead'>;
  roleSlug?: string | null;
  teamId?: string | null;
  trackerUserId: string;
}): Promise<{ member: TeamMemberRow | null }> {
  const tid = input.trackerUserId.trim();
  const emailNorm = input.emailStr.trim().toLowerCase();
  const teamIdNorm =
    input.teamId != null && String(input.teamId).trim() !== '' ? String(input.teamId).trim() : null;

  const existingUser = await findUserByEmail(emailNorm);
  if (existingUser) {
    const om = await findOrganizationMembership(input.organizationId, existingUser.id);
    if (om) {
      throw new AddTrackerTeamMemberError(
        'Этот email уже в организации. Назначьте команду в разделе «Пользователи», если нужно.',
        409
      );
    }
  }

  if (teamIdNorm) {
    const team = await findTeamById(input.organizationId, teamIdNorm);
    if (!team) {
      throw new AddTrackerTeamMemberError('Команда не найдена', 404);
    }
  }

  const invitedTeamRole = invitedTeamRoleFromCatalogRoleSlug(input.roleSlug ?? null);

  let staffRow = await findStaffByTrackerUserId(input.organizationId, tid);
  if (!staffRow) {
    staffRow = await insertStaff(input.organizationId, {
      display_name: input.displayName?.trim() || tid,
      email: input.emailStr,
      tracker_user_id: tid,
    });
  }

  let member: TeamMemberRow | null = null;
  if (teamIdNorm) {
    member = await addTeamMember(
      input.organizationId,
      teamIdNorm,
      staffRow.id,
      input.roleSlug ?? null
    );
    if (!member) {
      throw new AddTrackerTeamMemberError(
        'Не удалось добавить: команда или сотрудник не найдены',
        404
      );
    }
  }

  try {
    await provisionProductUserForTrackerJoin({
      emailNorm,
      organizationId: input.organizationId,
      orgRole: input.orgRole,
      team:
        teamIdNorm != null
          ? {
              plannerTeamRole: invitedTeamRole,
              teamId: teamIdNorm,
            }
          : undefined,
    });
  } catch (e) {
    if (member && teamIdNorm) {
      await removeTeamMember(input.organizationId, teamIdNorm, staffRow.id);
    }
    const msg = e instanceof Error ? e.message : 'Не удалось выдать доступ к планеру';
    throw new AddTrackerTeamMemberError(msg, 409);
  }

  return { member };
}

/**
 * Добавляет сотрудника по трекеру в команду и сразу выдаёт учётку продукта (member + user_team_memberships), без приглашений.
 */
export async function addTrackerPersonToTeamWithProductUser(input: {
  displayName?: string | null;
  emailStr: string;
  organizationId: string;
  roleSlug?: string | null;
  teamId: string;
  trackerUserId: string;
}): Promise<{ member: TeamMemberRow }> {
  const { member } = await addTrackerPersonToOrganizationWithProductUser({
    displayName: input.displayName,
    emailStr: input.emailStr,
    organizationId: input.organizationId,
    orgRole: 'member',
    roleSlug: input.roleSlug,
    teamId: input.teamId,
    trackerUserId: input.trackerUserId,
  });
  if (!member) {
    throw new AddTrackerTeamMemberError(
      'Не удалось добавить: команда или сотрудник не найдены',
      404
    );
  }
  return { member };
}
