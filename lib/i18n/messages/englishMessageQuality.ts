/**
 * Optional stricter checks for English message leaves (empty strings, obvious placeholders).
 * Used by `pnpm check:i18n` and Vitest; allowlists live in `scripts/i18n/english-quality-allowlist.json`.
 */

import { flattenMessagesToDotMap } from './messageTree';

export type EnglishQualityIssueKind = 'empty' | 'placeholder';

export type EnglishQualityIssue = {
  detail: string;
  key: string;
  kind: EnglishQualityIssueKind;
};

/** Detects common unfinished-translation markers at the start of a leaf string. */
function looksLikePlaceholderLeaf(trimmed: string): boolean {
  const markerTodo = 'TO' + 'DO';
  const markerTbd = 'TBD';
  const markerFixme = 'FIX' + 'ME';
  const exact = new RegExp(`^(${markerTodo}|${markerTbd}|${markerFixme})$`, 'i');
  if (exact.test(trimmed)) {
    return true;
  }
  // Token followed by punctuation or dash (incl. en/em dash)
  return new RegExp(`^(${markerTodo}|${markerTbd}|${markerFixme})\\s*[:.\\-\\u2013\\u2014]`, 'i').test(trimmed);
}

export function analyzeEnglishLeafQuality(
  enMessagesRoot: unknown,
  options?: {
    allowEmptyKeys?: Set<string>;
    allowPlaceholderKeys?: Set<string>;
  }
): EnglishQualityIssue[] {
  const allowEmpty = options?.allowEmptyKeys ?? new Set<string>();
  const allowPlaceholder = options?.allowPlaceholderKeys ?? new Set<string>();
  const flat = flattenMessagesToDotMap(enMessagesRoot);
  const issues: EnglishQualityIssue[] = [];

  for (const key of Object.keys(flat).sort()) {
    const raw = flat[key];
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
      if (!allowEmpty.has(key)) {
        issues.push({ key, kind: 'empty', detail: 'empty or whitespace-only English string' });
      }
      continue;
    }

    if (!allowPlaceholder.has(key) && looksLikePlaceholderLeaf(trimmed)) {
      issues.push({
        key,
        kind: 'placeholder',
        detail: `suspected placeholder: ${JSON.stringify(trimmed.slice(0, 80))}`,
      });
    }
  }

  return issues;
}
