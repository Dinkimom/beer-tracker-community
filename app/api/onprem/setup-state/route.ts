import { NextResponse } from 'next/server';

import { isOnPremMode } from '@/lib/deploymentMode';
import { readOnPremSetupState } from '@/lib/onPrem/setupState';

/**
 * GET /api/onprem/setup-state — состояние первичной инициализации on-prem.
 */
export async function GET() {
  const onPremMode = isOnPremMode();
  if (!onPremMode) {
    return NextResponse.json({
      onPremMode: false,
      initialized: true,
      selfRegistrationAllowed: true,
    });
  }
  const state = await readOnPremSetupState();
  return NextResponse.json({
    onPremMode: true,
    hasOrganizations: state.hasOrganizations,
    hasUsers: state.hasUsers,
    initialized: state.initialized,
    selfRegistrationAllowed: !state.hasUsers,
  });
}
