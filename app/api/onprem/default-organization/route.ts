import { NextResponse } from 'next/server';

import { query } from '@/lib/db';
import { isOnPremMode } from '@/lib/deploymentMode';
import { readOnPremSetupState } from '@/lib/onPrem/setupState';

/**
 * GET /api/onprem/default-organization — UUID первой организации продукта (для экрана входа по токену трекера).
 * Только on-prem после инициализации; без аутентификации.
 */
export async function GET() {
  if (!isOnPremMode()) {
    return NextResponse.json({ error: 'Недоступно' }, { status: 404 });
  }
  const setup = await readOnPremSetupState();
  if (!setup.hasOrganizations) {
    return NextResponse.json({ error: 'Инициализация не завершена' }, { status: 404 });
  }
  const res = await query<{ id: string }>(
    `SELECT id FROM organizations ORDER BY created_at ASC LIMIT 1`
  );
  const id = res.rows[0]?.id;
  if (!id) {
    return NextResponse.json({ error: 'Организация не найдена' }, { status: 404 });
  }
  return NextResponse.json({ organizationId: id });
}
