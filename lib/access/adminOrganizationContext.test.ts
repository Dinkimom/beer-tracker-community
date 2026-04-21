import type { UserOrganizationSummary } from '@/lib/organizations';

import { describe, expect, it } from 'vitest';

import { pickResolvedAdminOrganizationId } from './adminOrganizationContext';

function org(id: string, name: string): UserOrganizationSummary {
  return {
    organization_id: id,
    name,
    slug: null,
    initial_sync_completed_at: null,
    role: 'org_admin',
    canAccessAdmin: true,
    canUsePlanner: true,
    managedTeamIds: null,
  };
}

describe('pickResolvedAdminOrganizationId', () => {
  const orgs = [
    org('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Alpha'),
    org('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Beta'),
  ];

  it('uses cookie when super admin and id is in list', () => {
    expect(
      pickResolvedAdminOrganizationId(orgs, {
        isSuperAdmin: true,
        cookieOrgId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      })
    ).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('ignores cookie when not super admin', () => {
    expect(
      pickResolvedAdminOrganizationId(orgs, {
        isSuperAdmin: false,
        cookieOrgId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      })
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('ignores invalid cookie uuid', () => {
    expect(
      pickResolvedAdminOrganizationId(orgs, {
        isSuperAdmin: true,
        cookieOrgId: 'not-uuid',
      })
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });

  it('ignores cookie org not in list', () => {
    expect(
      pickResolvedAdminOrganizationId(orgs, {
        isSuperAdmin: true,
        cookieOrgId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      })
    ).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  });
});
