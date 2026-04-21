/**
 * Очередь BullMQ для задач экспортёра (Next.js / cron ставят jobs, воркер — scripts/sync-worker).
 */

import type { SyncJobPayload } from './types';

import { type Job, Queue } from 'bullmq';

import { SYNC_QUEUE_NAME } from './constants';
import { acquireSyncRedisConnection, isSyncRedisConfigured } from './redisConnection';

const defaultJobOptions = {
  attempts: 5,
  backoff: {
    delay: 2000,
    type: 'exponential' as const,
  },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 200 },
};

let queueSingleton: Queue<SyncJobPayload, unknown, string> | null = null;

export function getSyncQueue(): Queue<SyncJobPayload, unknown, string> {
  if (!queueSingleton) {
    queueSingleton = new Queue<SyncJobPayload, unknown, string>(SYNC_QUEUE_NAME, {
      connection: acquireSyncRedisConnection(),
      defaultJobOptions,
    });
  }
  return queueSingleton;
}

async function removeStaleJobIfNeeded(
  queue: Queue<SyncJobPayload, unknown, string>,
  jobId: string
): Promise<void> {
  const existing = await queue.getJob(jobId);
  if (!existing) {
    return;
  }
  const state = await existing.getState();
  if (['active', 'delayed', 'paused', 'waiting'].includes(state)) {
    return;
  }
  await existing.remove();
}

/**
 * Первичная полная синхронизация: не более одной «живой» задачи на org (по jobId).
 */
export async function enqueueInitialFullSync(
  organizationId: string,
  requestedByUserId?: string
): Promise<Job<SyncJobPayload, unknown, string>> {
  if (!isSyncRedisConfigured()) {
    throw new Error('Redis is not configured (REDIS_URL empty)');
  }
  const queue = getSyncQueue();
  const legacyInitialId = `initial-full:${organizationId}`;
  const jobId = `initial-full-${organizationId}`;
  await removeStaleJobIfNeeded(queue, legacyInitialId);
  await removeStaleJobIfNeeded(queue, jobId);
  const legacyInitial = await queue.getJob(legacyInitialId);
  if (legacyInitial) {
    const legacyState = await legacyInitial.getState();
    if (['active', 'delayed', 'paused', 'waiting'].includes(legacyState)) {
      return legacyInitial;
    }
  }
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (['active', 'delayed', 'paused', 'waiting'].includes(state)) {
      return existing;
    }
  }
  const payload: SyncJobPayload = {
    mode: 'initial_full',
    organizationId,
    requestedByUserId,
  };
  return queue.add('initial_full', payload, { jobId });
}

/**
 * Инкремент: отдельный jobId на запуск (cron может ставить часто).
 */
export async function enqueueIncrementalSync(organizationId: string): Promise<Job<SyncJobPayload, unknown, string>> {
  if (!isSyncRedisConfigured()) {
    throw new Error('Redis is not configured (REDIS_URL empty)');
  }
  const queue = getSyncQueue();
  const jobId = `incremental-${organizationId}-${Date.now()}`;
  const payload: SyncJobPayload = { mode: 'incremental', organizationId };
  return await queue.add('incremental', payload, { jobId });
}

/**
 * Полный перескан по запросу админа.
 */
export async function enqueueFullRescan(
  organizationId: string,
  requestedByUserId?: string
): Promise<Job<SyncJobPayload, unknown, string>> {
  if (!isSyncRedisConfigured()) {
    throw new Error('Redis is not configured (REDIS_URL empty)');
  }
  const queue = getSyncQueue();
  const legacyFullRescanId = `full-rescan:${organizationId}`;
  const jobId = `full-rescan-${organizationId}`;
  await removeStaleJobIfNeeded(queue, legacyFullRescanId);
  await removeStaleJobIfNeeded(queue, jobId);
  const legacyFullRescan = await queue.getJob(legacyFullRescanId);
  if (legacyFullRescan) {
    const legacyState = await legacyFullRescan.getState();
    if (['active', 'delayed', 'paused', 'waiting'].includes(legacyState)) {
      return legacyFullRescan;
    }
  }
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (['active', 'delayed', 'paused', 'waiting'].includes(state)) {
      return existing;
    }
  }
  const payload: SyncJobPayload = {
    mode: 'full_rescan',
    organizationId,
    requestedByUserId,
  };
  return queue.add('full_rescan', payload, { jobId });
}
