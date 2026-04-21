import { describe, expect, it } from 'vitest';

import { clipPhaseToSprint } from './quarterlyPlansV2RouteHelpers';

describe('clipPhaseToSprint', () => {
  it('returns segment fully inside sprint', () => {
    const phase = { durationDays: 3, sprintIndex: 1, startDay: 2 };
    const out = clipPhaseToSprint(phase, 1);
    expect(out).toEqual({
      durationDays: 3,
      sprintIndex: 1,
      startDay: 2,
    });
  });

  it('returns null when phase does not overlap sprint', () => {
    const phase = { durationDays: 1, sprintIndex: 0, startDay: 0 };
    const out = clipPhaseToSprint(phase, 2);
    expect(out).toBeNull();
  });

  it('clips phase spanning sprint boundary', () => {
    const phase = { durationDays: 5, sprintIndex: 1, startDay: 8 };
    const out = clipPhaseToSprint(phase, 1);
    expect(out).toEqual({
      durationDays: 2,
      sprintIndex: 1,
      startDay: 8,
    });
  });
});
