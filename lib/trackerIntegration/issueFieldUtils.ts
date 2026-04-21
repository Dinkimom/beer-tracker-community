/**
 * Чтение значений полей из payload задачи трекера (в т.ч. кастомные ключи).
 */

import type { TrackerIssue } from '@/types/tracker';

function asNumber(v: unknown): number | undefined {
  if (typeof v === 'number' && !Number.isNaN(v)) {
    return v;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

function toSnakeCaseFieldId(fieldId: string): string {
  return fieldId.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function readRawFieldValue(issue: TrackerIssue, fieldId: string | undefined): unknown {
  if (!fieldId) {
    return undefined;
  }
  const rec = issue as unknown as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(rec, fieldId)) {
    return rec[fieldId];
  }
  const snake = toSnakeCaseFieldId(fieldId);
  if (snake !== fieldId && Object.prototype.hasOwnProperty.call(rec, snake)) {
    return rec[snake];
  }
  return undefined;
}

/**
 * Возвращает числовую оценку по идентификатору поля (встроенные storyPoints/testPoints или произвольный ключ на issue).
 */
export function readNumericEstimateFromIssue(
  issue: TrackerIssue,
  fieldId: string | undefined
): number | undefined {
  if (!fieldId) {
    return undefined;
  }
  if (fieldId === 'storyPoints') {
    return issue.storyPoints ?? undefined;
  }
  if (fieldId === 'testPoints') {
    return issue.testPoints ?? undefined;
  }
  const direct = asNumber(readRawFieldValue(issue, fieldId));
  if (direct !== undefined) {
    return direct;
  }
  return undefined;
}

/**
 * Строковое поле со ссылкой (MR и т.п.): строка или объект со self/href/url.
 */
export function readMergeRequestLinkFromIssue(
  issue: TrackerIssue,
  fieldId: string | undefined
): string {
  if (!fieldId?.trim()) {
    return '';
  }
  const v = readRawFieldValue(issue, fieldId);
  if (typeof v === 'string') {
    return v.trim();
  }
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as { href?: string; self?: string; url?: string };
    for (const k of ['self', 'href', 'url'] as const) {
      const s = o[k];
      if (typeof s === 'string' && s.trim()) {
        return s.trim();
      }
    }
  }
  return '';
}

export function readStringTokenFromIssue(issue: TrackerIssue, fieldId: string | undefined): string {
  if (!fieldId) {
    return '';
  }
  if (fieldId === 'functionalTeam') {
    return (issue.functionalTeam ?? '').trim();
  }
  const v = readRawFieldValue(issue, fieldId);
  if (v == null) {
    return '';
  }
  if (typeof v === 'string') {
    return v.trim();
  }
  if (typeof v === 'object' && v !== null && 'key' in v) {
    const k = (v as { key?: string }).key;
    return typeof k === 'string' ? k.trim() : '';
  }
  if (typeof v === 'object' && v !== null && 'display' in v) {
    const d = (v as { display?: string }).display;
    return typeof d === 'string' ? d.trim() : '';
  }
  return String(v).trim();
}

/**
 * Возвращает все возможные строковые представления поля.
 * Нужно для надёжного сравнения eq в правилах (key/display/id/строка).
 */
export function readStringTokensFromIssue(issue: TrackerIssue, fieldId: string | undefined): string[] {
  const one = readStringTokenFromIssue(issue, fieldId).trim();
  const out = one ? [one] : [];
  if (!fieldId) {
    return out;
  }
  const raw = readRawFieldValue(issue, fieldId);
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') {
        const t = item.trim();
        if (t && !out.includes(t)) {
          out.push(t);
        }
        continue;
      }
      if (item && typeof item === 'object') {
        const obj = item as { display?: string; id?: string; key?: string };
        for (const s of [obj.key, obj.display, obj.id]) {
          const t = typeof s === 'string' ? s.trim() : '';
          if (t && !out.includes(t)) {
            out.push(t);
          }
        }
      }
    }
    return out;
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as { display?: string; id?: string; key?: string };
    for (const s of [obj.key, obj.display, obj.id]) {
      const t = typeof s === 'string' ? s.trim() : '';
      if (t && !out.includes(t)) {
        out.push(t);
      }
    }
  }
  return out;
}

export interface TrackerUserRef {
  display: string;
  id: string;
}

/** Читает пользовательское поле (assignee-подобное) с issue. */
export function readUserRefFromIssue(
  issue: TrackerIssue,
  fieldId: string | undefined
): TrackerUserRef | undefined {
  if (!fieldId) {
    return undefined;
  }
  if (fieldId === 'qaEngineer') {
    const q = issue.qaEngineer;
    if (q?.id) {
      return { display: q.display ?? q.id, id: q.id };
    }
    return undefined;
  }
  const rec = issue as unknown as Record<string, unknown>;
  const v = rec[fieldId];
  if (v && typeof v === 'object' && 'id' in v) {
    const u = v as { display?: string; id?: string };
    if (u.id) {
      return { display: u.display ?? u.id, id: u.id };
    }
  }
  return undefined;
}

/** Нормализованные теги: строки для сопоставления с valueMap. */
export function readIssueTagTokens(issue: TrackerIssue): string[] {
  const rec = issue as unknown as Record<string, unknown>;
  const tags = rec.tags;
  if (!Array.isArray(tags)) {
    return [];
  }
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t === 'string') {
      const s = t.trim().toLowerCase();
      if (s) {
        out.push(s);
      }
    } else if (t && typeof t === 'object') {
      const o = t as { display?: string; id?: string; key?: string };
      const s = (o.key ?? o.id ?? o.display ?? '').trim().toLowerCase();
      if (s) {
        out.push(s);
      }
    }
  }
  return out;
}
