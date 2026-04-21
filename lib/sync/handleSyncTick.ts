/**
 * Логика POST /api/internal/sync/tick: секрет, выбор org, постановка incremental в BullMQ, сдвиг sync_next_run_at.
 */

import { getSyncPlatformEnv, verifySyncCronSecret } from '@/lib/env';
import {
  listOrganizationsDueForIncrementalSync,
  updateOrganization,
} from '@/lib/organizations';
import { parseResolveAndValidateOrgSyncFromSettingsRoot } from '@/lib/orgSyncSettings';

import { enqueueIncrementalSync } from './queue';
import { isSyncRedisConfigured } from './redisConnection';

export interface SyncTickResultBody {
  enqueued: number;
  organizationIds: string[];
  reason?: 'redis_not_configured';
  skippedInvalidSettings?: number;
}

export type HandleSyncTickResponse =
  | { body: SyncTickResultBody; ok: true }
  | { ok: false; status: 401 };

export async function handleSyncTick(params: {
  cronSecret: string;
}): Promise<HandleSyncTickResponse> {
  if (!verifySyncCronSecret(params.cronSecret)) {
    return { ok: false, status: 401 };
  }

  if (!isSyncRedisConfigured()) {
    return {
      body: {
        enqueued: 0,
        organizationIds: [],
        reason: 'redis_not_configured',
      },
      ok: true,
    };
  }

  const platform = getSyncPlatformEnv();
  const candidates = await listOrganizationsDueForIncrementalSync(platform.maxOrgsPerTick);

  const organizationIds: string[] = [];
  let skippedInvalidSettings = 0;

  for (const org of candidates) {
    const v = parseResolveAndValidateOrgSyncFromSettingsRoot(org.settings, platform);
    if (!v.ok) {
      skippedInvalidSettings += 1;
      continue;
    }
    if (!v.settings.enabled) {
      continue;
    }

    await enqueueIncrementalSync(org.id);
    const nextRun = new Date(Date.now() + v.settings.intervalMinutes * 60_000);
    await updateOrganization(org.id, { sync_next_run_at: nextRun });
    organizationIds.push(org.id);
  }

  return {
    body: {
      enqueued: organizationIds.length,
      organizationIds,
      ...(skippedInvalidSettings > 0 ? { skippedInvalidSettings } : {}),
    },
    ok: true,
  };
}
