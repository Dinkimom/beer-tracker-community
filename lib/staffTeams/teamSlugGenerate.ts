/**
 * Slug команды из названия (чистая функция — безопасно для клиента).
 */

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterateChar(ch: string): string {
  const lower = ch.toLowerCase();
  const mapped = CYRILLIC_TO_LATIN[lower];
  if (mapped !== undefined) {
    return mapped;
  }
  return ch;
}

/**
 * Латиница, цифры и дефисы из произвольного названия (для slug в БД).
 */
export function generateTeamSlugFromTitle(title: string): string {
  const raw = title.trim();
  if (!raw) {
    return 'team';
  }
  let acc = '';
  for (const ch of raw) {
    if (/[a-z0-9]/i.test(ch)) {
      acc += ch.toLowerCase();
      continue;
    }
    if (CYRILLIC_TO_LATIN[ch.toLowerCase()] !== undefined || /[а-яё]/i.test(ch)) {
      acc += transliterateChar(ch);
      continue;
    }
    if (ch === '_' || ch === '-' || /\s/.test(ch)) {
      acc += '-';
    }
  }
  const collapsed = acc
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120);
  return collapsed || 'team';
}
