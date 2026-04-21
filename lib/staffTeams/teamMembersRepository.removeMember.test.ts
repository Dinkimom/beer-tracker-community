import { beforeEach, describe, expect, it, vi } from 'vitest';

import { pool } from '@/lib/db';

import { removeTeamMember } from './teamMembersRepository';

vi.mock('@/lib/db', async () => {
  const actual = await vi.importActual('@/lib/db');
  return {
    ...(actual as object),
    pool: {
      connect: vi.fn(),
    },
  };
});

describe('removeTeamMember', () => {
  beforeEach(() => {
    vi.mocked(pool.connect).mockReset();
  });

  it('runs transaction: delete team_members then user_team_memberships when row existed', async () => {
    const queries: string[] = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql === 'BEGIN') {
          return { rowCount: 0 };
        }
        if (/DELETE\s+FROM[\s\S]*\bteam_members\b/i.test(sql)) {
          return { rowCount: 1 };
        }
        if (/DELETE\s+FROM[\s\S]*\buser_team_memberships\b/i.test(sql)) {
          return { rowCount: 1 };
        }
        if (sql === 'COMMIT' || sql === 'ROLLBACK') {
          return { rowCount: 0 };
        }
        return { rowCount: 0 };
      }),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const ok = await removeTeamMember('org-1', '00000000-0000-4000-8000-000000000002', 'staff-1');
    expect(ok).toBe(true);
    expect(client.query).toHaveBeenCalled();
    expect(queries[0]).toBe('BEGIN');
    expect(queries.some((q) => /\bteam_members\b/i.test(q) && /DELETE/i.test(q))).toBe(true);
    expect(queries.some((q) => /\buser_team_memberships\b/i.test(q) && /DELETE/i.test(q))).toBe(
      true
    );
    expect(queries[queries.length - 1]).toBe('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back when team_members delete matched nothing', async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (/DELETE\s+FROM[\s\S]*\bteam_members\b/i.test(sql)) {
          return { rowCount: 0 };
        }
        return { rowCount: 0 };
      }),
      release: vi.fn(),
    };
    vi.mocked(pool.connect).mockResolvedValue(client as never);

    const ok = await removeTeamMember('org-1', '00000000-0000-4000-8000-000000000002', 'staff-1');
    expect(ok).toBe(false);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
  });
});
