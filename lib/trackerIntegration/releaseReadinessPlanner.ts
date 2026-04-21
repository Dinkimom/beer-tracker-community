import type { Task } from '@/types';

export interface ReleaseReadinessPlannerRules {
  readyStatusKey: string | null;
}

/** Ключ статуса в трекере; пусто в конфиге = rc. */
export function effectiveReleaseReadyStatusKey(rules: ReleaseReadinessPlannerRules): string {
  const k = (rules.readyStatusKey ?? '').trim();
  return k ? k : 'rc';
}

export function taskMatchesReleaseReadinessFilter(
  task: Pick<Task, 'originalStatus'>,
  rules: ReleaseReadinessPlannerRules
): boolean {
  const key = effectiveReleaseReadyStatusKey(rules);
  return (task.originalStatus ?? '').trim().toLowerCase() === key.toLowerCase();
}

export type ReleaseReadinessEmptyListHintSpec =
  | { kind: 'custom_status'; statusKey: string }
  | { kind: 'default_rc' };

/** UI should map this to i18n keys `sidebar.releasesTab.emptyNoTasksRc` / `emptyNoTasksStatus`. */
export function releaseReadinessEmptyListHintSpec(
  rules: ReleaseReadinessPlannerRules
): ReleaseReadinessEmptyListHintSpec {
  const key = effectiveReleaseReadyStatusKey(rules);
  if (key.toLowerCase() === 'rc') {
    return { kind: 'default_rc' };
  }
  return { kind: 'custom_status', statusKey: key };
}

