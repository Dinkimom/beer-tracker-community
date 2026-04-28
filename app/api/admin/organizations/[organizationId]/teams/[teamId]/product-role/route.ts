import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTenantOrgAdmin } from '@/lib/api-tenant';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import { findTeamById } from '@/lib/staffTeams';

const UuidSchema = z.string().uuid();

const PatchBodySchema = z.object({
  team_role: z.enum(['team_lead', 'team_member']),
  user_id: z.string().uuid(),
});

/**
 * PATCH /api/admin/organizations/[organizationId]/teams/[teamId]/product-role
 * Team-level ACL теперь вычисляется из external master БД (overseer.*), не редактируется в приложении.
 */
export async function PATCH(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  const { organizationId, teamId: teamIdRaw } = await routeContext.params;

  const teamIdParsed = UuidSchema.safeParse(teamIdRaw);
  if (!teamIdParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор команды' }, { status: 400 });
  }

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

  const parsed = PatchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Укажите user_id и team_role' }, { status: 400 });
  }

  const orgId = auth.ctx.organizationId;
  const teamId = teamIdParsed.data;
  const { team_role, user_id: userId } = parsed.data;

  const team = await findTeamById(orgId, teamId);
  if (!team) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }

  const membership = await findOrganizationMembership(orgId, userId);
  if (!membership) {
    return NextResponse.json({ error: 'Пользователь не состоит в организации' }, { status: 404 });
  }

  if (team_role) {
    // Role writes are intentionally blocked in this mode.
  }
  return NextResponse.json(
    { error: 'Роль команды управляется во внешней master БД (overseer.*)' },
    { status: 409 }
  );
}
