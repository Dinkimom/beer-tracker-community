/**
 * Реестр сотрудников организации (staff).
 */

import type { StaffRow } from './types';
import type { QueryParams } from '@/types';

import { query } from '@/lib/db';

export async function listStaff(organizationId: string): Promise<StaffRow[]> {
  const res = await query<StaffRow>(
    `SELECT id, organization_id, tracker_user_id, display_name, email,
            manual_override_flags, created_at, updated_at
     FROM staff
     WHERE organization_id = $1
     ORDER BY display_name ASC`,
    [organizationId]
  );
  return res.rows;
}

export async function findStaffByTrackerUserId(
  organizationId: string,
  trackerUserId: string
): Promise<StaffRow | null> {
  const res = await query<StaffRow>(
    `SELECT id, organization_id, tracker_user_id, display_name, email,
            manual_override_flags, created_at, updated_at
     FROM staff
     WHERE organization_id = $1 AND tracker_user_id = $2`,
    [organizationId, trackerUserId]
  );
  return res.rows[0] ?? null;
}

export async function findStaffById(
  organizationId: string,
  staffId: string
): Promise<StaffRow | null> {
  const res = await query<StaffRow>(
    `SELECT id, organization_id, tracker_user_id, display_name, email,
            manual_override_flags, created_at, updated_at
     FROM staff
     WHERE organization_id = $1 AND id = $2`,
    [organizationId, staffId]
  );
  return res.rows[0] ?? null;
}

export async function findStaffByOrganizationAndEmailNorm(
  organizationId: string,
  emailNorm: string
): Promise<StaffRow | null> {
  const key = emailNorm.trim().toLowerCase();
  if (!key) {
    return null;
  }
  const res = await query<StaffRow>(
    `SELECT id, organization_id, tracker_user_id, display_name, email,
            manual_override_flags, created_at, updated_at
     FROM staff
     WHERE organization_id = $1
       AND email IS NOT NULL
       AND LOWER(TRIM(email)) = $2
     LIMIT 1`,
    [organizationId, key]
  );
  return res.rows[0] ?? null;
}

export interface InsertStaffInput {
  display_name: string;
  email?: string | null;
  manual_override_flags?: Record<string, unknown> | null;
  tracker_user_id?: string | null;
}

export async function insertStaff(
  organizationId: string,
  input: InsertStaffInput
): Promise<StaffRow> {
  const res = await query<StaffRow>(
    `INSERT INTO staff (organization_id, tracker_user_id, display_name, email, manual_override_flags)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, organization_id, tracker_user_id, display_name, email,
               manual_override_flags, created_at, updated_at`,
    [
      organizationId,
      input.tracker_user_id ?? null,
      input.display_name,
      input.email ?? null,
      input.manual_override_flags ?? null,
    ]
  );
  const row = res.rows[0];
  if (!row) {
    throw new Error('insertStaff: no row returned');
  }
  return row;
}

export interface UpdateStaffPatch {
  display_name?: string;
  email?: string | null;
  manual_override_flags?: Record<string, unknown> | null;
  tracker_user_id?: string | null;
}

const STAFF_UPDATE_COLUMNS: (keyof UpdateStaffPatch)[] = [
  'display_name',
  'tracker_user_id',
  'email',
  'manual_override_flags',
];

export async function updateStaff(
  organizationId: string,
  staffId: string,
  patch: UpdateStaffPatch
): Promise<StaffRow | null> {
  const assignments: string[] = [];
  const values: QueryParams = [organizationId, staffId];
  let i = 3;
  for (const col of STAFF_UPDATE_COLUMNS) {
    if (patch[col] === undefined) {
      continue;
    }
    assignments.push(`${col} = $${i}`);
    values.push(patch[col] as QueryParams[number]);
    i += 1;
  }
  if (assignments.length === 0) {
    return findStaffById(organizationId, staffId);
  }
  const res = await query<StaffRow>(
    `UPDATE staff
     SET ${assignments.join(', ')}, updated_at = CURRENT_TIMESTAMP
     WHERE organization_id = $1 AND id = $2
     RETURNING id, organization_id, tracker_user_id, display_name, email,
               manual_override_flags, created_at, updated_at`,
    values
  );
  return res.rows[0] ?? null;
}

export async function deleteStaff(
  organizationId: string,
  staffId: string
): Promise<boolean> {
  const res = await query(
    `DELETE FROM staff
     WHERE organization_id = $1 AND id = $2`,
    [organizationId, staffId]
  );
  return (res.rowCount ?? 0) > 0;
}
