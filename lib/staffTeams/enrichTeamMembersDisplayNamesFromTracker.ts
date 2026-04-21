/**
 * Подмена «плейсхолдерного» staff.display_name на ФИО из Яндекс Трекера (по email).
 */

import type { TeamMemberWithStaffRow } from './types';
import type { TeamMember } from '@/types/team';

import { findOrganizationById, getDecryptedOrganizationTrackerToken } from '@/lib/organizations';
import {
  displayNameLooksLikeEmailLocalPart,
  normalizedEmailLocalPart,
} from '@/lib/staffTeams/staffDisplayNameEmailLocalPart';
import { fetchTrackerUsersPaginate } from '@/lib/trackerApi/users';
import { createTrackerAxiosInstance } from '@/lib/trackerAxiosFactory';
import { resolveTrackerApiBaseUrlForOrganizationRow } from '@/lib/trackerRequestConfig';

function buildEmailToTrackerDisplayNameMap(
  users: Awaited<ReturnType<typeof fetchTrackerUsersPaginate>>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const u of users) {
    const em = u.email?.trim().toLowerCase();
    const name = u.displayName?.trim();
    if (!em || !name) {
      continue;
    }
    const prev = map.get(em);
    if (!prev || name.length > prev.length) {
      map.set(em, name);
    }
  }
  return map;
}

function splitDisplayNameToFirstLast(displayName: string): Pick<TeamMember, 'firstName' | 'lastName'> {
  const t = displayName.trim();
  if (!t) {
    return { firstName: '', lastName: '' };
  }
  const parts = t.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0] ?? '', lastName: '' };
  }
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

async function loadTrackerEmailToDisplayNameMap(
  organizationId: string
): Promise<Map<string, string> | null> {
  const org = await findOrganizationById(organizationId);
  if (!org?.tracker_org_id?.trim()) {
    return null;
  }

  let token: string;
  try {
    const t = await getDecryptedOrganizationTrackerToken(organizationId);
    if (!t?.trim()) {
      return null;
    }
    token = t.trim();
  } catch {
    return null;
  }

  const api = createTrackerAxiosInstance({
    apiUrl: resolveTrackerApiBaseUrlForOrganizationRow(org),
    oauthToken: token,
    orgId: org.tracker_org_id.trim(),
  });

  try {
    const trackerUsers = await fetchTrackerUsersPaginate(api);
    return buildEmailToTrackerDisplayNameMap(trackerUsers);
  } catch (e) {
    console.warn('[loadTrackerEmailToDisplayNameMap] Tracker users fetch failed:', e);
    return null;
  }
}

/**
 * Для участников, у которых display_name = локальная часть email, подставляет displayName из Трекера.
 * При ошибке Трекера или отсутствии токена возвращает исходный массив.
 */
export async function enrichTeamMembersDisplayNamesFromTracker(
  organizationId: string,
  members: TeamMemberWithStaffRow[]
): Promise<TeamMemberWithStaffRow[]> {
  if (members.length === 0) {
    return members;
  }

  const byEmail = await loadTrackerEmailToDisplayNameMap(organizationId);
  if (!byEmail) {
    return members;
  }

  return members.map((m) => {
    const email = m.staff_email;
    if (
      !email?.trim() ||
      !displayNameLooksLikeEmailLocalPart(email, m.staff_display_name)
    ) {
      return m;
    }
    const key = email.trim().toLowerCase();
    const fromTracker = byEmail.get(key);
    if (!fromTracker) {
      return m;
    }
    const local = normalizedEmailLocalPart(email);
    if (fromTracker.trim().toLowerCase() === local) {
      return m;
    }
    return { ...m, staff_display_name: fromTracker };
  });
}

/**
 * То же для типа {@link TeamMember} (планер, свимлейн, `/api/teams/members`).
 */
export async function enrichPlannerTeamMembersFromTracker(
  organizationId: string,
  members: TeamMember[]
): Promise<TeamMember[]> {
  if (members.length === 0) {
    return members;
  }

  const byEmail = await loadTrackerEmailToDisplayNameMap(organizationId);
  if (!byEmail) {
    return members;
  }

  return members.map((m) => {
    const email = m.email;
    if (!email?.trim() || !displayNameLooksLikeEmailLocalPart(email, m.displayName)) {
      return m;
    }
    const key = email.trim().toLowerCase();
    const fromTracker = byEmail.get(key);
    if (!fromTracker) {
      return m;
    }
    const local = normalizedEmailLocalPart(email);
    if (fromTracker.trim().toLowerCase() === local) {
      return m;
    }
    return {
      ...m,
      displayName: fromTracker,
      ...splitDisplayNameToFirstLast(fromTracker),
    };
  });
}
