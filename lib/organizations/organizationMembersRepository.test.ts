import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findUserById } from '@/lib/auth';
import { query } from '@/lib/db';
import { findOrganizationById } from '@/lib/organizations/organizationRepository';

import {
  countOrganizationMembersByRole,
  findOrganizationMembership,
  listOrganizationMembers,
  parseMemberDirectoryTeamsJson,
} from './organizationMembersRepository';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  findUserById: vi.fn(),
}));

vi.mock('@/lib/organizations/organizationRepository', () => ({
  findOrganizationById: vi.fn(),
  listAllOrganizationsAdminSummaries: vi.fn(),
}));

describe('organizationMembersRepository', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
  });

  it('findOrganizationMembership resolves member via registry email', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue({ id: 'org-a' } as never);
    vi.mocked(findUserById).mockResolvedValue({
      created_at: new Date('2024-01-01T00:00:00.000Z'),
      email: 'member@example.com',
      id: 'user-b',
      is_super_admin: false,
    } as never);
    vi.mocked(query).mockResolvedValue({ rows: [{ one: 1 }] } as never);

    const row = await findOrganizationMembership('org-a', 'user-b');
    expect(row?.organization_id).toBe('org-a');
    expect(row?.user_id).toBe('user-b');
    expect(row?.role).toBe('member');
  });

  it('listOrganizationMembers filters by organization_id only', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue({ id: 'org-x' } as never);
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    await listOrganizationMembers('org-x');
    const [, params] = vi.mocked(query).mock.calls[0]!;
    expect(params).toEqual(['org-x']);
  });

  it('countOrganizationMembersByRole returns parsed count', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue({ id: 'org-1' } as never);
    vi.mocked(query).mockResolvedValue({ rows: [{ count: '3' }] } as never);
    await expect(countOrganizationMembersByRole('org-1', 'org_admin')).resolves.toBe(3);
    const [sql, params] = vi.mocked(query).mock.calls[0]!;
    expect(sql).toContain('FROM users');
    expect(params).toBeUndefined();
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
