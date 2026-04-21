import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import { getSyncPlatformEnv } from '@/lib/env';
import { findOrganizationById } from '@/lib/organizations';
import { fullRescanCooldownRemainingMs } from '@/lib/sync/fullRescanCooldown';
import {
  hasPendingHeavySyncInRedis,
  listRedisSyncJobsForOrganization,
} from '@/lib/sync/listRedisSyncJobsForOrganization';
import { enqueueFullRescan } from '@/lib/sync/queue';
import { isSyncRedisConfigured } from '@/lib/sync/redisConnection';
import {
  findLastFullRescanFinishedAt,
  findRunningSyncRunForOrganization,
} from '@/lib/sync/syncRunsRepository';

const BodySchema = z.object({
  confirm: z.literal(true),
});

/**
 * POST /api/admin/organizations/[organizationId]/sync/full-rescan
 * org_admin: confirm + cooldown + без конфликтующих прогонов → full_rescan в очередь.
 */
export async function POST(
  request: Request,
  routeContext: { params: Promise<{ organizationId: string }> }
) {
  const { organizationId } = await routeContext.params;
  const auth = await requireTenantForOrganization(request, organizationId);
  if (auth.response) {
    return auth.response;
  }
  const denied = requireOrgAdmin(auth.ctx);
  if (denied) {
    return denied;
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Требуется { "confirm": true } для подтверждения полной ресинхронизации' },
      { status: 400 }
    );
  }

  const org = await findOrganizationById(auth.ctx.organizationId);
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }
  if (!isSyncRedisConfigured()) {
    return NextResponse.json({ error: 'Redis не настроен (REDIS_URL)' }, { status: 503 });
  }

  const running = await findRunningSyncRunForOrganization(org.id);
  if (running) {
    return NextResponse.json(
      { error: 'Уже выполняется синхронизация', syncRunId: running.id },
      { status: 409 }
    );
  }

  const redisJobs = await listRedisSyncJobsForOrganization(org.id);
  if (hasPendingHeavySyncInRedis(redisJobs)) {
    return NextResponse.json(
      { error: 'Полная синхронизация уже в очереди или выполняется' },
      { status: 409 }
    );
  }

  const platform = getSyncPlatformEnv();
  const lastFull = await findLastFullRescanFinishedAt(org.id);
  const remainMs = fullRescanCooldownRemainingMs({
    cooldownMinutes: platform.fullRescanCooldownMinutes,
    lastFullRescanFinishedAt: lastFull,
    now: new Date(),
  });
  if (remainMs > 0) {
    const retryAfterSeconds = Math.ceil(remainMs / 1000);
    return NextResponse.json(
      {
        error: 'Слишком рано для нового полного rescan (cooldown)',
        retryAfterSeconds,
      },
      { status: 429 }
    );
  }

  const job = await enqueueFullRescan(org.id, auth.ctx.userId);
  return NextResponse.json({ jobId: job.id, ok: true });
}
