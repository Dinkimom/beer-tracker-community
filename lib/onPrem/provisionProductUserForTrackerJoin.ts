import type { OrgMemberRole } from '@/lib/organizations/types';

import { randomBytes } from 'node:crypto';

import { findUserByEmail, hashPassword, insertUser } from '@/lib/auth';
import {
  findOrganizationMembership,
  insertOrganizationMember,
} from '@/lib/organizations/organizationMembersRepository';
import {
  productTeamRoleToFlags,
  type ProductTeamRole,
  upsertUserTeamMembership,
  userHasTeamMembershipInOrganization,
} from '@/lib/organizations/userTeamMembershipRepository';

/**
 * Создаёт (при необходимости) пользователя продукта, членство в организации с ролью {@link orgRole}
 * и при необходимости строку user_team_memberships — после добавления сотрудника по трекеру.
 */
export async function provisionProductUserForTrackerJoin(input: {
  organizationId: string;
  emailNorm: string;
  orgRole: OrgMemberRole;
  team?: {
    plannerTeamRole: ProductTeamRole;
    teamId: string;
  };
}): Promise<{ userId: string }> {
  const emailNorm = input.emailNorm.trim().toLowerCase();
  let userRow = await findUserByEmail(emailNorm);
  const randomPassHash = hashPassword(randomBytes(48).toString('base64url'));

  if (!userRow) {
    userRow = await insertUser(emailNorm, randomPassHash);
  }

  const om = await findOrganizationMembership(input.organizationId, userRow.id);
  if (!om) {
    await insertOrganizationMember(input.organizationId, userRow.id, input.orgRole);
  }

  if (input.team) {
    if (await userHasTeamMembershipInOrganization(input.organizationId, userRow.id)) {
      throw new Error('Пользователь уже состоит в команде организации');
    }

    const flags = productTeamRoleToFlags(input.team.plannerTeamRole);
    await upsertUserTeamMembership({
      isTeamLead: flags.isTeamLead,
      isTeamMember: flags.isTeamMember,
      teamId: input.team.teamId,
      userId: userRow.id,
    });
  }

  return { userId: userRow.id };
}
