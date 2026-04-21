import type { OrgMemberRole } from '@/lib/organizations/types';

import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTenantOrgAdmin } from '@/lib/api-tenant';
import {
  countOrganizationMembersByRole,
  deleteOrganizationUserAccount,
  findOrganizationMembership,
  updateOrganizationMemberRole,
} from '@/lib/organizations/organizationMembersRepository';

const UuidSchema = z.string().uuid();

const PatchBodySchema = z.object({
  org_role: z.enum(['member', 'team_lead', 'org_admin']),
});

/**
 * PATCH /api/admin/organizations/[organizationId]/members/[userId]
 * org_admin: сменить роль участника в организации (member | team_lead | org_admin).
 */
export async function PATCH(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string; userId: string }> }
) {
  const { organizationId, userId: userIdRaw } = await routeContext.params;

  const orgParsed = UuidSchema.safeParse(organizationId.trim());
  if (!orgParsed.success) {
    return NextResponse.json({ error: 'Некорректный organization id' }, { status: 400 });
  }

  const userParsed = UuidSchema.safeParse(userIdRaw.trim());
  if (!userParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор пользователя' }, { status: 400 });
  }

  const auth = await requireTenantOrgAdmin(request, orgParsed.data);
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
    return NextResponse.json(
      { error: 'Укажите org_role: member, team_lead или org_admin' },
      { status: 400 }
    );
  }

  const orgId = auth.ctx.organizationId;
  const targetUserId = userParsed.data;
  const nextRole: OrgMemberRole = parsed.data.org_role;

  if (targetUserId === auth.ctx.userId) {
    return NextResponse.json(
      { error: 'Нельзя изменить свою роль в организации' },
      { status: 403 }
    );
  }

  const existing = await findOrganizationMembership(orgId, targetUserId);
  if (!existing) {
    return NextResponse.json({ error: 'Участник не найден' }, { status: 404 });
  }

  if (existing.role === 'org_admin' && nextRole !== 'org_admin') {
    const admins = await countOrganizationMembersByRole(orgId, 'org_admin');
    if (admins <= 1) {
      return NextResponse.json(
        { error: 'Нельзя снять последнего администратора организации' },
        { status: 400 }
      );
    }
  }

  const updated = await updateOrganizationMemberRole(orgId, targetUserId, nextRole);
  if (!updated) {
    return NextResponse.json({ error: 'Не удалось обновить роль' }, { status: 500 });
  }

  return NextResponse.json({
    member: { org_role: updated.role, userId: updated.user_id },
  });
}

/**
 * DELETE /api/admin/organizations/[organizationId]/members/[userId]
 * org_admin: удалить учётную запись участника этой организации (в модели одна организация на пользователя).
 */
export async function DELETE(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string; userId: string }> }
) {
  const { organizationId, userId: userIdRaw } = await routeContext.params;

  const orgParsed = UuidSchema.safeParse(organizationId.trim());
  if (!orgParsed.success) {
    return NextResponse.json({ error: 'Некорректный organization id' }, { status: 400 });
  }

  const userParsed = UuidSchema.safeParse(userIdRaw.trim());
  if (!userParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор пользователя' }, { status: 400 });
  }

  const auth = await requireTenantOrgAdmin(request, orgParsed.data);
  if ('response' in auth) {
    return auth.response;
  }

  const orgId = auth.ctx.organizationId;
  const targetUserId = userParsed.data;

  if (targetUserId === auth.ctx.userId) {
    return NextResponse.json({ error: 'Нельзя удалить свою учётную запись' }, { status: 403 });
  }

  const existing = await findOrganizationMembership(orgId, targetUserId);
  if (!existing) {
    return NextResponse.json({ error: 'Участник не найден' }, { status: 404 });
  }

  if (existing.role === 'org_admin') {
    const admins = await countOrganizationMembersByRole(orgId, 'org_admin');
    if (admins <= 1) {
      return NextResponse.json(
        { error: 'Нельзя удалить последнего администратора организации' },
        { status: 400 }
      );
    }
  }

  try {
    const deleted = await deleteOrganizationUserAccount(orgId, targetUserId);
    if (!deleted) {
      return NextResponse.json({ error: 'Не удалось удалить пользователя' }, { status: 500 });
    }
  } catch (err) {
    console.error('[DELETE organization member user]', err);
    return NextResponse.json({ error: 'Внутренняя ошибка' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
