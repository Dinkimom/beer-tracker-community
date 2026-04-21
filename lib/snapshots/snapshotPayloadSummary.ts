/**
 * Поля из payload снимка для batch-эндпоинтов (паритет с CH: status / issue_type / title).
 */

import type { TrackerIssue } from '@/types/tracker';

export function statusKeyTypeKeySummaryFromPayload(payload: TrackerIssue): {
  status: string;
  summary: string;
  type: string;
} {
  const status = payload.status?.key ?? payload.statusType?.key ?? '';
  const type = payload.type?.key ?? '';
  const summary = payload.summary ?? '';
  return { status, summary, type };
}
