import { describe, expect, it } from 'vitest';

import {
  displayNameLooksLikeEmailLocalPart,
  normalizedEmailLocalPart,
} from './staffDisplayNameEmailLocalPart';

describe('normalizedEmailLocalPart', () => {
  it('returns substring before @', () => {
    expect(normalizedEmailLocalPart('n.dmitriev@yclients.tech')).toBe('n.dmitriev');
  });
});

describe('displayNameLooksLikeEmailLocalPart', () => {
  it('matches local part case-insensitively', () => {
    expect(
      displayNameLooksLikeEmailLocalPart('n.dmitriev@yclients.tech', 'N.Dmitriev')
    ).toBe(true);
  });

  it('returns false when display name is a full name', () => {
    expect(
      displayNameLooksLikeEmailLocalPart('n.dmitriev@yclients.tech', 'Nikolai Dmitriev')
    ).toBe(false);
  });

  it('returns false without email', () => {
    expect(displayNameLooksLikeEmailLocalPart(null, 'x')).toBe(false);
  });
});
