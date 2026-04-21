import { describe, expect, it } from 'vitest';

import { formatAdminDateTime, formatDateTime } from './adminFormatters';

describe('formatAdminDateTime', () => {
  it('returns em-dash for null', () => {
    expect(formatAdminDateTime(null)).toBe('—');
  });

  it('returns em-dash for empty string', () => {
    expect(formatAdminDateTime('')).toBe('—');
  });

  it('returns the original string for an invalid date', () => {
    expect(formatAdminDateTime('not-a-date')).toBe('not-a-date');
  });

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatAdminDateTime('2024-01-15T12:00:00.000Z');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('—');
  });
});

describe('formatDateTime (alias)', () => {
  it('returns em-dash for null', () => {
    expect(formatDateTime(null)).toBe('—');
  });

  it('returns the original string for an invalid date', () => {
    expect(formatDateTime('invalid')).toBe('invalid');
  });

  it('returns a non-empty string for a valid ISO date', () => {
    const result = formatDateTime('2024-06-15T10:00:00.000Z');
    expect(result).not.toBe('—');
    expect(typeof result).toBe('string');
  });
});
