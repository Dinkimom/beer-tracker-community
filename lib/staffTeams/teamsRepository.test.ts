import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query } from '@/lib/db';

import { getTeamByBoardId, listTeams } from './teamsRepository';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

describe('teamsRepository', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
  });

  it('getTeamByBoardId scopes by organization_id and board', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    await getTeamByBoardId('00000000-0000-4000-8000-000000000001', 99);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = vi.mocked(query).mock.calls[0]!;
    expect(sql).toMatch(/organization_id\s*=\s*\$1/i);
    expect(sql).toMatch(/tracker_board_id\s*=\s*\$2::bigint/i);
    expect(params).toEqual(['00000000-0000-4000-8000-000000000001', '99']);
  });

  it('listTeams passes activeOnly flag as second param', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [] } as never);
    await listTeams('org-1', { activeOnly: true });
    expect(vi.mocked(query).mock.calls[0]![1]).toEqual(['org-1', true]);
  });
});
