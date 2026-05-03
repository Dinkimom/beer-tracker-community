import { beforeEach, describe, expect, it, vi } from 'vitest';

import { query } from '@/lib/db';

import {
  findRegistryEmployeeForTrackerSession,
  registryStaffUidHasOverseerTeam,
} from './registryEmployeeTrackerSessionLookup';

vi.mock('@/lib/db', () => ({
  query: vi.fn(),
}));

describe('registryEmployeeTrackerSessionLookup', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
  });

  it('findRegistryEmployeeForTrackerSession maps row and uses public.registry_employees', async () => {
    vi.mocked(query).mockResolvedValue({
      rows: [
        {
          uuid: '11111111-1111-4111-8111-111111111111',
          email: 'a@example.com',
          name: 'Иван',
          surname: 'Иванов',
          patronymic: 'Петрович',
          fullname: null,
        },
      ],
    } as never);
    const row = await findRegistryEmployeeForTrackerSession('tid-1');
    expect(row).toEqual({
      staffUid: '11111111-1111-4111-8111-111111111111',
      email: 'a@example.com',
      displayName: 'Иванов Иван Петрович',
    });
    const [sql, params] = vi.mocked(query).mock.calls[0]!;
    expect(sql).toMatch(/FROM\s+public\.registry_employees/i);
    expect(params).toEqual(['tid-1']);
  });

  it('registryStaffUidHasOverseerTeam queries overseer.staff_teams', async () => {
    vi.mocked(query).mockResolvedValue({ rows: [{ one: 1 }] } as never);
    const ok = await registryStaffUidHasOverseerTeam('22222222-2222-4222-8222-222222222222');
    expect(ok).toBe(true);
    const [sql, params] = vi.mocked(query).mock.calls[0]!;
    expect(sql).toMatch(/FROM\s+overseer\.staff_teams/i);
    expect(params).toEqual(['22222222-2222-4222-8222-222222222222']);
  });
});
