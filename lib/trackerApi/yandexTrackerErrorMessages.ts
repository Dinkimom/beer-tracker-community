/**
 * Человекочитаемые сообщения из JSON-тела ошибок Yandex Tracker API.
 * Форматы зависят от метода, часто встречаются `errorMessage`, `message`, `error`, `errorMessages[]`.
 */
export function userMessageFromYandexTrackerErrorBody(data: unknown): string | undefined {
  if (data == null) return undefined;
  if (typeof data === 'string') {
    const t = data.trim();
    return t || undefined;
  }
  if (typeof data !== 'object') return undefined;
  const o = data as Record<string, unknown>;
  const single = o.errorMessage ?? o.message ?? o.error;
  if (typeof single === 'string') {
    const t = single.trim();
    if (t) return t;
  }
  const messages = o.errorMessages;
  if (Array.isArray(messages) && messages.length > 0) {
    const parts = messages.filter((m): m is string => typeof m === 'string' && m.trim() !== '');
    if (parts.length > 0) return parts.join('; ');
  }
  return undefined;
}
