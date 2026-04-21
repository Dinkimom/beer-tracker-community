import { NextResponse } from 'next/server';
import { DatabaseError } from 'pg';
import { z } from 'zod';

import {
  requireOrgAdminProfile,
  requireTeamManagementAccess,
  requireTenantWithAdminProfile,
} from '@/lib/api-tenant';
import {
  deleteTeam,
  findTeamById,
  findTeamBlockingBoard,
  findTeamBlockingQueue,
  listTeams,
  updateTeam,
} from '@/lib/staffTeams';

const UuidSchema = z.string().uuid();

const BoardIdSchema = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+$/).transform((s) => Number.parseInt(s, 10)),
]);

const PatchBodySchema = z
  .object({
    active: z.boolean().optional(),
    slug: z.string().trim().min(1).max(128).optional(),
    title: z.string().trim().min(1).max(256).optional(),
    tracker_board_id: BoardIdSchema.optional(),
    tracker_queue_key: z.string().trim().min(1).max(256).optional(),
  })
  .refine((o) => Object.keys(o).length > 0, { message: 'empty' });

function isPostgresUniqueViolation(err: unknown): boolean {
  return err instanceof DatabaseError && err.code === '23505';
}

/**
 * PATCH /api/admin/organizations/[organizationId]/teams/[teamId]
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
  const teamId = teamIdParsed.data;

  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const deniedTeam = requireTeamManagementAccess(auth.profile, teamId);
  if (deniedTeam) {
    return deniedTeam;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }
  const parsed = PatchBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Нет полей для обновления' }, { status: 400 });
  }

  if (auth.profile.orgRole !== 'org_admin') {
    const sensitive =
      parsed.data.tracker_board_id !== undefined ||
      parsed.data.tracker_queue_key !== undefined ||
      parsed.data.slug !== undefined;
    if (sensitive) {
      return NextResponse.json(
        { error: 'Тимлид может менять только название и флаг активности команды' },
        { status: 403 }
      );
    }
  }

  const existing = await findTeamById(auth.ctx.organizationId, teamId);
  if (!existing) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }

  const orgTeams = await listTeams(auth.ctx.organizationId, { activeOnly: false });
  if (parsed.data.tracker_queue_key !== undefined) {
    const blockQ = findTeamBlockingQueue(orgTeams, parsed.data.tracker_queue_key, teamId);
    if (blockQ) {
      return NextResponse.json(
        {
          error: `Очередь «${parsed.data.tracker_queue_key.trim()}» уже привязана к команде «${blockQ.title}»`,
        },
        { status: 409 }
      );
    }
  }
  if (parsed.data.tracker_board_id !== undefined) {
    const blockB = findTeamBlockingBoard(orgTeams, parsed.data.tracker_board_id, teamId);
    if (blockB) {
      return NextResponse.json(
        {
          error: `Доска ${String(parsed.data.tracker_board_id)} уже привязана к команде «${blockB.title}»`,
        },
        { status: 409 }
      );
    }
  }
  if (parsed.data.slug !== undefined) {
    const taken = orgTeams.some((t) => t.id !== teamId && t.slug === parsed.data.slug);
    if (taken) {
      return NextResponse.json(
        { error: `Слуг «${parsed.data.slug}» уже занят другой командой` },
        { status: 409 }
      );
    }
  }

  try {
    const team = await updateTeam(auth.ctx.organizationId, teamId, parsed.data);
    if (!team) {
      return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
    }
    return NextResponse.json({ team });
  } catch (err) {
    if (isPostgresUniqueViolation(err)) {
      return NextResponse.json(
        {
          error: 'В организации уже есть команда с таким ID доски трекера (tracker_board_id)',
        },
        { status: 409 }
      );
    }
    throw err;
  }
}

/**
 * DELETE /api/admin/organizations/[organizationId]/teams/[teamId]
 */
export async function DELETE(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string; teamId: string }> }
) {
  const { organizationId, teamId: teamIdRaw } = await routeContext.params;
  const teamIdParsed = UuidSchema.safeParse(teamIdRaw);
  if (!teamIdParsed.success) {
    return NextResponse.json({ error: 'Некорректный идентификатор команды' }, { status: 400 });
  }
  const teamId = teamIdParsed.data;

  const auth = await requireTenantWithAdminProfile(request, organizationId);
  if ('response' in auth) {
    return auth.response;
  }
  const denied = requireOrgAdminProfile(auth.profile);
  if (denied) {
    return denied;
  }

  const ok = await deleteTeam(auth.ctx.organizationId, teamId);
  if (!ok) {
    return NextResponse.json({ error: 'Команда не найдена' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
