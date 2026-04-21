/**
 * Ответ GET /api/admin/organizations/:id/sync/status (фрагмент для админки).
 */

export interface AdminSyncStatusPayload {
  cooldown: { fullRescanCooldownMinutes: number };
  lastSyncRun: {
    errorSummary: string | null;
    finishedAt: string | null;
    id: string;
    jobType: string | null;
    startedAt: string;
    stats: Record<string, unknown>;
    status: string;
  } | null;
  organization: {
    id: string;
    initialSyncCompletedAt: string | null;
    name: string;
    syncNextRunAt: string | null;
  };
  platformSyncBounds: {
    cronTickMinutes: number;
    defaultIntervalMinutes: number;
    defaultMaxIssuesPerRun: number;
    defaultOverlapMinutes: number;
    maxIntervalMinutes: number;
    maxMaxIssuesPerRun: number;
    maxOverlapMinutes: number;
    minIntervalMinutes: number;
    minMaxIssuesPerRun: number;
    minOverlapMinutes: number;
  };
  redisConfigured: boolean;
  redisJobs: Array<{
    id: string;
    mode: string;
    name: string;
    progress: number;
    progressMeta: Record<string, unknown> | null;
    state: string;
    timestamp: number;
  }>;
  resolvedSync: {
    enabled: boolean;
    intervalMinutes: number;
    maxIssuesPerRun: number;
    overlapMinutes: number;
    windowUtc?: { end: string; start: string };
  };
  runningSyncRun: {
    id: string;
    jobType: string | null;
    startedAt: string;
    stats: Record<string, unknown>;
  } | null;
  /** true, если в окружении задан непустой SYNC_CRON_SECRET (тик мог бы приниматься; не гарантирует, что cron реально настроен). */
  syncCronSecretConfigured: boolean;
  syncSettingsRaw: unknown;
  syncValidation:
    { code: string; message: string; ok: false } | { ok: true };
}

export function isAdminSyncStatusPayload(x: unknown): x is AdminSyncStatusPayload {
  if (!x || typeof x !== 'object') {
    return false;
  }
  const o = x as Record<string, unknown>;
  const org = o.organization;
  if (!org || typeof org !== 'object') {
    return false;
  }
  const orgObj = org as Record<string, unknown>;
  return (
    typeof orgObj.id === 'string' &&
    typeof orgObj.name === 'string' &&
    typeof o.syncCronSecretConfigured === 'boolean'
  );
}
