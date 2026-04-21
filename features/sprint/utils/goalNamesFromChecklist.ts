import type { ChecklistItem } from '@/types/tracker';

/**
 * Извлекает названия стори/эпиков из целей спринта.
 * Цели пишутся в формате: "<Название стори/эпика>: <что делается в рамках цели>"
 * @returns Set нормализованных названий (trim, для неточного сравнения)
 */
export function getGoalStoryEpicNames(checklistItems: ChecklistItem[]): Set<string> {
  const names = new Set<string>();
  for (const item of checklistItems) {
    const text = (item.text ?? '').trim();
    const colonIndex = text.indexOf(':');
    if (colonIndex > 0) {
      const prefix = text.slice(0, colonIndex).trim();
      if (prefix) names.add(prefix);
    }
  }
  return names;
}

/**
 * Проверяет, есть ли название стори/эпика среди целей спринта.
 * Сравнение: точное совпадение или вхождение (для гибкого матчинга).
 */
export function isNameInSprintGoals(
  displayName: string,
  goalNames: Set<string>
): boolean {
  if (!displayName?.trim() || goalNames.size === 0) return false;
  const normalized = displayName.trim();
  if (goalNames.has(normalized)) return true;
  for (const goal of goalNames) {
    if (normalized.includes(goal) || goal.includes(normalized)) return true;
  }
  return false;
}
