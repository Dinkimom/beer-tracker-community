/**
 * Хеширование паролей учётной записи продукта (scrypt).
 */

import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

const PREFIX = 'scrypt1';
const SALT_LEN = 16;
const KEY_LEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(plain: string): string {
  const salt = randomBytes(SALT_LEN);
  const hash = scryptSync(plain, salt, KEY_LEN, {
    N: SCRYPT_N,
    maxmem: 64 * 1024 * 1024,
    p: SCRYPT_P,
    r: SCRYPT_R,
  });
  return `${PREFIX}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(plain: string, stored: string | null | undefined): boolean {
  if (!stored || !stored.startsWith(`${PREFIX}$`)) {
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 3) {
    return false;
  }
  const salt = Buffer.from(parts[1]!, 'base64');
  const expectedHash = Buffer.from(parts[2]!, 'base64');
  const hash = scryptSync(plain, salt, expectedHash.length, {
    N: SCRYPT_N,
    maxmem: 64 * 1024 * 1024,
    p: SCRYPT_P,
    r: SCRYPT_R,
  });
  if (hash.length !== expectedHash.length) {
    return false;
  }
  return timingSafeEqual(hash, expectedHash);
}
