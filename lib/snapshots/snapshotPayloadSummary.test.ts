import { describe, expect, it } from 'vitest';

import { statusKeyTypeKeySummaryFromPayload } from './snapshotPayloadSummary';

describe('statusKeyTypeKeySummaryFromPayload', () => {
  it('reads status.type.summary from payload', () => {
    expect(
      statusKeyTypeKeySummaryFromPayload({
        id: 'x1',
        key: 'X-1',
        self: 'u',
        summary: 'Hello',
        status: { display: 'Open', key: 'open' },
        type: { display: 'Task', key: 'task' },
      })
    ).toEqual({ status: 'open', summary: 'Hello', type: 'task' });
  });

  it('falls back to statusType for status key', () => {
    expect(
      statusKeyTypeKeySummaryFromPayload({
        id: 'x1',
        key: 'X-1',
        self: 'u',
        summary: 'S',
        statusType: { display: 'In Progress', key: 'inProgress' },
      })
    ).toEqual({ status: 'inProgress', summary: 'S', type: '' });
  });
});
