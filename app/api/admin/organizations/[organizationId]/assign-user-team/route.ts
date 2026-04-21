import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTenantOrgAdmin } from '@/lib/api-tenant';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import {
  productTeamRoleToFlags,
  upsertUserTeamMembership,
  userHasTeamMembershipInOrganization,
} from '@/lib/organizations/userTeamMembershipRepository';
import { findTeamById } from '@/lib/staffTeams';

const PostBodySchema = z.object({
  team_id: z.string().uuid(),
  team_role: z.enum(['team_lead', 'team_member']),
  user_id: z.string().uuid(),
});

/**
 * POST /api/admin/organizations/[organizationId]/assign-user-team
 * org_admin: назначить участника org в команду (только если у него ещё нет команд в этой org).
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantOrgAdmin(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }
  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Укажите user_id, team_id и team_role' }, { status: 400 });
  }

  const { team_id: teamId, team_role, user_id: userId } = parsed.data;
  const orgId = auth.ctx.organizationId;

  const membership = await findOrganizationMembership(orgId, userId);
  if (!membership) {
    return NextResponse.json({ error: 'Пользователь не состоит в организации' }, { status: 404 });
  }

  if (await userHasTeamMembershipInOrganization(orgId, userId)) {
    return NextResponse.json(
      { error: 'У пользователя уже есть команда в этой организации' },
      { status: 409 }
    );
  }

  const team = await findTeamById(orgId, teamId);
  if (!team) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }

  const flags = productTeamRoleToFlags(team_role);
  await upsertUserTeamMembership({
    isTeamLead: flags.isTeamLead,
    isTeamMember: flags.isTeamMember,
    teamId,
    userId,
  });

  return NextResponse.json({ ok: true });
}
