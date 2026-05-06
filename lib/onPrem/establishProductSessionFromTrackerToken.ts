import { findUserByEmail, findUserById } from '@/lib/auth';
import { createTrackerApiClient } from '@/lib/tracker-client';
import {
  resolveTrackerCloudContextForProductOrganizationIdOnPrem,
  TrackerApiConfigError,
} from '@/lib/trackerRequestConfig';

import { provisionProductUserForTrackerJoin } from './provisionProductUserForTrackerJoin';
import { trackerWorkEmailFromMyself } from './trackerMyselfIdentity';

/**
 * Проверяет OAuth-токен трекера и возвращает id пользователя продукта для выдачи cookie-сессии (on-prem).
 * Достаточно успешного GET /myself в контексте организации трекера из БД: дальнейшие ACL планера — в обычных API.
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

  const emailNorm = trackerWorkEmailFromMyself(myself);
  if (!emailNorm) {
    throw new TrackerApiConfigError(
      'В профиле трекера не указан email. Укажите email в Яндекс Трекере и повторите вход.',
      422
    );
  }

  let user = await findUserByEmail(emailNorm);
  if (!user) {
    try {
      const { userId } = await provisionProductUserForTrackerJoin({
        emailNorm,
        organizationId: input.organizationProductId,
        orgRole: 'member',
      });
      user = await findUserById(userId);
    } catch {
      throw new TrackerApiConfigError(
        'Не удалось выдать учётку продукта. Попросите администратора проверить настройки.',
        403
      );
    }
  }
  if (!user) {
    throw new TrackerApiConfigError(
      'Не удалось выдать учётку продукта. Попросите администратора проверить настройки.',
      403
    );
  }

  return { userId: user.id };
}
