import { beforeEach, describe, expect, it, vi } from 'vitest';

import { enqueueInitialFullSync } from '@/lib/sync/queue';
import { isSyncRedisConfigured } from '@/lib/sync/redisConnection';
import { validateYandexTrackerOAuth } from '@/lib/trackerCredentialsValidation';

import { findOrganizationById } from './organizationRepository';
import { getDecryptedOrganizationTrackerToken } from './organizationSecretsRepository';
import { isOrganizationTrackerConnectionReady } from './organizationTrackerAdminFormState';
import {
  connectOrganizationTracker,
  verifyStoredOrganizationTrackerToken,
} from './organizationTrackerConnection';

const ORG = '00000000-0000-4000-8000-000000000101';
const USER = '00000000-0000-4000-8000-000000000202';

const mockConnect = vi.fn();
const mockClientQuery = vi.fn();
const mockRelease = vi.fn();

vi.mock('./organizationRepository', () => ({
  findOrganizationById: vi.fn(),
}));

vi.mock('./organizationSecretsRepository', () => ({
  getDecryptedOrganizationTrackerToken: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  pool: { connect: (...args: unknown[]) => mockConnect(...args) },
  qualifyBeerTrackerTables: (sql: string) => sql,
}));

vi.mock('@/lib/crypto-org-secrets', () => ({
  encryptOrgTrackerToken: vi.fn(() => Buffer.from('mock-cipher')),
}));

vi.mock('@/lib/env', () => ({
  getOrgSecretsMasterKey: vi.fn(() => Buffer.alloc(32, 1)),
  getTrackerConfig: vi.fn(() => ({ apiUrl: 'https://api.tracker.yandex.net/v3' })),
}));

vi.mock('@/lib/sync/queue', () => ({
  enqueueInitialFullSync: vi.fn(() => Promise.resolve({ id: 'job-1' } as never)),
}));

vi.mock('@/lib/sync/redisConnection', () => ({
  isSyncRedisConfigured: vi.fn(),
}));

vi.mock('@/lib/trackerCredentialsValidation', async (importOriginal) => {
  const mod = (await importOriginal()) as Record<string, unknown>;
  return {
    ...mod,
    validateYandexTrackerOAuth: vi.fn(),
  };
});

function minimalOrg() {
  return {
    created_at: new Date(),
    id: ORG,
    initial_sync_completed_at: null,
    name: 'Test Org',
    settings: {},
    slug: 'test',
    sync_next_run_at: null,
    tracker_org_id: '',
    updated_at: new Date(),
  };
}

describe('connectOrganizationTracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRelease.mockReset();
    mockClientQuery.mockReset();
    mockConnect.mockReset();
    mockConnect.mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    mockClientQuery
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce(undefined);
    vi.mocked(findOrganizationById).mockResolvedValue(minimalOrg());
    vi.mocked(getDecryptedOrganizationTrackerToken).mockResolvedValue(null);
    vi.mocked(validateYandexTrackerOAuth).mockResolvedValue({ ok: true });
    vi.mocked(isSyncRedisConfigured).mockReturnValue(true);
  });

  it('does not persist when Tracker OAuth validation fails', async () => {
    vi.mocked(validateYandexTrackerOAuth).mockResolvedValue({
      message: 'Недействительный токен',
      ok: false,
      status: 401,
    });

    const r = await connectOrganizationTracker({
      oauthToken: 'bad',
      organizationId: ORG,
      trackerApiBaseUrl: 'https://api.tracker.yandex.net/v3',
      trackerOrgId: 'cloud-1',
      userId: USER,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(401);
    }
    expect(mockConnect).not.toHaveBeenCalled();
    expect(enqueueInitialFullSync).not.toHaveBeenCalled();
  });

  it('persists connection and enqueues initial_full when Redis is configured', async () => {
    const r = await connectOrganizationTracker({
      oauthToken: 'oauth-secret-token',
      organizationId: ORG,
      trackerApiBaseUrl: 'https://api.tracker.yandex.net/v3',
      trackerOrgId: 'cloud-1',
      userId: USER,
    });

    expect(r).toEqual({
      ok: true,
      syncJobEnqueued: true,
      syncJobWarning: undefined,
    });
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalled();
    expect(enqueueInitialFullSync).toHaveBeenCalledWith(ORG, USER);
  });

  it('returns syncJobEnqueued false with warning when Redis is not configured', async () => {
    vi.mocked(isSyncRedisConfigured).mockReturnValue(false);

    const r = await connectOrganizationTracker({
      oauthToken: 'oauth-secret-token',
      organizationId: ORG,
      trackerApiBaseUrl: 'https://api.tracker.yandex.net/v3',
      trackerOrgId: 'cloud-1',
      userId: USER,
    });

    expect(r).toEqual({
      ok: true,
      syncJobEnqueued: false,
      syncJobWarning:
        'Redis не настроен (REDIS_URL); первичную синхронизацию нужно запустить вручную',
    });
    expect(enqueueInitialFullSync).not.toHaveBeenCalled();
  });

  it('returns unchanged without DB or Tracker when org/url match and token not re-sent', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue({
      ...minimalOrg(),
      tracker_org_id: 'cloud-1',
    });

    const r = await connectOrganizationTracker({
      oauthToken: '',
      organizationId: ORG,
      trackerApiBaseUrl: 'https://api.tracker.yandex.net/v3',
      trackerOrgId: 'cloud-1',
      userId: USER,
    });

    expect(r).toEqual({ ok: true, syncJobEnqueued: false, unchanged: true });
    expect(validateYandexTrackerOAuth).not.toHaveBeenCalled();
    expect(mockConnect).not.toHaveBeenCalled();
    expect(enqueueInitialFullSync).not.toHaveBeenCalled();
  });

  it('updates org/url using stored token when oauthToken is empty', async () => {
    vi.mocked(getDecryptedOrganizationTrackerToken).mockResolvedValue('stored-oauth-token');
    vi.mocked(findOrganizationById).mockResolvedValue({
      ...minimalOrg(),
      tracker_org_id: 'old-cloud',
    });
    mockClientQuery
      .mockReset()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce(undefined);

    const r = await connectOrganizationTracker({
      oauthToken: '',
      organizationId: ORG,
      trackerApiBaseUrl: 'https://api.tracker.yandex.net/v3',
      trackerOrgId: 'cloud-1',
      userId: USER,
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.unchanged).not.toBe(true);
      expect(r.syncJobEnqueued).toBe(true);
    }
    expect(validateYandexTrackerOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        oauthToken: 'stored-oauth-token',
        orgId: 'cloud-1',
      })
    );
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockClientQuery).toHaveBeenCalledTimes(3);
    expect(enqueueInitialFullSync).toHaveBeenCalledWith(ORG, USER);
  });

  it('fails when oauthToken empty and no stored token', async () => {
    const r = await connectOrganizationTracker({
      oauthToken: '',
      organizationId: ORG,
      trackerApiBaseUrl: 'https://api.tracker.yandex.net/v3',
      trackerOrgId: 'cloud-1',
      userId: USER,
    });

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
    }
    expect(mockConnect).not.toHaveBeenCalled();
  });
});

describe('verifyStoredOrganizationTrackerToken', () => {
  beforeEach(() => {
    vi.mocked(findOrganizationById).mockResolvedValue({
      ...minimalOrg(),
      tracker_org_id: 'cloud-verify',
    });
    vi.mocked(getDecryptedOrganizationTrackerToken).mockResolvedValue('decrypted-token');
    vi.mocked(validateYandexTrackerOAuth).mockResolvedValue({ ok: true });
  });

  it('returns ok when stored token validates against Tracker API', async () => {
    const r = await verifyStoredOrganizationTrackerToken(ORG);
    expect(r).toEqual({ ok: true });
    expect(validateYandexTrackerOAuth).toHaveBeenCalled();
  });

  it('returns error when Cloud Org ID is not set', async () => {
    vi.mocked(findOrganizationById).mockResolvedValue({
      ...minimalOrg(),
      tracker_org_id: '',
    });
    const r = await verifyStoredOrganizationTrackerToken(ORG);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
    }
  });
});

describe('isOrganizationTrackerConnectionReady', () => {
  it('returns false for null/undefined', () => {
    expect(isOrganizationTrackerConnectionReady(null)).toBe(false);
    expect(isOrganizationTrackerConnectionReady(undefined)).toBe(false);
  });

  it('returns false without token or org id', () => {
    expect(
      isOrganizationTrackerConnectionReady({
        hasStoredToken: false,
        organizationId: 'o1',
        trackerOrgId: 'cloud',
      })
    ).toBe(false);
    expect(
      isOrganizationTrackerConnectionReady({
        hasStoredToken: true,
        organizationId: 'o1',
        trackerOrgId: '  ',
      })
    ).toBe(false);
  });

  it('returns true when token and non-empty cloud org id', () => {
    expect(
      isOrganizationTrackerConnectionReady({
        hasStoredToken: true,
        organizationId: 'o1',
        trackerOrgId: 'cloud-1',
      })
    ).toBe(true);
  });
});
