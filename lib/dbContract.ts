/**
 * Централизованные флаги совместимости с коммерческим DB-контрактом.
 */
export function canReadTeamsFromOverseer(): boolean {
  return true;
}

export function canReadRegistryFromPublicSchema(): boolean {
  return true;
}
