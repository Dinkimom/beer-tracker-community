import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTeamManagementAccess, requireTenantWithAdminProfile } from '@/lib/api-tenant';
import { listOrganizationMembersWithoutTeam } from '@/lib/organizations/userTeamMembershipRepository';
import { findTeamById } from '@/lib/staffTeams';

const UuidSchema = z.string().uuid();

/**
 * GET .../members/add-candidates
 * Пользователи организации без команды — их можно добавить в состав этой команды (уже в системе).
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  const { organizationId, teamId: teamIdRaw } = await routeContext.params;

  const teamIdParsed = UuidSchema.safeParse(teamIdRaw);
  if (!teamIdParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор команды' }, { status: 400 });
  }

  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const denied = requireTeamManagementAccess(auth.profile, teamIdParsed.data);
  if (denied) {
    return denied;
  }

  const orgId = auth.ctx.organizationId;
  const team = await findTeamById(orgId, teamIdParsed.data);
  if (!team) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }

  const rows = await listOrganizationMembersWithoutTeam(orgId);
  return NextResponse.json({
    users: rows.map((r) => ({
      email: r.email,
      userId: r.user_id,
    })),
  });
}
