/**
 * Идентификатор пользователя в ответе Tracker GET /v3/myself (для сопоставления со staff.tracker_user_id).
 */

/** Рабочий email из ответа Tracker GET /myself (on-prem вход по токену). */
export function trackerWorkEmailFromMyself(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) {
    return null;
  }
  const o = data as Record<string, unknown>;
  const raw = o.email;
  if (typeof raw !== 'string') {
    return null;
  }
  const t = raw.trim().toLowerCase();
  return t.length > 0 ? t : null;
}

export function trackerIdentityCandidatesFromMyself(data: unknown): string[] {
  if (typeof data !== 'object' || data === null) {
    return [];
  }
  const o = data as Record<string, unknown>;
  const raw = o.uid ?? o.trackerUid ?? o.id;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const s = String(Math.trunc(raw));
    return s === String(raw) ? [s] : [s, String(raw)];
  }
  if (typeof raw === 'string') {
    const t = raw.trim();
    return t ? [t] : [];
  }
  return [];
}
