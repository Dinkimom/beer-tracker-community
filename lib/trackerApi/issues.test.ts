import { describe, expect, it } from 'vitest';

import { formatTrackerApiDateTimeUtc } from './issues';

describe('formatTrackerApiDateTimeUtc', () => {
  it('formats as Tracker API datetime with +0000 offset', () => {
    const d = new Date('2026-04-05T19:55:26.042Z');
    expect(formatTrackerApiDateTimeUtc(d)).toBe('2026-04-05T19:55:26.042+0000');
  });
});
