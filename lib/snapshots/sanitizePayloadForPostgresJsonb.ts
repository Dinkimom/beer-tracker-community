/**
 * PostgreSQL json/jsonb отклоняет часть того, что допускает JSON.stringify (NUL в строках,
 * одиночные UTF-16 суррогаты) — ошибка «unsupported Unicode escape sequence».
 */

/**
 * Удаляет U+0000 и исправляет одиночные суррогаты (замена на U+FFFD), чтобы текст
 * проходил приведение к jsonb.
 */
export function sanitizeStringForPostgresJsonb(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c0 = s.charCodeAt(i);
    if (c0 === 0) {
      continue;
    }
    if (c0 >= 0xd800 && c0 <= 0xdbff) {
      const c1 = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (c1 >= 0xdc00 && c1 <= 0xdfff) {
        out += s.slice(i, i + 2);
        i++;
        continue;
      }
      out += '\uFFFD';
      continue;
    }
    if (c0 >= 0xdc00 && c0 <= 0xdfff) {
      out += '\uFFFD';
      continue;
    }
    out += s.charAt(i);
  }
  return out;
}

export function deepSanitizeForPostgresJsonb(input: unknown): unknown {
  if (input === null || input === undefined) {
    return input;
  }
  if (typeof input === 'string') {
    return sanitizeStringForPostgresJsonb(input);
  }
  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }
  if (typeof input === 'bigint') {
    return input.toString();
  }
  if (input instanceof Date) {
    return input.toISOString();
  }
  if (Array.isArray(input)) {
    return input.map(deepSanitizeForPostgresJsonb);
  }
  if (typeof input === 'object') {
    const o = input as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(o)) {
      const v = o[key];
      if (v === undefined) {
        continue;
      }
      out[key] = deepSanitizeForPostgresJsonb(v);
    }
    return out;
  }
  return String(input);
}

export function stringifyForPostgresJsonb(value: unknown): string {
  return JSON.stringify(deepSanitizeForPostgresJsonb(value));
}
