import type { PlannerIntegrationRulesDto } from './toPlannerDto';

import { describe, expect, it } from 'vitest';

import { isPlannerReleasesTabOffered } from './plannerReleasesTabOffered';

const baseRules = (rr: PlannerIntegrationRulesDto['releaseReadiness']): PlannerIntegrationRulesDto => ({
  configRevision: 1,
  flags: { zeroDevPositiveQaRule: false },
  releaseReadiness: rr,
  statusDefaultsByTrackerStatusType: {},
  statusOverridesByStatusKey: {},
  testingFlowMode: 'embedded_in_dev',
  validationThresholds: {},
});

describe('isPlannerReleasesTabOffered', () => {
  it('is true when there is no organization (rules not loaded)', () => {
    expect(isPlannerReleasesTabOffered(null, false, undefined)).toBe(true);
    expect(isPlannerReleasesTabOffered(undefined, false, undefined)).toBe(true);
  });

  it('is false for org while rules have not been fetched yet', () => {
    expect(isPlannerReleasesTabOffered('org-1', false, undefined)).toBe(false);
  });

  it('is false when org and fetched with showReleasesTab false', () => {
    expect(
      isPlannerReleasesTabOffered(
        'org-1',
        true,
        baseRules({ readyStatusKey: null, showReleasesTab: false })
      )
    ).toBe(false);
  });

  it('is true when org and fetched with showReleasesTab true or default', () => {
    expect(
      isPlannerReleasesTabOffered(
        'org-1',
        true,
        baseRules({ readyStatusKey: 'rc', showReleasesTab: true })
      )
    ).toBe(true);
  });
});
