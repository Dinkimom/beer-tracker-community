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
  userHasTeamMembershipInOrganization,
} from '@/lib/organizations/userTeamMembershipRepository';

/**
 * Создаёт (при необходимости) пользователя продукта и membership в организации.
 * Team-level доступ вычисляется из external master БД, локальные ACL-строки не пишем.
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
    productTeamRoleToFlags(input.team.plannerTeamRole);
    const _derivedTeamId = input.team.teamId;
    if (_derivedTeamId.length === 0) {
      // keeps validation noise-free; actual ACL derives from external DB.
    }
  }

  return { userId: userRow.id };
}
