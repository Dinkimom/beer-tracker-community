import { NextResponse } from 'next/server';
import { z } from 'zod';

import { allocateUniqueOrganizationSlug } from '@/lib/auth/orgSlug';
import { requireProductSession } from '@/lib/auth/requireProductSession';
import { isOnPremMode } from '@/lib/deploymentMode';
import { readOnPremSetupState } from '@/lib/onPrem/setupState';
import {
  findOrganizationBySlug,
  insertOrganization,
  insertOrganizationMember,
  listUserOrganizations,
} from '@/lib/organizations';
import { buildDefaultTrackerIntegrationStored, mergeOrganizationSettingsTrackerIntegration } from '@/lib/trackerIntegration';

const PostBodySchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
});

/**
 * POST /api/organizations — создать организацию и назначить текущего пользователя org_admin.
 */
export async function POST(request: Request) {
  const auth = requireProductSession(request);
  if (auth.response) {
    return auth.response;
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Некорректное тело запроса' }, { status: 400 });
  }
  const parsed = PostBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Укажите название организации' }, { status: 400 });
  }
  if (isOnPremMode()) {
    const setupState = await readOnPremSetupState();
    if (setupState.hasOrganizations) {
      return NextResponse.json(
        { error: 'On-prem версия поддерживает только одну организацию в системе.' },
        { status: 409 }
      );
    }
  }
  const existingOrgs = await listUserOrganizations(auth.userId);
  if (existingOrgs.length > 0) {
    return NextResponse.json(
      { error: 'У вас уже есть организация. Создать вторую нельзя.' },
      { status: 409 }
    );
  }

  const { name, slug: slugInput } = parsed.data;
  let slug: string;
  if (slugInput) {
    const taken = await findOrganizationBySlug(slugInput);
    if (taken) {
      return NextResponse.json({ error: 'Такой slug уже занят' }, { status: 409 });
    }
    slug = slugInput;
  } else {
    slug = await allocateUniqueOrganizationSlug(name);
  }
  const settings = mergeOrganizationSettingsTrackerIntegration(
    {},
    buildDefaultTrackerIntegrationStored(0)
  );
  const org = await insertOrganization({ name, slug, settings });
  await insertOrganizationMember(org.id, auth.userId, 'org_admin');
  return NextResponse.json(
    {
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
      },
    },
    { status: 201 }
  );
}
