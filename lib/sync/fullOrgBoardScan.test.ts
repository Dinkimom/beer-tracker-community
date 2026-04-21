import { describe, expect, it } from 'vitest';

import { uniqueBoardIdsFromTeams } from './fullOrgBoardScan';

describe('uniqueBoardIdsFromTeams', () => {
  it('dedupes board ids and skips invalid', () => {
    expect(
      uniqueBoardIdsFromTeams([
        {
          active: true,
          created_at: new Date(),
          id: 'a',
          organization_id: 'o',
          slug: 'a',
          title: 'A',
          tracker_board_id: '10',
          tracker_queue_key: 'q',
          updated_at: new Date(),
        },
        {
          active: true,
          created_at: new Date(),
          id: 'b',
          organization_id: 'o',
          slug: 'b',
          title: 'B',
          tracker_board_id: '11',
          tracker_queue_key: 'q2',
          updated_at: new Date(),
        },
        {
          active: true,
          created_at: new Date(),
          id: 'c',
          organization_id: 'o',
          slug: 'c',
          title: 'C',
          tracker_board_id: 'bad',
          tracker_queue_key: 'q',
          updated_at: new Date(),
        },
      ])
    ).toEqual([10, 11]);
  });
});
