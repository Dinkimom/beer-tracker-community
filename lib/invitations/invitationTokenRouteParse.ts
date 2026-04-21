/**
 * Разбор токена из сегмента URL (без Node crypto — безопасно для импорта из клиентских компонентов).
 */

/**
 * Восстанавливает сырой токен из сегмента пути `/invite/:token` или `/api/invitations/:token`.
 * Убирает пробелы и переносы строк — почтовые клиенты и копипаст иногда разрывают длинную ссылку.
 * Затем однократный `decodeURIComponent` на случай оставшегося процент‑кодирования в пути.
 */
export function parseInvitationRawTokenFromRouteParam(tokenParam: string): string {
  const collapsed = tokenParam.trim().replace(/\s/g, '');
  try {
    return decodeURIComponent(collapsed);
  } catch {
    return collapsed;
  }
}
