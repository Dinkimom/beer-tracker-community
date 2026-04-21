/**
 * Подписанный токен сессии: v1.<base64url(payload)>.<base64url(hmac)>
 */

import { createHmac, timingSafeEqual } from 'crypto';

import { getAuthSessionSecret } from '@/lib/env';

import { PRODUCT_SESSION_MAX_AGE_SEC } from './constants';

const VERSION = 'v1';

interface SessionPayload {
  exp: number;
  iat: number;
  sub: string;
}

export function signProductSessionToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    exp: now + PRODUCT_SESSION_MAX_AGE_SEC,
    iat: now,
    sub: userId,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const secret = getAuthSessionSecret();
  const sig = createHmac('sha256', secret)
    .update(`${VERSION}.${payloadB64}`)
    .digest('base64url');
  return `${VERSION}.${payloadB64}.${sig}`;
}

export function verifyProductSessionToken(token: string): { userId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== VERSION) {
    return null;
  }
  const payloadB64 = parts[1]!;
  const sig = parts[2]!;
  const secret = getAuthSessionSecret();
  const expectedSig = createHmac('sha256', secret)
    .update(`${VERSION}.${payloadB64}`)
    .digest('base64url');
  try {
    const sigBuf = Buffer.from(sig, 'base64url');
    const expBuf = Buffer.from(expectedSig, 'base64url');
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as SessionPayload).sub !== 'string' ||
    typeof (parsed as SessionPayload).exp !== 'number'
  ) {
    return null;
  }
  const { exp, sub } = parsed as SessionPayload;
  if (exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return { userId: sub };
}
