import { NextResponse } from 'next/server';
import { DatabaseError } from 'pg';
import { z } from 'zod';

import { requireOrgAdminProfile, requireTenantWithAdminProfile } from '@/lib/api-tenant';
import {
  allocateUniqueTeamSlug,
  findTeamBlockingBoard,
  findTeamBlockingQueue,
  insertTeam,
  listTeams,
} from '@/lib/staffTeams';

const BoardIdSchema = z.union([
  z.number().int().positive(),
  z.string().regex(/^\d+$/).transform((s) => Number.parseInt(s, 10)),
]);

const PostBodySchema = z.object({
  active: z.boolean().optional(),
  slug: z.string().trim().min(1).max(128).optional(),
  title: z.string().trim().min(1).max(256),
  tracker_board_id: BoardIdSchema,
  tracker_queue_key: z.string().trim().min(1).max(256),
});

function isPostgresUniqueViolation(err: unknown): boolean {
  return err instanceof DatabaseError && err.code === '23505';
}

/**
 * GET /api/admin/organizations/[organizationId]/teams
 * org_admin: все команды; тимлид: только команды, где пользователь is_team_lead.
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
  const { ctx, profile } = auth;

  const all = await listTeams(ctx.organizationId, { activeOnly: false });
  const teams =
    profile.orgRole === 'org_admin'
      ? all
      : all.filter((t) =>
          profile.teamMemberships.some((m) => m.teamId === t.id && m.isTeamLead)
        );
  return NextResponse.json({ teams });
}

/**
 * POST /api/admin/organizations/[organizationId]/teams
 * org_admin: создать команду с привязкой к доске трекера.
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
  const denied = requireOrgAdminProfile(auth.profile);
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
    return NextResponse.json(
      { error: 'Укажите название, очередь и доску из Трекера' },
      { status: 400 }
    );
  }

  const orgTeams = await listTeams(auth.ctx.organizationId, { activeOnly: false });
  const queueKey = parsed.data.tracker_queue_key.trim();
  const boardNum = parsed.data.tracker_board_id;
  const blockQ = findTeamBlockingQueue(orgTeams, queueKey);
  if (blockQ) {
    return NextResponse.json(
      { error: `Очередь «${queueKey}» уже привязана к команде «${blockQ.title}»` },
      { status: 409 }
    );
  }
  const blockB = findTeamBlockingBoard(orgTeams, boardNum);
  if (blockB) {
    return NextResponse.json(
      { error: `Доска ${String(boardNum)} уже привязана к команде «${blockB.title}»` },
      { status: 409 }
    );
  }

  const slugInput = parsed.data.slug?.trim();
  let slug: string;
  if (slugInput) {
    if (orgTeams.some((t) => t.slug === slugInput)) {
      return NextResponse.json(
        { error: `Слуг «${slugInput}» уже занят другой командой` },
        { status: 409 }
      );
    }
    slug = slugInput;
  } else {
    slug = await allocateUniqueTeamSlug(auth.ctx.organizationId, parsed.data.title);
  }

  try {
    const team = await insertTeam(auth.ctx.organizationId, {
      active: parsed.data.active,
      slug,
      title: parsed.data.title,
      tracker_board_id: boardNum,
      tracker_queue_key: queueKey,
    });
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
