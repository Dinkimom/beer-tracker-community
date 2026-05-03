/**
 * On-prem вход по токену трекера: сотрудник и ACL команд только из public + overseer
 * (без beer_tracker.staff / team_members).
 */

import { query } from '@/lib/db';

export interface RegistryEmployeeForTrackerSession {
  displayName: string;
  email: string | null;
  staffUid: string;
}

function displayNameFromRegistryRow(row: {
  fullname: string | null;
  name: string | null;
  patronymic: string | null;
  surname: string | null;
  uuid: string;
}): string {
  const fn = row.fullname?.trim();
  if (fn) {
    return fn;
  }
  const parts = [row.surname, row.name, row.patronymic]
    .map((p) => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean);
  const joined = parts.join(' ').trim();
  return joined || row.uuid;
}

/**
 * Сотрудник по идентификатору из Tracker GET /myself (tracker_id или uuid в реестре).
 */
export async function findRegistryEmployeeForTrackerSession(
  trackerIdentity: string
): Promise<RegistryEmployeeForTrackerSession | null> {
  const res = await query<{
    email: string | null;
    fullname: string | null;
    name: string | null;
    patronymic: string | null;
    surname: string | null;
    uuid: string;
  }>(
    `SELECT re.uuid, re.email, re.name, re.surname, re.patronymic, re.fullname
     FROM public.registry_employees re
     WHERE re.tracker_id::text = $1 OR re.uuid::text = $1
     LIMIT 1`,
    [trackerIdentity]
  );
  const row = res.rows[0];
  if (!row) {
    return null;
  }
  return {
    staffUid: row.uuid,
    email: row.email,
    displayName: displayNameFromRegistryRow(row),
  };
}

/** Состоит ли сотрудник (uuid реестра) хотя бы в одной команде в overseer. */
export async function registryStaffUidHasOverseerTeam(staffUid: string): Promise<boolean> {
  const res = await query<{ one: number }>(
    `SELECT 1 AS one
     FROM overseer.staff_teams st
     WHERE st.staff_uid = $1::uuid
     LIMIT 1`,
    [staffUid]
  );
  return res.rows.length > 0;
}
