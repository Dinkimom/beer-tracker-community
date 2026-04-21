/**
 * Ограничение частоты создания приглашений (in-memory, на инстанс).
 * Для распределённого деплоя позже — Redis или общий лимитер.
 */

const WINDOW_MS = 60 * 60 * 1000;

const buckets = new Map<string, number[]>();

function maxPerHour(): number {
  const raw = process.env.INVITATION_CREATE_MAX_PER_HOUR?.trim();
  if (raw === '' || raw === undefined) {
    return 60;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) {
    return 0;
  }
  return n;
}

export interface InvitationCreateRateLimitResult {
  ok: boolean;
  retryAfterSec?: number;
}

/**
 * @returns ok: false если лимит исчерпан за последний час.
 */
export function checkInvitationCreateAllowed(
  organizationId: string,
  userId: string
): InvitationCreateRateLimitResult {
  const max = maxPerHour();
  if (max <= 0) {
    return { ok: true };
  }
  const key = `${organizationId}:${userId}`;
  const now = Date.now();
  const prev = buckets.get(key) ?? [];
  const fresh = prev.filter((t) => now - t < WINDOW_MS);
  if (fresh.length >= max) {
    const oldest = fresh[0];
    const retryAfterMs = oldest != null ? WINDOW_MS - (now - oldest) : WINDOW_MS;
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }
  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true };
}

/** Только для тестов. */
export function resetInvitationCreateRateLimitForTests(): void {
  buckets.clear();
}
