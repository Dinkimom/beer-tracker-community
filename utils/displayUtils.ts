/**
 * Утилиты для отображения (инициалы, форматирование имён и т.д.)
 */

/**
 * Возвращает инициалы для отображения в аватаре (до 2 символов).
 * Для "Иван Петров" → "ИП", для одного слова берутся первые 2 буквы.
 */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.trim().substring(0, 2).toUpperCase() || '??';
}
