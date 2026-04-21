/**
 * Генерация slug из произвольной строки: кириллица → латиница, kebab-case, [a-z0-9-].
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

/**
 * Транслитерация + нормализация в slug для org_roles (без подчёркиваний; только a-z, цифры, дефис).
 */
export function toSlug(input: string): string {
  const lower = input.trim().toLowerCase();
  let out = '';
  for (const ch of lower) {
    if (/[a-z0-9]/.test(ch)) {
      out += ch;
    } else {
      const mapped = CYRILLIC_TO_LATIN[ch];
      if (mapped !== undefined) {
        out += mapped;
      } else if (ch === '_' || ch === '-' || ch === ' ' || ch === '.') {
        out += '-';
      } else if (/\s/.test(ch)) {
        out += '-';
      } else {
        out += '-';
      }
    }
  }
  return out
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
