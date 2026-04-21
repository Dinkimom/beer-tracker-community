import type * as OrgAccess from '@/lib/access/orgAccess';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resolveAccessProfile } from '@/lib/access/orgAccess';
import { getProductUserIdFromRequest } from '@/lib/auth/productSession';
import { isProductSuperAdmin } from '@/lib/auth/superAdmin';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';

import {
  requireOrgAdmin,
  requireTenantContext,
  requireTenantForOrganization,
  requireTenantPathMatchesHeader,
  TENANT_ORG_HEADER,
} from './api-tenant';

vi.mock('@/lib/auth/productSession');
vi.mock('@/lib/auth/superAdmin', () => ({
  isProductSuperAdmin: vi.fn().mockResolvedValue(false),
}));
vi.mock('@/lib/organizations/organizationMembersRepository');
vi.mock('@/lib/access/orgAccess', async (importOriginal) => {
  const actual = await importOriginal<typeof OrgAccess>();
  return {
    ...actual,
    resolveAccessProfile: vi.fn(),
  };
});

const ORG = '00000000-0000-4000-8000-000000000001';
const USER = '00000000-0000-4000-8000-000000000002';
const REQ = (url = 'https://example.test/') => new Request(url);

describe('requireTenantForOrganization', () => {
  beforeEach(() => {
    vi.mocked(getProductUserIdFromRequest).mockReset();
    vi.mocked(findOrganizationMembership).mockReset();
    vi.mocked(isProductSuperAdmin).mockReset();
    vi.mocked(isProductSuperAdmin).mockResolvedValue(false);
  });

  it('returns 401 without session', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(null);
    const r = await requireTenantForOrganization(REQ(), ORG);
    if ('ctx' in r) {
      expect.fail('expected error response');
    }
    expect(r.response.status).toBe(401);
  });

  it('returns 403 when not a member (cross-tenant)', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(USER);
    vi.mocked(findOrganizationMembership).mockResolvedValue(null);
    const r = await requireTenantForOrganization(REQ(), ORG);
    if ('ctx' in r) {
      expect.fail('expected error response');
    }
    expect(r.response.status).toBe(403);
  });

  it('returns 400 when path organization id is not a valid UUID', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(USER);
    const r = await requireTenantForOrganization(REQ(), 'not-uuid');
    if ('ctx' in r) {
      expect.fail('expected error response');
    }
    expect(r.response.status).toBe(400);
  });

  it('returns ctx when member', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(USER);
    vi.mocked(findOrganizationMembership).mockResolvedValue({
      created_at: new Date(),
      id: 'm1',
      organization_id: ORG,
      role: 'member',
      user_id: USER,
    });
    const r = await requireTenantForOrganization(REQ(), ORG);
    if (!('ctx' in r)) {
      expect.fail('expected ctx');
    }
    const ctx = r.ctx as NonNullable<(typeof r)['ctx']>;
    expect(ctx.organizationId).toBe(ORG);
    expect(ctx.role).toBe('member');
  });
});

describe('requireTenantContext', () => {
  beforeEach(() => {
    vi.mocked(getProductUserIdFromRequest).mockReset();
    vi.mocked(findOrganizationMembership).mockReset();
    vi.mocked(resolveAccessProfile).mockReset();
    vi.mocked(isProductSuperAdmin).mockReset();
    vi.mocked(isProductSuperAdmin).mockResolvedValue(false);
  });

  it('returns 400 without header', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(USER);
    const r = await requireTenantContext(REQ());
    if ('ctx' in r) {
      expect.fail('expected error response');
    }
    expect(r.response.status).toBe(400);
  });

  it('returns 400 when header is not a valid UUID', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(USER);
    const req = new Request('https://example.test/', {
      headers: { [TENANT_ORG_HEADER]: 'not-a-uuid' },
    });
    const r = await requireTenantContext(req);
    if ('ctx' in r) {
      expect.fail('expected error response');
    }
    expect(r.response.status).toBe(400);
  });

  it('resolves with header', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(USER);
    vi.mocked(findOrganizationMembership).mockResolvedValue({
      created_at: new Date(),
      id: 'm1',
      organization_id: ORG,
      role: 'org_admin',
      user_id: USER,
    });
    vi.mocked(resolveAccessProfile).mockResolvedValue({
      organizationId: ORG,
      orgRole: 'org_admin',
      teamMemberships: [],
      userId: USER,
    });
    const req = new Request('https://example.test/', {
      headers: { [TENANT_ORG_HEADER]: ORG },
    });
    const r = await requireTenantContext(req);
    if ('response' in r) {
      expect.fail('expected ctx');
    }
    expect(r.ctx.role).toBe('org_admin');
    expect(r.profile.orgRole).toBe('org_admin');
  });

  it('returns 403 when user has org membership but no planner access (no teams)', async () => {
    vi.mocked(getProductUserIdFromRequest).mockReturnValue(USER);
    vi.mocked(findOrganizationMembership).mockResolvedValue({
      created_at: new Date(),
      id: 'm1',
      organization_id: ORG,
      role: 'member',
      user_id: USER,
    });
    vi.mocked(resolveAccessProfile).mockResolvedValue({
      organizationId: ORG,
      orgRole: 'member',
      teamMemberships: [],
      userId: USER,
    });
    const req = new Request('https://example.test/', {
      headers: { [TENANT_ORG_HEADER]: ORG },
    });
    const r = await requireTenantContext(req);
    if (!('response' in r)) {
      expect.fail('expected error response');
    }
    expect(r.response.status).toBe(403);
  });
});

describe('requireOrgAdmin', () => {
  it('allows org_admin', () => {
    expect(
      requireOrgAdmin({
        organizationId: ORG,
        role: 'org_admin',
        userId: USER,
      })
    ).toBeNull();
  });

  it('403 for member', () => {
    const d = requireOrgAdmin({
      organizationId: ORG,
      role: 'member',
      userId: USER,
    });
    expect(d?.status).toBe(403);
  });
});

describe('requireTenantPathMatchesHeader', () => {
  it('400 on mismatch', () => {
    const d = requireTenantPathMatchesHeader(
      { organizationId: ORG, role: 'member', userId: USER },
      '00000000-0000-4000-8000-000000000099'
    );
    expect(d?.status).toBe(400);
  });

  it('null when match', () => {
    expect(
      requireTenantPathMatchesHeader(
        { organizationId: ORG, role: 'member', userId: USER },
        ORG
      )
    ).toBeNull();
  });
});
