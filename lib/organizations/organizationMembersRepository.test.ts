import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query } from '@/lib/db';

import {
  countOrganizationMembersByRole,
  findOrganizationMembership,
  listOrganizationMembers,
  parseMemberDirectoryTeamsJson,
} from './organizationMembersRepository';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

describe('organizationMembersRepository', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
  });

  it('findOrganizationMembership filters by org and user', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    await findOrganizationMembership('org-a', 'user-b');
    const [, params] = vi.mocked(query).mock.calls[0]!;
    expect(params).toEqual(['org-a', 'user-b']);
  });

  it('listOrganizationMembers filters by organization_id only', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    await listOrganizationMembers('org-x');
    const [, params] = vi.mocked(query).mock.calls[0]!;
    expect(params).toEqual(['org-x']);
  });

  it('countOrganizationMembersByRole returns parsed count', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ count: '3' }] } as never);
    await expect(countOrganizationMembersByRole('org-1', 'org_admin')).resolves.toBe(3);
    const [sql, params] = vi.mocked(query).mock.calls[0]!;
    expect(sql).toContain('COUNT(*)');
    expect(params).toEqual(['org-1', 'org_admin']);
  });

  it('parseMemberDirectoryTeamsJson parses json array and string', () => {
    expect(parseMemberDirectoryTeamsJson(null)).toEqual([]);
    expect(
      parseMemberDirectoryTeamsJson([
        { is_team_lead: true, is_team_member: false, team_id: 'tid', title: 'A' },
      ])
    ).toEqual([{ is_team_lead: true, is_team_member: false, team_id: 'tid', title: 'A' }]);
    expect(
      parseMemberDirectoryTeamsJson(
        '[{"team_id":"u1","title":"B","is_team_lead":false,"is_team_member":true}]'
      )
    ).toEqual([{ is_team_lead: false, is_team_member: true, team_id: 'u1', title: 'B' }]);
  });
});
