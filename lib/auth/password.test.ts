import { describe, expect, it } from 'vitest';

import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('verifyPassword accepts hash from hashPassword', () => {
    const h = hashPassword('correct horse battery');
    expect(verifyPassword('correct horse battery', h)).toBe(true);
  });

  it('rejects wrong password', () => {
    const h = hashPassword('a');
    expect(verifyPassword('b', h)).toBe(false);
  });

  it('rejects empty stored', () => {
    expect(verifyPassword('x', null)).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });
});
