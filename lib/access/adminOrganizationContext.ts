/**
 * Контекст организации для админки: кэш на запрос (React cache), супер-админ + cookie выбора org.
 */

import type { UserOrganizationSummary } from '@/lib/organizations';

import { cookies } from 'next/headers';
import { cache } from 'react';
import { z } from 'zod';

import { enrichOrganizationSummariesForUser } from '@/lib/access/orgAccess';
import { resolvePrimaryAdminOrganizationId } from '@/lib/access/resolvePrimaryAdminOrganization';
import { ADMIN_ACTIVE_ORGANIZATION_COOKIE } from '@/lib/auth/adminActiveOrganizationCookie';
import { isProductSuperAdmin } from '@/lib/auth/superAdmin';
import {
  listAllOrganizationsAdminSummaries,
  listUserOrganizations,
} from '@/lib/organizations';

const UuidSchema = z.string().uuid();

export interface AdminOrganizationRequestContext {
  activeOrganizationId: string;
  isSuperAdmin: boolean;
  orgs: UserOrganizationSummary[];
}

export function pickResolvedAdminOrganizationId(
  orgs: readonly UserOrganizationSummary[],
  options: { cookieOrgId: string | undefined; isSuperAdmin: boolean }
): string {
  const { cookieOrgId, isSuperAdmin } = options;
  if (isSuperAdmin && cookieOrgId) {
    const parsed = UuidSchema.safeParse(cookieOrgId.trim());
    if (parsed.success && orgs.some((o) => o.organization_id === parsed.data)) {
      return parsed.data;
    }
  }
  return resolvePrimaryAdminOrganizationId(orgs);
}

/**
 * Один вызов на HTTP-запрос (layout + страницы админки).
 */
export const getCachedAdminOrganizationContext = cache(
  async (userId: string): Promise<AdminOrganizationRequestContext> => {
    const superAdmin = await isProductSuperAdmin(userId);
    const orgs = superAdmin
      ? await listAllOrganizationsAdminSummaries()
      : await enrichOrganizationSummariesForUser(userId, await listUserOrganizations(userId));

    const cookieStore = await cookies();
    const cookieOrgId = superAdmin
      ? cookieStore.get(ADMIN_ACTIVE_ORGANIZATION_COOKIE)?.value
      : undefined;

    const activeOrganizationId = pickResolvedAdminOrganizationId(orgs, {
      cookieOrgId,
      isSuperAdmin: superAdmin,
    });

    return {
      activeOrganizationId,
      isSuperAdmin: superAdmin,
      orgs,
    };
  }
);
