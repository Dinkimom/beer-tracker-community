/**
 * Извлечение userId из запроса по cookie сессии продукта.
 */

import { getProductSessionTokenFromRequest } from './cookies';
import { verifyProductSessionToken } from './sessionToken';

export function getProductUserIdFromRequest(request: Request): string | null {
  const raw = getProductSessionTokenFromRequest(request);
  if (!raw) {
    return null;
  }
  const v = verifyProductSessionToken(raw);
  return v?.userId ?? null;
}
