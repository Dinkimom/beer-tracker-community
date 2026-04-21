import { NextResponse } from 'next/server';
import { z } from 'zod';

import { handleApiError } from '@/lib/api-error-handler';
import { getTrackerApiFromRequest } from '@/lib/api-tracker';
import { getProductUserIdFromRequest } from '@/lib/auth/productSession';
import { findOrganizationMembership } from '@/lib/organizations/organizationMembersRepository';
import { getStaffByTrackerUserIdInOrg } from '@/lib/staffTeams';
import { TENANT_ORG_HEADER } from '@/lib/tenantHttpConstants';

const UuidSchema = z.string().uuid();

/**
 * GET /api/auth/myself
 * Данные текущего пользователя из Tracker (/myself).
 * Аватар и birthdate — из staff организации, если передан {@link TENANT_ORG_HEADER} и есть членство.
 */
export async function GET(request: Request) {
  try {
    const trackerApi = await getTrackerApiFromRequest(request);
    const { data } = await trackerApi.get('/myself');

    let avatarUrl: string | null = null;
    let birthdate: string | null = null;
    try {
      const trackerId = (data?.trackerUid ?? data?.uid)?.toString();
      const userId = getProductUserIdFromRequest(request);
      const rawOrg = request.headers.get(TENANT_ORG_HEADER)?.trim();
      if (trackerId && userId && rawOrg) {
        const orgParsed = UuidSchema.safeParse(rawOrg);
        if (orgParsed.success) {
          const organizationId = orgParsed.data;
          const membership = await findOrganizationMembership(
            organizationId,
            userId
          );
          if (membership) {
            const staff = await getStaffByTrackerUserIdInOrg(
              organizationId,
              trackerId
            );
            avatarUrl = staff?.avatarUrl ?? null;
            birthdate = staff?.birthdate ?? null;
          }
        }
      }
    } catch (registryError) {
      console.warn('[auth/myself] Failed to enrich from staff:', registryError);
    }

    return NextResponse.json({
      ...data,
      avatarUrl,
      birthdate,
    });
  } catch (error) {
    return handleApiError(error, 'get current user (myself)');
  }
}
