/**
 * Позиции в планере хранят assignee_id как tracker user id или как `staff:<staff_uuid>`.
 * API Трекера принимает только id пользователя трекера — резолвим staff через таблицу staff.tracker_user_id.
 */

import { query } from '@/lib/db';
import { STAFF_SWIMLANE_ASSIGNEE_PREFIX } from '@/lib/teamMemberUtils';

export async function resolvePlannerAssigneeIdsForTrackerSync(
  organizationId: string,
  assigneeIds: readonly string[]
): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const staffUuidToKeys = new Map<string, Set<string>>();

  for (const rawKey of assigneeIds) {
    const id = rawKey?.trim() ?? '';
    if (!id) {
      out.set(rawKey, null);
      continue;
    }
    if (!id.startsWith(STAFF_SWIMLANE_ASSIGNEE_PREFIX)) {
      out.set(rawKey, id);
      continue;
    }
    const uuid = id.slice(STAFF_SWIMLANE_ASSIGNEE_PREFIX.length).trim();
    if (!uuid) {
      out.set(rawKey, null);
      continue;
    }
    let keys = staffUuidToKeys.get(uuid);
    if (!keys) {
      keys = new Set();
      staffUuidToKeys.set(uuid, keys);
    }
    keys.add(rawKey);
  }

  if (staffUuidToKeys.size === 0) {
    return out;
  }

  const uuids = [...staffUuidToKeys.keys()];
  const res = await query<{ id: string; tracker_user_id: string | null }>(
    `SELECT id, tracker_user_id FROM staff WHERE organization_id = $1 AND id = ANY($2::uuid[])`,
    [organizationId, uuids]
  );
  const tidByStaffId = new Map<string, string>();
  for (const r of res.rows) {
    const t = r.tracker_user_id?.trim() ?? '';
    if (t.length > 0) {
      tidByStaffId.set(r.id, t);
    }
  }

  for (const u of uuids) {
    const keys = staffUuidToKeys.get(u);
    if (!keys) continue;
    const resolved = tidByStaffId.get(u) ?? null;
    for (const k of keys) {
      out.set(k, resolved);
    }
  }

  return out;
}

export async function resolvePlannerAssigneeIdForTrackerSync(
  organizationId: string,
  assigneeId: string
): Promise<string | null> {
  const m = await resolvePlannerAssigneeIdsForTrackerSync(organizationId, [assigneeId]);
  return m.get(assigneeId) ?? null;
}
