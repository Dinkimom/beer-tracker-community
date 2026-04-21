const ON_PREM_MODE_VALUE = 'onprem';

function readDeploymentModeRaw(): string {
  return (process.env.APP_DEPLOYMENT_MODE ?? '').trim().toLowerCase();
}

export function isOnPremMode(): boolean {
  return readDeploymentModeRaw() === ON_PREM_MODE_VALUE;
}

export function isDemoModeEnabled(): boolean {
  if (isOnPremMode()) {
    return false;
  }
  const raw = (process.env.DEMO_MODE_ENABLED ?? '').trim().toLowerCase();
  if (raw === '0' || raw === 'false' || raw === 'off') {
    return false;
  }
  return true;
}
