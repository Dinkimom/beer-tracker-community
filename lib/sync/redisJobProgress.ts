/**
 * Нормализация job.progress BullMQ (число 0–100 или объект с полем percent) для API админки.
 */

export interface NormalizedRedisJobProgress {
  meta: Record<string, unknown> | null;
  /** 0–100 */
  percent: number;
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.min(100, Math.max(0, n));
}

export function normalizeRedisJobProgress(raw: unknown): NormalizedRedisJobProgress {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return { meta: null, percent: clampPercent(raw) };
  }
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const p = typeof o.percent === 'number' ? o.percent : 0;
    const { percent: _drop, ...rest } = o;
    const keys = Object.keys(rest);
    return {
      meta: keys.length > 0 ? rest : null,
      percent: clampPercent(p),
    };
  }
  return { meta: null, percent: 0 };
}
