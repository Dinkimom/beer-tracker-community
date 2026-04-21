/**
 * Резолв Cloud Organization ID и URL API трекера для запроса планера:
 * только при сессии продукта + {@link TENANT_ORG_HEADER} — из `organizations.tracker_org_id` / `tracker_api_base_url`.
 */

import type { OrganizationRow } from '@/lib/organizations/types';

import { z } from 'zod';

import { isOnPremMode } from '@/lib/deploymentMode';
import { getProductUserIdFromRequest } from '@/lib/auth/productSession';
import { readOnPremSetupState } from '@/lib/onPrem/setupState';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import { findOrganizationById } from '@/lib/organizations/organizationRepository';
import { TENANT_ORG_HEADER } from '@/lib/tenantHttpConstants';
import { normalizeTrackerApiBaseUrl } from '@/lib/trackerCredentialsValidation';

const UuidSchema = z.string().uuid();

function cleanTrackerTokenFromRequest(request: Request): string {
  const raw = request.headers.get('x-tracker-token') || '';
  return raw.replace(/\s+/g, '').trim();
}

export class TrackerApiConfigError extends Error {
  override readonly name = 'TrackerApiConfigError';

  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
  }
}

export function resolveTrackerApiBaseUrlForOrganizationRow(org: OrganizationRow): string {
  const fromOrg = org.tracker_api_base_url?.trim();
  if (fromOrg) {
    try {
      return normalizeTrackerApiBaseUrl(fromOrg);
    } catch {
      /* fall through */
    }
  }
  const envUrl = process.env.TRACKER_API_URL?.trim();
  if (envUrl) {
    try {
      return normalizeTrackerApiBaseUrl(envUrl);
    } catch {
      /* fall through */
    }
  }
  return 'https://api.tracker.yandex.net/v3';
}

async function trackerCloudContextForProductOrganization(
  userId: string,
  organizationId: string
): Promise<{ apiUrl: string; orgId: string }> {
  const membership = await findOrganizationMembership(organizationId, userId);
  if (!membership) {
    throw new TrackerApiConfigError('Нет доступа к организации', 403);
  }
  const org = await findOrganizationById(organizationId);
  if (!org) {
    throw new TrackerApiConfigError('Организация не найдена', 404);
  }
  const trackerOrgId = org.tracker_org_id?.trim();
  if (!trackerOrgId) {
    throw new TrackerApiConfigError(
      'Для организации не настроен Яндекс Трекер. Откройте админку и подключите трекер.',
      422
    );
  }
  return {
    apiUrl: resolveTrackerApiBaseUrlForOrganizationRow(org),
    orgId: trackerOrgId,
  };
}

/**
 * Контекст API трекера по UUID организации продукта без сессии пользователя (только on-prem после инициализации).
 */
export async function resolveTrackerCloudContextForProductOrganizationIdOnPrem(
  organizationProductId: string
): Promise<{ apiUrl: string; orgId: string }> {
  const setup = await readOnPremSetupState();
  if (!setup.hasOrganizations) {
    throw new TrackerApiConfigError('Завершите первичную настройку.', 403);
  }
  const org = await findOrganizationById(organizationProductId);
  if (!org) {
    throw new TrackerApiConfigError('Организация не найдена', 404);
  }
  const trackerOrgId = org.tracker_org_id?.trim();
  if (!trackerOrgId) {
    throw new TrackerApiConfigError(
      'Для организации не настроен Яндекс Трекер. Откройте админку и подключите трекер.',
      422
    );
  }
  return {
    apiUrl: resolveTrackerApiBaseUrlForOrganizationRow(org),
    orgId: trackerOrgId,
  };
}

/**
 * Конфиг для `createTrackerApiClient`: токен из `X-Tracker-Token`, org/url из tenant (БД).
 */
export async function resolveTrackerApiConfigFromRequest(request: Request): Promise<{
  apiUrl: string;
  oauthToken: string;
  orgId: string;
}> {
  const oauthToken = cleanTrackerTokenFromRequest(request);
  if (!oauthToken) {
    throw new Error('Missing X-Tracker-Token header for Tracker API');
  }

  const userId = getProductUserIdFromRequest(request);
  const rawOrgHeader = request.headers.get(TENANT_ORG_HEADER)?.trim();
  const orgParsed = rawOrgHeader ? UuidSchema.safeParse(rawOrgHeader) : null;

  if (!userId) {
    throw new TrackerApiConfigError('Требуется сессия приложения.', 401);
  }
  if (!orgParsed?.success) {
    throw new TrackerApiConfigError(
      'Передайте заголовок X-Organization-Id с UUID организации продукта.',
      400
    );
  }

  const { apiUrl, orgId } = await trackerCloudContextForProductOrganization(
    userId,
    orgParsed.data
  );
  return { apiUrl, oauthToken, orgId };
}

/**
 * Для POST /api/auth/validate-token: org из заголовка или тела.
 * С сессией продукта — только организации, где есть членство; без сессии — только on-prem после инициализации.
 */
export async function resolveValidateTokenTrackerContext(
  request: Request,
  bodyOrganizationId: unknown
): Promise<{ apiUrl: string; orgId: string }> {
  const userId = getProductUserIdFromRequest(request);
  const rawHeader = request.headers.get(TENANT_ORG_HEADER)?.trim();
  const rawBody = typeof bodyOrganizationId === 'string' ? bodyOrganizationId.trim() : '';
  const rawOrg = rawHeader || rawBody;
  const parsed = rawOrg ? UuidSchema.safeParse(rawOrg) : null;

  if (!parsed?.success) {
    throw new TrackerApiConfigError(
      'Выберите организацию в приложении или укажите organizationId в теле запроса (UUID).',
      400
    );
  }

  if (userId) {
    return trackerCloudContextForProductOrganization(userId, parsed.data);
  }

  if (!isOnPremMode()) {
    throw new TrackerApiConfigError('Войдите в аккаунт продукта.', 401);
  }

  return resolveTrackerCloudContextForProductOrganizationIdOnPrem(parsed.data);
}
