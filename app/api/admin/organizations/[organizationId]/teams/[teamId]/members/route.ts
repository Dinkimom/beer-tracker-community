import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireTeamManagementAccess, requireTenantWithAdminProfile } from '@/lib/api-tenant';
import { findUserById } from '@/lib/auth';
import {
  AddTrackerTeamMemberError,
  addTrackerPersonToTeamWithProductUser,
} from '@/lib/onPrem/addTrackerPersonToTeamWithProductUser';
import { invitedTeamRoleFromCatalogRoleSlug } from '@/lib/organizations/invitedTeamRoleFromCatalogSlug';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import {
  productTeamRoleToFlags,
  upsertUserTeamMembership,
  userHasTeamMembershipInOrganization,
} from '@/lib/organizations/userTeamMembershipRepository';
import {
  addOverseerTeamMember,
  addTeamMember,
  enrichTeamMembersDisplayNamesFromTracker,
  findStaffByOrganizationAndEmailNorm,
  findTeamById,
  insertStaff,
  listTeamMembersWithStaff,
} from '@/lib/staffTeams';

const UuidSchema = z.string().uuid();

const PostBodySchema = z
  .object({
    display_name: z.string().trim().min(1).max(512).optional(),
    email: z.string().trim().email().max(320).optional(),
    role_slug: z.string().trim().min(1).max(128).optional().nullable(),
    staff_uid: z.string().uuid().optional(),
    tracker_user_id: z.string().min(1).max(256).optional(),
    user_id: z.string().uuid().optional(),
  })
  .superRefine((data, ctx) => {
    const byUser = Boolean(data.user_id);
    const byTracker = Boolean(data.tracker_user_id);
    const byRegistry = Boolean(data.staff_uid);
    const methods = Number(byUser) + Number(byTracker) + Number(byRegistry);
    if (methods !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Укажите ровно один способ: user_id, staff_uid или tracker_user_id (+ email)',
      });
    }
    if (byTracker && !data.email?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Для добавления из трекера укажите email',
        path: ['email'],
      });
    }
  });

function displayNameFromUserEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.indexOf('@');
  if (at > 0) {
    return e.slice(0, at);
  }
  return e.length > 0 ? e : 'Пользователь';
}

/**
 * GET /api/admin/organizations/[organizationId]/teams/[teamId]/members
 * org_admin: список участников команды.
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

  const team = await findTeamById(auth.ctx.organizationId, teamIdParsed.data);
  if (!team) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }

  const listed = await listTeamMembersWithStaff(auth.ctx.organizationId, teamIdParsed.data);
  const members = await enrichTeamMembersDisplayNamesFromTracker(
    auth.ctx.organizationId,
    listed
  );
  return NextResponse.json({ members });
}

/**
 * POST /api/admin/organizations/[organizationId]/teams/[teamId]/members
 * - `user_id`: пользователь уже в организации (без команды) — в состав команды и права планера, без приглашения.
 * - `tracker_user_id` + `email`: из трекера — в состав команды и сразу учётка продукта для планера (без приглашений).
 * Роль каталога `teamlead` → тимлид в планере, иначе участник.
 */
export async function POST(
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

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? 'Некорректное тело запроса';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const orgId = auth.ctx.organizationId;
  const teamId = teamIdParsed.data;
  const {
    display_name,
    email,
    role_slug: roleSlug,
    staff_uid: staffUid,
    tracker_user_id: trackerUserId,
    user_id: bodyUserId,
  } =
    parsed.data;

  const team = await findTeamById(orgId, teamId);
  if (!team) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }

  const invitedTeamRole = invitedTeamRoleFromCatalogRoleSlug(roleSlug ?? null);
  const isOrgAdmin = auth.profile.orgRole === 'org_admin';
  if (!isOrgAdmin && invitedTeamRole === 'team_lead') {
    return NextResponse.json(
      { error: 'Только администратор организации может назначать роль тимлида' },
      { status: 403 }
    );
  }

  if (bodyUserId) {
    const om = await findOrganizationMembership(orgId, bodyUserId);
    if (!om) {
      return NextResponse.json({ error: 'Пользователь не состоит в организации' }, { status: 404 });
    }
    if (await userHasTeamMembershipInOrganization(orgId, bodyUserId)) {
      return NextResponse.json(
        { error: 'У пользователя уже есть команда в организации' },
        { status: 409 }
      );
    }

    const userRow = await findUserById(bodyUserId);
    if (!userRow) {
      return NextResponse.json({ error: 'Пользователь не найден' }, { status: 404 });
    }

    const emailNorm = String(userRow.email).trim().toLowerCase();
    let staffRow = await findStaffByOrganizationAndEmailNorm(orgId, emailNorm);
    if (!staffRow) {
      staffRow = await insertStaff(orgId, {
        display_name: displayNameFromUserEmail(emailNorm),
        email: emailNorm,
        tracker_user_id: null,
      });
    }

    const staffId = staffRow.id;
    const member = await addTeamMember(orgId, teamId, staffId, roleSlug ?? null);
    if (!member) {
      return NextResponse.json(
        { error: 'Не удалось добавить: команда или сотрудник не найдены' },
        { status: 404 }
      );
    }

    const flags = productTeamRoleToFlags(invitedTeamRole);
    await upsertUserTeamMembership({
      isTeamLead: flags.isTeamLead,
      isTeamMember: flags.isTeamMember,
      teamId,
      userId: bodyUserId,
    });

    return NextResponse.json({ member }, { status: 201 });
  }

  if (staffUid) {
    const added = await addOverseerTeamMember(teamId, staffUid);
    if (!added) {
      return NextResponse.json({ error: 'Сотрудник уже состоит в этой команде' }, { status: 409 });
    }
    return NextResponse.json(
      {
        member: {
          role_slug: roleSlug ?? null,
          staff_id: staffUid,
          team_id: teamId,
        },
      },
      { status: 201 }
    );
  }

  const emailStr = email!;
  try {
    const { member } = await addTrackerPersonToTeamWithProductUser({
      displayName: display_name,
      emailStr,
      organizationId: orgId,
      roleSlug: roleSlug ?? null,
      teamId,
      trackerUserId: trackerUserId!,
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (e) {
    if (e instanceof AddTrackerTeamMemberError) {
      return NextResponse.json({ error: e.message }, { status: e.httpStatus });
    }
    throw e;
  }
}
