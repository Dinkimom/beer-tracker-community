import { describe, expect, it } from 'vitest';

import { parseInvitationRawTokenFromRouteParam } from './invitationTokenRouteParse';

describe('parseInvitationRawTokenFromRouteParam', () => {
  it('trims and removes inner whitespace from broken copy-paste', () => {
    expect(parseInvitationRawTokenFromRouteParam('  ab cd\nef  ')).toBe('abcdef');
  });

  it('decodes percent-encoding once', () => {
    expect(parseInvitationRawTokenFromRouteParam('a%2Db')).toBe('a-b');
  });

  it('returns collapsed string when decodeURIComponent throws', () => {
    expect(parseInvitationRawTokenFromRouteParam('bad%')).toBe('bad%');
  });
});
