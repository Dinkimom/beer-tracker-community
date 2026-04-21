import type { TrackerIntegrationStored } from './schema';

export interface IssueWorkBody {
  storyPoints?: number | null;
  testPoints?: number | null;
}

/**
 * Тело PATCH /issues/{key} для оценок с учётом имён полей из конфига.
 */
export function buildIssueWorkEstimatePatch(
  integration: TrackerIntegrationStored | null | undefined,
  body: IssueWorkBody
): Record<string, unknown> {
  const flow = integration?.testingFlow;
  const devKey = flow?.devEstimateFieldId?.trim() || 'storyPoints';
  const qaKey = flow?.qaEstimateFieldId?.trim() || 'testPoints';
  const patch: Record<string, unknown> = {};
  if (body.storyPoints !== undefined) {
    patch[devKey] = body.storyPoints;
  }
  if (body.testPoints !== undefined) {
    patch[qaKey] = body.testPoints;
  }
  return patch;
}
