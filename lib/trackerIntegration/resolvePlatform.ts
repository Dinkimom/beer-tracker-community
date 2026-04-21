import type { TrackerIntegrationStored } from './schema';
import type { Team } from '@/types';
import type { TrackerIssue } from '@/types/tracker';

import { readIssueTagTokens, readStringTokenFromIssue } from './issueFieldUtils';

function normalizeMapKey(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Определяет платформу (team) по конфигу; при неудаче — undefined (оставить базовое значение Task).
 */
export function resolvePlatformFromIntegration(
  issue: TrackerIssue,
  platform: TrackerIntegrationStored['platform']
): Team | undefined {
  if (!platform?.valueMap?.length) {
    return undefined;
  }

  if (platform.source === 'field') {
    const raw = readStringTokenFromIssue(issue, platform.fieldId ?? 'functionalTeam');
    if (!raw) {
      return platform.fallbackPlatform;
    }
    const key = normalizeMapKey(raw);
    for (const row of platform.valueMap) {
      if (normalizeMapKey(row.trackerValue) === key) {
        return row.platform;
      }
    }
    return platform.fallbackPlatform;
  }

  const tagSet = new Set(readIssueTagTokens(issue));
  for (const row of platform.valueMap) {
    if (tagSet.has(normalizeMapKey(row.trackerValue))) {
      return row.platform;
    }
  }
  return platform.fallbackPlatform;
}
