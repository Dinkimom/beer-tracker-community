import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTenantWithAdminProfile } from '@/lib/api-tenant';
import { checkInvitationCreateAllowed } from '@/lib/invitations/invitationCreateRateLimit';
import {
  createOrganizationInvitation,
  upsertStaffFromTrackerInvitationContext,
} from '@/lib/organizations/invitationService';
import { listPendingOrganizationInvitations } from '@/lib/organizations/organizationInvitationsRepository';

const PostBodySchema = z.object({
  display_name: z.string().min(1).max(500).optional(),
  email: z.string().email().max(320),
  expiresInDays: z.number().int().min(1).max(90).optional(),
  invited_team_role: z.enum(['team_lead', 'team_member']).optional(),
  /** Без team_id — приглашение только в организацию (только org_admin). */
  team_id: z.string().uuid().optional(),
  /** ID пользователя в Яндекс.Трекере (как в селекторе админки). */
  tracker_user_id: z.string().min(1).max(128).optional(),
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
 * POST /api/admin/organizations/[organizationId]/invitations — создать приглашение (письмо по SMTP при настройке env, иначе ссылка в логе).
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
  const { profile, ctx } = auth;

  const isOrgAdmin = profile.orgRole === 'org_admin';
  const leadTeamIds = new Set(
    profile.teamMemberships.filter((t) => t.isTeamLead).map((t) => t.teamId)
  );
  if (!isOrgAdmin && leadTeamIds.size === 0) {
    return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
  }

  const rate = checkInvitationCreateAllowed(organizationId, ctx.userId);
  if (!rate.ok) {
    const headers =
      rate.retryAfterSec != null ? { 'Retry-After': String(rate.retryAfterSec) } : undefined;
    return NextResponse.json(
      { error: 'Слишком много приглашений за час, попробуйте позже' },
      { headers, status: 429 }
    );
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

  const { display_name, email, expiresInDays, invited_team_role: roleRaw, team_id, tracker_user_id } =
    parsed.data;

  if (!team_id) {
    if (!isOrgAdmin) {
      return NextResponse.json(
        { error: 'Приглашение без команды может создать только администратор организации' },
        { status: 403 }
      );
    }
    if (roleRaw === 'team_lead') {
      return NextResponse.json(
        { error: 'Роль тимлида задаётся только при приглашении в команду' },
        { status: 400 }
      );
    }
  } else if (!isOrgAdmin) {
    if (!leadTeamIds.has(team_id)) {
      return NextResponse.json({ error: 'Недостаточно прав' }, { status: 403 });
    }
    if (roleRaw === 'team_lead') {
      return NextResponse.json(
        { error: 'Только администратор организации может приглашать тимлида' },
        { status: 403 }
      );
    }
  }

  const invited_team_role = team_id ? (roleRaw ?? 'team_member') : 'team_member';

  const expiresAt =
    expiresInDays != null
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

  const emailNorm = email.trim().toLowerCase();

  try {
    if (tracker_user_id?.trim()) {
      await upsertStaffFromTrackerInvitationContext({
        displayName: display_name,
        emailNorm,
        organizationId,
        trackerUserId: tracker_user_id.trim(),
      });
    }

    const { invitation } = await createOrganizationInvitation({
      createdByUserId: ctx.userId,
      email: emailNorm,
      expiresAt,
      invitedTeamRole: invited_team_role,
      organizationId,
      teamId: team_id ?? null,
    });
    return NextResponse.json(
      {
        invitation: {
          createdAt: new Date(invitation.created_at).toISOString(),
          email: invitation.email,
          expiresAt: new Date(invitation.expires_at).toISOString(),
          id: invitation.id,
          invitedTeamRole: invitation.invited_team_role,
          teamId: invitation.team_id,
        },
      },
      { status: 201 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Не удалось создать приглашение';
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
