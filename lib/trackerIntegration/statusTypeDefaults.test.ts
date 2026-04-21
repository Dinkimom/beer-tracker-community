import { describe, expect, it } from 'vitest';

import { buildStatusDefaultsFromTrackerStatuses, mapTrackerStatusTypeKeyToCategory } from './statusTypeDefaults';

describe('statusTypeDefaults', () => {
  it('mapTrackerStatusTypeKeyToCategory heuristics', () => {
    expect(mapTrackerStatusTypeKeyToCategory('inProgress')).toBe('in-progress');
    expect(mapTrackerStatusTypeKeyToCategory('done')).toBe('done');
    expect(mapTrackerStatusTypeKeyToCategory('new')).toBe('todo');
  });

  it('buildStatusDefaultsFromTrackerStatuses groups by status type key', () => {
    const defaults = buildStatusDefaultsFromTrackerStatuses([
      {
        display: 'A',
        id: '1',
        key: 'a',
        statusType: { key: 'inProgress' },
      },
      {
        display: 'B',
        id: '2',
        key: 'b',
        statusType: { key: 'inProgress' },
      },
    ]);
    expect(defaults.inProgress).toBe('in-progress');
  });
});
