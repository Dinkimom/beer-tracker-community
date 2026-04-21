import { describe, expect, it } from 'vitest';

import { buildIssueAssigneePatch } from './buildIssueAssigneePatch';

describe('buildIssueAssigneePatch', () => {
  it('defaults to assignee / qaEngineer', () => {
    expect(buildIssueAssigneePatch('u1', false, null)).toEqual({ assignee: { id: 'u1' } });
    expect(buildIssueAssigneePatch('u1', true, null)).toEqual({ qaEngineer: { id: 'u1' } });
  });

  it('uses custom field keys from testingFlow', () => {
    const integration = {
      configRevision: 1,
      testingFlow: {
        devAssigneeFieldId: 'lead',
        qaEngineerFieldId: 'qaOwner',
      },
    };
    expect(buildIssueAssigneePatch('x', false, integration)).toEqual({ lead: { id: 'x' } });
    expect(buildIssueAssigneePatch('x', true, integration)).toEqual({ qaOwner: { id: 'x' } });
  });
});
