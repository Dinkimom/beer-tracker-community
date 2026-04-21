import type { StaffRow } from '@/lib/staffTeams/types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  findStaffByOrganizationAndEmailNorm,
  findStaffByTrackerUserId,
  insertStaff,
  updateStaff,
} from '@/lib/staffTeams/staffRepository';

import { upsertStaffFromTrackerInvitationContext } from './invitationService';

vi.mock('@/lib/staffTeams/staffRepository', () => ({
  findStaffByOrganizationAndEmailNorm: vi.fn(),
  findStaffByTrackerUserId: vi.fn(),
  insertStaff: vi.fn(),
  updateStaff: vi.fn(),
}));

const mockByTracker = vi.mocked(findStaffByTrackerUserId);
const mockByEmail = vi.mocked(findStaffByOrganizationAndEmailNorm);
const mockInsert = vi.mocked(insertStaff);
const mockUpdate = vi.mocked(updateStaff);

describe('upsertStaffFromTrackerInvitationContext', () => {
  const org = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ничего не делает при пустом trackerUserId', async () => {
    await upsertStaffFromTrackerInvitationContext({
      emailNorm: 'a@b.c',
      organizationId: org,
      trackerUserId: '  ',
    });
    expect(mockByTracker).not.toHaveBeenCalled();
    expect(mockByEmail).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('обновляет staff по tracker_user_id', async () => {
    mockByTracker.mockResolvedValue({
      created_at: new Date(),
      display_name: 'Old',
      email: 'old@x.com',
      id: 's1',
      manual_override_flags: null,
      organization_id: org,
      tracker_user_id: '99',
      updated_at: new Date(),
    } satisfies StaffRow);
    await upsertStaffFromTrackerInvitationContext({
      displayName: 'New Name',
      emailNorm: 'user@co.test',
      organizationId: org,
      trackerUserId: '99',
    });
    expect(mockUpdate).toHaveBeenCalledWith(org, 's1', {
      display_name: 'New Name',
      email: 'user@co.test',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('обновляет staff по email, если по tracker не найден', async () => {
    mockByTracker.mockResolvedValue(null);
    mockByEmail.mockResolvedValue({
      created_at: new Date(),
      display_name: 'X',
      email: 'user@co.test',
      id: 's2',
      manual_override_flags: null,
      organization_id: org,
      tracker_user_id: null,
      updated_at: new Date(),
    } satisfies StaffRow);
    await upsertStaffFromTrackerInvitationContext({
      displayName: 'Full Name',
      emailNorm: 'user@co.test',
      organizationId: org,
      trackerUserId: '42',
    });
    expect(mockUpdate).toHaveBeenCalledWith(org, 's2', {
      display_name: 'Full Name',
      email: 'user@co.test',
      tracker_user_id: '42',
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it('вставляет staff, если нет ни по tracker, ни по email', async () => {
    mockByTracker.mockResolvedValue(null);
    mockByEmail.mockResolvedValue(null);
    await upsertStaffFromTrackerInvitationContext({
      displayName: 'N',
      emailNorm: 'new@co.test',
      organizationId: org,
      trackerUserId: '7',
    });
    expect(mockInsert).toHaveBeenCalledWith(org, {
      display_name: 'N',
      email: 'new@co.test',
      tracker_user_id: '7',
    });
  });
});
