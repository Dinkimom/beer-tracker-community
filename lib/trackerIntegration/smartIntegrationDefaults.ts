/**
 * Эвристики «из коробки» для админки интеграции (при пустом сохранённом конфиге).
 * Полная серверная инициализация при сохранении токена — возможное следующее улучшение.
 */

export interface TrackerFieldRowLite {
  display?: string;
  id: string;
  key?: string;
  name?: string;
  options?: string[];
  schemaType?: string;
}

export type PlannerPlatformKey = 'Back' | 'DevOps' | 'QA' | 'Web';

const PLATFORM_EXACT_ALIASES: Array<{ aliases: string[]; platform: PlannerPlatformKey }> = [
  {
    platform: 'Web',
    aliases: ['web', 'frontend', 'фронт', 'фронтенд', 'фронтэнд'],
  },
  {
    platform: 'Back',
    aliases: ['back', 'backend', 'бэк', 'бэкенд', 'бекенд', 'бек'],
  },
  {
    platform: 'QA',
    aliases: [
      'qa',
      'ква',
      'тест',
      'тестирование',
      'quality',
      'quality assurance',
      'qualityassurance',
    ],
  },
  {
    platform: 'DevOps',
    aliases: ['devops', 'девопс', 'mobile', 'мобильная', 'мобильный', 'мобилка', 'ios', 'android'],
  },
];

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Поле «функциональная команда» / functional team (по key или названию). */
export function findFunctionalTeamFieldId(rows: TrackerFieldRowLite[]): string {
  for (const r of rows) {
    const key = (r.key ?? '').trim().toLowerCase().replace(/_/g, '');
    if (key === 'functionalteam' || key === 'functionalteams') {
      return r.id;
    }
    const blob = norm([r.display, r.name, r.key].filter(Boolean).join(' '));
    if (!blob) {
      continue;
    }
    if (blob.includes('функциональн') && blob.includes('команд')) {
      return r.id;
    }
    if (blob.includes('functional') && blob.includes('team')) {
      return r.id;
    }
  }
  return '';
}

/**
 * Сопоставление значения enum поля платформы с колонкой планера — только полное совпадение
 * строки (после нормализации пробелов и регистра) с одним из алиасов.
 */
export function matchPlannerPlatformByExactName(value: string): PlannerPlatformKey | null {
  const n = norm(value);
  if (!n) {
    return null;
  }
  for (const { aliases, platform } of PLATFORM_EXACT_ALIASES) {
    if (aliases.some((a) => norm(a) === n)) {
      return platform;
    }
  }
  return null;
}

export function buildAutoPlatformValueMap(
  trackerValues: string[]
): Array<{ platform: PlannerPlatformKey; trackerValue: string }> {
  const out: Array<{ platform: PlannerPlatformKey; trackerValue: string }> = [];
  for (const raw of trackerValues) {
    const trackerValue = raw.trim();
    if (!trackerValue) {
      continue;
    }
    const platform = matchPlannerPlatformByExactName(trackerValue);
    if (!platform) {
      continue;
    }
    if (out.some((r) => r.trackerValue === trackerValue)) {
      continue;
    }
    out.push({ platform, trackerValue });
  }
  return out;
}

/**
 * Значение enum поля «платформа/функциональная команда», соответствующее колонке QA в планере:
 * сначала явный мапинг, иначе первое значение списка с полным совпадением по алиасу QA.
 */
export function pickQaTrackerValueForConditions(
  valueMap: Array<{ platform: PlannerPlatformKey; trackerValue: string }>,
  enumValues: string[]
): string {
  const fromMap = valueMap.find((r) => r.platform === 'QA')?.trackerValue?.trim();
  if (fromMap) {
    return fromMap;
  }
  for (const v of enumValues) {
    const t = v.trim();
    if (!t) {
      continue;
    }
    if (matchPlannerPlatformByExactName(t) === 'QA') {
      return t;
    }
  }
  return '';
}

/** Доп. правила «только тестирование» для встроенного флоу при пустом сохранённом конфиге. */
export function buildEmbeddedTestingOnlyAutoExtraRules(input: {
  functionalTeamFieldId: string;
  qaEnumValue: string;
  testPointsFieldId: string;
}): Array<{ fieldId: string; operator: 'eq' | 'gt'; value: string }> {
  const rules: Array<{ fieldId: string; operator: 'eq' | 'gt'; value: string }> = [];
  const tp = input.testPointsFieldId.trim();
  if (tp) {
    rules.push({ fieldId: tp, operator: 'gt', value: '0' });
  }
  const ft = input.functionalTeamFieldId.trim();
  const qa = input.qaEnumValue.trim();
  if (ft && qa) {
    rules.push({ fieldId: ft, operator: 'eq', value: qa });
  }
  return rules;
}

export function embeddedTestingOnlyJoinsForRuleCount(n: number): Array<'and' | 'or'> {
  if (n <= 1) {
    return [];
  }
  return Array.from({ length: n - 1 }, () => 'and' as const);
}
