import type { TeamRow } from './types';

import { describe, expect, it } from 'vitest';

import { findTeamBlockingBoard, findTeamBlockingQueue } from './teamBindingConflicts';

function mockTeam(partial: Partial<TeamRow> & Pick<TeamRow, 'id'>): TeamRow {
  return {
    active: true,
    created_at: new Date(),
    organization_id: 'org',
    slug: 's',
    title: 'T',
    tracker_board_id: '1',
    tracker_queue_key: 'Q',
    updated_at: new Date(),
    ...partial,
  };
}

describe('teamBindingConflicts', () => {
  const teams = [
    mockTeam({ id: 'a', title: 'Alpha', tracker_queue_key: 'NW', tracker_board_id: '10' }),
    mockTeam({ id: 'b', title: 'Beta', tracker_queue_key: 'XX', tracker_board_id: '20' }),
  ];

  it('findTeamBlockingQueue returns owner', () => {
    expect(findTeamBlockingQueue(teams, 'NW')?.title).toBe('Alpha');
    expect(findTeamBlockingQueue(teams, 'YY')).toBeNull();
  });

  it('findTeamBlockingQueue respects excludeTeamId', () => {
    expect(findTeamBlockingQueue(teams, 'NW', 'a')).toBeNull();
  });

  it('findTeamBlockingBoard returns owner', () => {
    expect(findTeamBlockingBoard(teams, 10)?.title).toBe('Alpha');
    expect(findTeamBlockingBoard(teams, 99)).toBeNull();
  });
});
