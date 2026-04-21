import { NextResponse } from 'next/server';

import { requireOrgAdmin, requireTenantForOrganization } from '@/lib/api-tenant';
import { getSyncCronSecret, getSyncPlatformEnv } from '@/lib/env';
import { findOrganizationById } from '@/lib/organizations';
import {
  extractOrgSyncSettingsJson,
  OrgSyncSettingsPartialSchema,
  resolveOrgSyncSettings,
  validateResolvedOrgSyncSettings,
} from '@/lib/orgSyncSettings';
import { listRedisSyncJobsForOrganization } from '@/lib/sync/listRedisSyncJobsForOrganization';
import { isSyncRedisConfigured } from '@/lib/sync/redisConnection';
import {
  findLatestSyncRunForOrganization,
  findRunningSyncRunForOrganization,
} from '@/lib/sync/syncRunsRepository';

/**
 * GET /api/admin/organizations/[organizationId]/sync/status
 * org_admin: Redis jobs + последний sync_run + текущий running (PG).
 */
export async function GET(
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

  const org = await findOrganizationById(auth.ctx.organizationId);
  if (!org) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }

  const [running, latest, redisJobs] = await Promise.all([
    findRunningSyncRunForOrganization(org.id),
    findLatestSyncRunForOrganization(org.id),
    listRedisSyncJobsForOrganization(org.id),
  ]);

  const platform = getSyncPlatformEnv();

  const rawSync = extractOrgSyncSettingsJson(org.settings);
  const parsedSync = OrgSyncSettingsPartialSchema.safeParse(rawSync);
  const syncPartial = parsedSync.success ? parsedSync.data : {};
  const resolvedSync = resolveOrgSyncSettings(syncPartial, platform);
  const syncValidation = validateResolvedOrgSyncSettings(resolvedSync, platform);

  const syncCronSecretConfigured = getSyncCronSecret().length > 0;

  return NextResponse.json({
    cooldown: {
      fullRescanCooldownMinutes: platform.fullRescanCooldownMinutes,
    },
    lastSyncRun: latest
      ? {
          errorSummary: latest.error_summary,
          finishedAt: latest.finished_at,
          id: latest.id,
          jobType: latest.job_type,
          startedAt: latest.started_at,
          stats: latest.stats,
          status: latest.status,
        }
      : null,
    organization: {
      id: org.id,
      initialSyncCompletedAt: org.initial_sync_completed_at,
      name: org.name,
      syncNextRunAt: org.sync_next_run_at,
    },
    platformSyncBounds: {
      cronTickMinutes: platform.cronTickMinutes,
      defaultIntervalMinutes: platform.defaultIntervalMinutes,
      defaultMaxIssuesPerRun: platform.defaultMaxIssuesPerRun,
      defaultOverlapMinutes: platform.defaultOverlapMinutes,
      maxIntervalMinutes: platform.maxIntervalMinutes,
      maxMaxIssuesPerRun: platform.maxMaxIssuesPerRun,
      maxOverlapMinutes: platform.maxOverlapMinutes,
      minIntervalMinutes: platform.minIntervalMinutes,
      minMaxIssuesPerRun: platform.minMaxIssuesPerRun,
      minOverlapMinutes: platform.minOverlapMinutes,
    },
    redisConfigured: isSyncRedisConfigured(),
    redisJobs,
    resolvedSync,
    runningSyncRun: running
      ? {
          id: running.id,
          jobType: running.job_type,
          startedAt: running.started_at,
          stats: running.stats,
        }
      : null,
    syncCronSecretConfigured,
    syncSettingsRaw: extractOrgSyncSettingsJson(org.settings),
    syncValidation: syncValidation.ok
      ? { ok: true as const }
      : {
          code: syncValidation.code,
          message: syncValidation.message,
          ok: false as const,
        },
  });
}
