import type { TrackerIntegrationStored } from './schema';
import type { Task, Team } from '@/types';
import type { TrackerIssue } from '@/types/tracker';

import {
  evaluateEmbeddedTestingOnlyPredicate,
  padEmbeddedTestingOnlyJoins,
} from './evaluateEmbeddedTestingOnlyRules';
import {
  readMergeRequestLinkFromIssue,
  readNumericEstimateFromIssue,
  readUserRefFromIssue,
} from './issueFieldUtils';
import { resolvePlatformFromIntegration } from './resolvePlatform';
import { resolveStatusCategoryFromIntegration } from './resolveStatus';

function isStandaloneQaTask(
  issue: TrackerIssue,
  flow: NonNullable<TrackerIntegrationStored['testingFlow']>
): boolean {
  if (flow.mode !== 'standalone_qa_tasks') {
    return false;
  }
  const sc = flow.standaloneClassification;
  if (!sc || typeof sc !== 'object' || Array.isArray(sc)) {
    return false;
  }
  const typeKey = issue.type?.key?.trim();
  const raw = (sc as Record<string, unknown>).typeKeys;
  if (!Array.isArray(raw) || !typeKey) {
    return false;
  }
  const typeKeys = raw.filter((x): x is string => typeof x === 'string');
  return typeKeys.includes(typeKey);
}

function applyTestingFlowEstimates(
  issue: TrackerIssue,
  task: Task,
  flow: NonNullable<TrackerIntegrationStored['testingFlow']>
): Task {
  let next = task;
  const devField = flow.devEstimateFieldId;
  const qaField = flow.qaEstimateFieldId;
  const embedded = flow.mode === 'embedded_in_dev' || flow.mode === undefined;

  if (embedded) {
    if (devField) {
      const sp = readNumericEstimateFromIssue(issue, devField);
      if (sp !== undefined) {
        next = { ...next, storyPoints: sp };
      }
    }
    if (qaField) {
      const tp = readNumericEstimateFromIssue(issue, qaField);
      if (tp !== undefined) {
        next = { ...next, testPoints: tp };
      }
    }
    return next;
  }

  if (flow.mode === 'standalone_qa_tasks') {
    if (isStandaloneQaTask(issue, flow)) {
      const primaryField = devField ?? 'storyPoints';
      const sp = readNumericEstimateFromIssue(issue, primaryField);
      if (sp !== undefined) {
        next = { ...next, storyPoints: sp };
      }
    }
    if (flow.zeroDevPositiveQaRule && qaField) {
      const devVal = readNumericEstimateFromIssue(issue, devField ?? 'storyPoints') ?? 0;
      const qaVal = readNumericEstimateFromIssue(issue, qaField) ?? 0;
      if (devVal === 0 && qaVal > 0) {
        next = { ...next, testPoints: qaVal };
      }
    }
  }

  return next;
}

function applyQaEngineerField(
  issue: TrackerIssue,
  task: Task,
  fieldId: string | undefined
): Task {
  if (!fieldId) {
    return task;
  }
  const ref = readUserRefFromIssue(issue, fieldId);
  if (!ref) {
    return task;
  }
  return { ...task, qaEngineer: ref.id, qaEngineerName: ref.display };
}

/**
 * Накладывает org-конфиг на уже смапленную базовую `Task` (legacy map).
 */
export function applyTrackerIntegrationToTask(
  issue: TrackerIssue,
  task: Task,
  config: TrackerIntegrationStored | null | undefined
): Task {
  if (!config) {
    return task;
  }

  let next: Task = { ...task };

  const platform = resolvePlatformFromIntegration(issue, config.platform);
  if (platform) {
    next = { ...next, team: platform as Team };
  }

  const statusKey = issue.status?.key || issue.statusType?.key;
  const statusTypeKey = issue.statusType?.key;
  const cat = resolveStatusCategoryFromIntegration(statusKey, statusTypeKey, config.statuses);
  if (cat) {
    next = { ...next, status: cat };
  }

  const skTrim = statusKey?.trim();
  const visual = skTrim ? config.statuses?.overridesByStatusKey?.[skTrim]?.visualToken?.trim() : undefined;
  next = { ...next, statusColorKey: visual || undefined };

  if (config.testingFlow) {
    if (config.testingFlow.mode === 'standalone_qa_tasks') {
      next = { ...next, hideTestPointsByIntegration: true };
    } else {
      next = { ...next, hideTestPointsByIntegration: undefined };
    }
    next = applyTestingFlowEstimates(issue, next, config.testingFlow);
    next = applyQaEngineerField(issue, next, config.testingFlow.qaEngineerFieldId);

    const rules = config.testingFlow.embeddedTestingOnlyRules ?? [];
    const joins = padEmbeddedTestingOnlyJoins(rules.length, config.testingFlow.embeddedTestingOnlyJoins);
    if (rules.length > 0 && evaluateEmbeddedTestingOnlyPredicate(issue, rules, joins)) {
      next = { ...next, testingOnlyByIntegrationRules: true };
    }
  }

  const rr = config.releaseReadiness;
  const mrField = rr?.mergeRequestFieldId?.trim();
  if (mrField) {
    const link = readMergeRequestLinkFromIssue(issue, mrField);
    next = {
      ...next,
      MergeRequestLink: link || next.MergeRequestLink,
    };
  }

  return next;
}
