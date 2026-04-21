import { createHash, randomBytes } from 'crypto';

/**
 * Сырой токен хранится только в письме/URL; в БД — SHA-256 hex.
 */
export function generateInvitationRawToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashInvitationToken(rawToken: string): string {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}
