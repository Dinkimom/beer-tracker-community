/**
 * Точка входа воркера BullMQ (отдельный процесс).
 *
 * Запуск: `REDIS_URL=redis://localhost:6379 pnpm sync-worker`
 * В Docker Compose с сервисом `redis`: `REDIS_URL=redis://redis:6379` (сеть compose).
 */

import { quitSyncRedisBase } from '@/lib/sync/redisConnection';
import { createSyncWorker } from '@/lib/sync/worker';

function main(): void {
  const worker = createSyncWorker();

  worker.on('failed', (job, err) => {
    console.error('[sync-worker] job failed', job?.id, err);
  });

  const shutdown = async () => {
    await worker.close();
    await quitSyncRedisBase();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown();
  });
  process.on('SIGTERM', () => {
    void shutdown();
  });
}

try {
  main();
} catch (err) {
  console.error('[sync-worker] fatal', err);
  process.exit(1);
}
