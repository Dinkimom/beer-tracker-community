/**
 * Обработка одной задачи синхронизации: runOrgSync + прогресс для UI.
 */

import type { SyncJobPayload } from './types';
import type { Job } from 'bullmq';

import { parseSyncJobPayload } from './payload';
import { runOrgSync } from './runOrgSync';

export async function processSyncJob(job: Job<SyncJobPayload>): Promise<void> {
  const data = parseSyncJobPayload(job.data);
  const result = await runOrgSync({
    bullJobId: String(job.id),
    mode: data.mode,
    onProgress: async (percent, meta) => {
      if (meta != null && Object.keys(meta).length > 0) {
        await job.updateProgress({ percent, ...meta });
      } else {
        await job.updateProgress(percent);
      }
    },
    organizationId: data.organizationId,
  });

  if (result.status === 'skipped') {
    if (process.env.NODE_ENV !== 'test') {
      const detail = result.message != null ? ` (${result.message})` : '';
      console.warn(
        `[sync-worker] skipped reason=${result.reason} org=${data.organizationId} bullJobId=${job.id}${detail}`
      );
    }
    await job.updateProgress(100);
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      `[sync-worker] done status=${result.finalStatus} org=${data.organizationId} bullJobId=${job.id} syncRunId=${result.syncRunId}`
    );
  }
}
