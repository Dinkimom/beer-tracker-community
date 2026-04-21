import { describe, expect, it, vi } from 'vitest';

const {
  mockFindInvitationByHash,
  mockFindOrganizationById,
  mockFindTeamById,
} = vi.hoisted(() => ({
  mockFindInvitationByHash: vi.fn(),
  mockFindOrganizationById: vi.fn(),
  mockFindTeamById: vi.fn(),
}));

vi.mock('@/lib/organizations/organizationInvitationsRepository', () => ({
  findOrganizationInvitationByTokenHash: mockFindInvitationByHash,
  insertOrganizationInvitation: vi.fn(),
}));

vi.mock('@/lib/organizations/organizationRepository', () => ({
  findOrganizationById: mockFindOrganizationById,
}));

vi.mock('@/lib/staffTeams', () => ({
  findTeamById: mockFindTeamById,
}));

import { getInvitationPreview } from './invitationService';

describe('getInvitationPreview', () => {
  it('returns not_found when invitation missing', async () => {
    mockFindInvitationByHash.mockResolvedValue(null);
    const r = await getInvitationPreview('any-raw-token');
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('returns revoked when revoked_at set', async () => {
    mockFindInvitationByHash.mockResolvedValue({
      consumed_at: null,
      created_at: new Date(),
      created_by_user_id: null,
      email: 'a@b.c',
      expires_at: new Date(Date.now() + 86400000),
      id: 'inv1',
      invited_team_role: 'team_member',
      organization_id: 'org1',
      revoked_at: new Date(),
      team_id: 'team1',
      token_hash: 'h',
    });
    const r = await getInvitationPreview('tok');
    expect(r).toEqual({ ok: false, reason: 'revoked' });
  });

  it('returns used when consumed_at set', async () => {
    mockFindInvitationByHash.mockResolvedValue({
      consumed_at: new Date(),
      created_at: new Date(),
      created_by_user_id: null,
      email: 'a@b.c',
      expires_at: new Date(Date.now() + 86400000),
      id: 'inv1',
      invited_team_role: 'team_member',
      organization_id: 'org1',
      revoked_at: null,
      team_id: 'team1',
      token_hash: 'h',
    });
    const r = await getInvitationPreview('tok');
    expect(r).toEqual({ ok: false, reason: 'used' });
  });

  it('returns expired when past expires_at', async () => {
    mockFindInvitationByHash.mockResolvedValue({
      consumed_at: null,
      created_at: new Date(),
      created_by_user_id: null,
      email: 'a@b.c',
      expires_at: new Date(Date.now() - 1000),
      id: 'inv1',
      invited_team_role: 'team_member',
      organization_id: 'org1',
      revoked_at: null,
      team_id: 'team1',
      token_hash: 'h',
    });
    const r = await getInvitationPreview('tok');
    expect(r).toEqual({ ok: false, reason: 'expired' });
  });

  it('returns ok with org-only invitation (no team)', async () => {
    mockFindTeamById.mockClear();
    const exp = new Date(Date.now() + 86400000);
    mockFindInvitationByHash.mockResolvedValue({
      consumed_at: null,
      created_at: new Date(),
      created_by_user_id: null,
      email: 'solo@co.test',
      expires_at: exp,
      id: 'inv2',
      invited_team_role: 'team_member',
      organization_id: 'org1',
      revoked_at: null,
      team_id: null,
      token_hash: 'h2',
    });
    mockFindOrganizationById.mockResolvedValue({ name: 'Solo Org' });
    const r = await getInvitationPreview('raw');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.teamTitle).toBeNull();
      expect(r.organizationName).toBe('Solo Org');
    }
    expect(mockFindTeamById).not.toHaveBeenCalled();
  });

  it('returns ok with org and team names', async () => {
    const exp = new Date(Date.now() + 86400000);
    mockFindInvitationByHash.mockResolvedValue({
      consumed_at: null,
      created_at: new Date(),
      created_by_user_id: null,
      email: 'user@co.test',
      expires_at: exp,
      id: 'inv1',
      invited_team_role: 'team_member',
      organization_id: 'org1',
      revoked_at: null,
      team_id: 'team1',
      token_hash: 'h',
    });
    mockFindOrganizationById.mockResolvedValue({ name: 'Acme' });
    mockFindTeamById.mockResolvedValue({ title: 'Core' });
    const r = await getInvitationPreview('raw');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.email).toBe('user@co.test');
      expect(r.organizationName).toBe('Acme');
      expect(r.teamTitle).toBe('Core');
      expect(r.expiresAt).toBe(new Date(exp).toISOString());
    }
  });
});
