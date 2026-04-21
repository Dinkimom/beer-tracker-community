import { canUsePlanner, resolveAccessProfile } from '@/lib/access/orgAccess';
import { findUserByEmail } from '@/lib/auth';
import { findStaffByTrackerUserId } from '@/lib/staffTeams';
import { createTrackerApiClient } from '@/lib/tracker-client';
import {
  resolveTrackerCloudContextForProductOrganizationIdOnPrem,
  TrackerApiConfigError,
} from '@/lib/trackerRequestConfig';

import { staffHasTeamMembershipInOrganization } from './staffTeamAccess';
import { trackerIdentityCandidatesFromMyself } from './trackerMyselfIdentity';

/**
 * Проверяет OAuth-токен трекера и возвращает id пользователя продукта для выдачи cookie-сессии (on-prem).
 */
export async function resolveProductUserIdForOnPremTrackerSession(input: {
  oauthToken: string;
  organizationProductId: string;
}): Promise<{ userId: string }> {
  const { apiUrl, orgId } = await resolveTrackerCloudContextForProductOrganizationIdOnPrem(
    input.organizationProductId
  );

  const trackerApi = createTrackerApiClient({
    apiUrl,
    oauthToken: input.oauthToken,
    orgId,
  });

  let myself: unknown;
  try {
    const res = await trackerApi.get('/myself');
    myself = res.data;
  } catch {
    throw new TrackerApiConfigError('Недействительный токен трекера.', 401);
  }

  const candidates = trackerIdentityCandidatesFromMyself(myself);
  let staff: Awaited<ReturnType<typeof findStaffByTrackerUserId>> = null;
  for (const c of candidates) {
    staff = await findStaffByTrackerUserId(input.organizationProductId, c);
    if (staff) {
      break;
    }
  }

  if (!staff) {
    throw new TrackerApiConfigError(
      'Пользователь не найден в реестре организации. Попросите администратора добавить вас в команду.',
      403
    );
  }

  if (!(await staffHasTeamMembershipInOrganization(input.organizationProductId, staff.id))) {
    throw new TrackerApiConfigError(
      'Нет доступа к планеру: сотрудник не назначен в команду.',
      403
    );
  }

  const emailNorm = staff.email?.trim().toLowerCase();
  if (!emailNorm) {
    throw new TrackerApiConfigError('У сотрудника в реестре не задан email.', 422);
  }

  const user = await findUserByEmail(emailNorm);
  if (!user) {
    throw new TrackerApiConfigError(
      'Учётка продукта не выдана. Попросите администратора добавить вас в команду.',
      403
    );
  }

  const profile = await resolveAccessProfile(user.id, input.organizationProductId);
  if (!profile || !canUsePlanner(profile)) {
    throw new TrackerApiConfigError('Недостаточно прав для планера.', 403);
  }

  return { userId: user.id };
}
