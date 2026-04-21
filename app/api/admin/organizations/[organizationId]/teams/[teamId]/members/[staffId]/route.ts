import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTeamManagementAccess, requireTenantWithAdminProfile } from '@/lib/api-tenant';
import { removeTeamMember, updateTeamMemberRole } from '@/lib/staffTeams';

const UuidSchema = z.string().uuid();

const PatchBodySchema = z.object({
  role_slug: z.string().trim().max(128).nullable(),
});

/**
 * PATCH /api/admin/organizations/[organizationId]/teams/[teamId]/members/[staffId]
 * org_admin: обновить роль участника команды.
 * Body: { role_slug: string | null }
 */
export async function PATCH(
  request: Request,
  routeContext: {
    params: Promise<{ organizationId: string; staffId: string; teamId: string }>;
  }
) {
  const { organizationId, teamId: teamIdRaw, staffId: staffIdRaw } = await routeContext.params;

  const teamIdParsed = UuidSchema.safeParse(teamIdRaw);
  if (!teamIdParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор команды' }, { status: 400 });
  }

  const staffIdParsed = UuidSchema.safeParse(staffIdRaw);
  if (!staffIdParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор сотрудника' }, { status: 400 });
  }

  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const denied = requireTeamManagementAccess(auth.profile, teamIdParsed.data);
  if (denied) {
    return denied;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Укажите role_slug (строка или null)' }, { status: 400 });
  }

  const member = await updateTeamMemberRole(
    auth.ctx.organizationId,
    teamIdParsed.data,
    staffIdParsed.data,
    parsed.data.role_slug
  );

  if (!member) {
    return NextResponse.json({ error: 'Участник не найден' }, { status: 404 });
  }

  return NextResponse.json({ member });
}

/**
 * DELETE /api/admin/organizations/[organizationId]/teams/[teamId]/members/[staffId]
 * org_admin: удалить участника из команды.
 */
export async function DELETE(
  request: Request,
  routeContext: {
    params: Promise<{ organizationId: string; staffId: string; teamId: string }>;
  }
) {
  const { organizationId, teamId: teamIdRaw, staffId: staffIdRaw } = await routeContext.params;

  const teamIdParsed = UuidSchema.safeParse(teamIdRaw);
  if (!teamIdParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор команды' }, { status: 400 });
  }

  const staffIdParsed = UuidSchema.safeParse(staffIdRaw);
  if (!staffIdParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор сотрудника' }, { status: 400 });
  }

  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const denied = requireTeamManagementAccess(auth.profile, teamIdParsed.data);
  if (denied) {
    return denied;
  }

  const ok = await removeTeamMember(
    auth.ctx.organizationId,
    teamIdParsed.data,
    staffIdParsed.data
  );

  if (!ok) {
    return NextResponse.json({ error: 'Участник не найден' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
