import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTenantWithAdminProfile } from '@/lib/api-tenant';
import {
  AddTrackerTeamMemberError,
  addTrackerPersonToTeamWithProductUser,
} from '@/lib/onPrem/addTrackerPersonToTeamWithProductUser';
import { CATALOG_TEAMLEAD_SLUG } from '@/lib/organizations/invitedTeamRoleFromCatalogSlug';
import { listPendingOrganizationInvitations } from '@/lib/organizations/organizationInvitationsRepository';

const PostBodySchema = z.object({
  display_name: z.string().min(1).max(500).optional(),
  email: z.string().email().max(320),
  invited_team_role: z.enum(['team_lead', 'team_member']).optional(),
  /** Обязательно: добавление только через команду (см. POST …/teams/{teamId}/members). */
  team_id: z.string().uuid(),
  /** ID пользователя в Яндекс.Трекере (как в селекторе админки). */
  tracker_user_id: z.string().min(1).max(128),
});

/**
 * GET /api/admin/organizations/[organizationId]/invitations — активные приглашения (без hash токена).
 */
export async function GET(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const { profile } = auth;

  const isOrgAdmin = profile.orgRole === 'org_admin';
  const leadTeamIds = new Set(
    profile.teamMemberships.filter((t) => t.isTeamLead).map((t) => t.teamId)
  );
  if (!isOrgAdmin && leadTeamIds.size === 0) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const rows = await listPendingOrganizationInvitations(organizationId);
  const visible = isOrgAdmin
    ? rows
    : rows.filter((r) => r.team_id != null && leadTeamIds.has(r.team_id));
  const now = Date.now();
  return NextResponse.json({
    invitations: visible.map((r) => ({
      createdAt: new Date(r.created_at).toISOString(),
      email: r.email,
      expiresAt: new Date(r.expires_at).toISOString(),
      id: r.id,
      invitedTeamRole: r.invited_team_role,
      status: new Date(r.expires_at).getTime() < now ? 'expired' : 'pending',
      teamId: r.team_id,
    })),
  });
}

/**
 * POST /api/admin/organizations/[organizationId]/invitations — устаревший контракт:
 * то же прямое добавление в команду, что и POST …/teams/{teamId}/members (без писем и токенов приглашения).
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const { profile } = auth;

  const isOrgAdmin = profile.orgRole === 'org_admin';
  const leadTeamIds = new Set(
    profile.teamMemberships.filter((t) => t.isTeamLead).map((t) => t.teamId)
  );
  if (!isOrgAdmin && leadTeamIds.size === 0) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }
  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Проверьте email, team_id и роль' }, { status: 400 });
  }

  const { display_name, email, invited_team_role: roleRaw, team_id, tracker_user_id } = parsed.data;
  const emailNorm = email.trim().toLowerCase();

  if (!isOrgAdmin) {
    if (!leadTeamIds.has(team_id)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }
    if (roleRaw === 'team_lead') {
      return NextResponse.json(
        { error: 'Только администратор организации может назначать роль тимлида' },
        { status: 403 }
      );
    }
  }

  const invited_team_role = roleRaw ?? 'team_member';
  const tid = tracker_user_id.trim();

  try {
    const roleSlugForMember = invited_team_role === 'team_lead' ? CATALOG_TEAMLEAD_SLUG : null;
    await addTrackerPersonToTeamWithProductUser({
      displayName: display_name,
      emailStr: emailNorm,
      organizationId,
      roleSlug: roleSlugForMember,
      teamId: team_id,
      trackerUserId: tid,
    });
    return NextResponse.json({ directAdd: true }, { status: 201 });
  } catch (e) {
    if (e instanceof AddTrackerTeamMemberError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    }
    const msg = e instanceof Error ? e.message : 'Не удалось добавить пользователя';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
