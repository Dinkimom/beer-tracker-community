import { describe, expect, it } from 'vitest';

import { parseTrackerTokenStorageRaw } from './trackerTokenStorage';

describe('parseTrackerTokenStorageRaw', () => {
  it('returns null for empty', () => {
    expect(parseTrackerTokenStorageRaw(null)).toBeNull();
    expect(parseTrackerTokenStorageRaw('')).toBeNull();
    expect(parseTrackerTokenStorageRaw('   ')).toBeNull();
  });

  it('parses JSON object with token and organizationId', () => {
    expect(
      parseTrackerTokenStorageRaw(
        JSON.stringify({ organizationId: '00000000-0000-4000-8000-000000000001', token: 'abc' })
      )
    ).toEqual({ organizationId: '00000000-0000-4000-8000-000000000001', token: 'abc' });
  });

  it('parses JSON string value as legacy wrapped token', () => {
    expect(parseTrackerTokenStorageRaw(JSON.stringify('y0_legacy'))).toEqual({
      organizationId: '',
      token: 'y0_legacy',
    });
  });

  it('parses non-JSON as raw token', () => {
    expect(parseTrackerTokenStorageRaw('plain-token')).toEqual({
      organizationId: '',
      token: 'plain-token',
    });
  });

  it('returns null for object without token', () => {
    expect(parseTrackerTokenStorageRaw(JSON.stringify({ organizationId: 'x' }))).toBeNull();
  });
});
