/**
 * Единая система цветов для статусов задач
 * Используется во всех компонентах для консистентности
 */

import type { PlanningPhaseCardColorScheme } from '@/hooks/useLocalStorage';

export interface StatusColorGroup {
  arrow: { default: string; hover: string };
  bg: string;
  // Темные варианты
  bgDark?: string;
  border: string;
  borderDark?: string;
  highlight: { bg: string; border: string };
  highlightDark?: { bg: string; border: string };
  previewBorder: string;
  qaStriped?: { base: string; stripe: string };
  qaStripedDark?: { base: string; stripe: string };
  resizeHandle: { bg: string; line: string };
  resizeHandleDark?: { bg: string; line: string };
  sidebar: string;
  sidebarDark?: string;
  tagBg: string;
  tagBgDark?: string;
  text: string;
  textDark?: string;
}

const STATUS_COLOR_MAP: Record<string, StatusColorGroup> = {
  // Серые статусы
  backlog: {
    bg: 'bg-gray-100',
    border: 'border-gray-300 border-dashed',
    text: 'text-gray-900',
    sidebar: 'bg-gray-50 border-gray-200 border-dashed text-gray-900',
    tagBg: 'bg-gray-500',
    tagBgDark: 'dark:bg-gray-600',
    arrow: { default: '#6b7280', hover: '#4b5563' },
    highlight: { bg: 'bg-gray-100/80', border: 'border-gray-300/50' },
    resizeHandle: { bg: 'bg-gray-200/60', line: 'bg-gray-600' },
    resizeHandleDark: { bg: 'dark:bg-gray-600/60', line: 'dark:bg-gray-400' },
    previewBorder: 'border-gray-500 border-dashed',
    qaStriped: { base: 'rgb(249, 250, 251)', stripe: 'rgb(243, 244, 246)' },
    qaStripedDark: { base: 'rgb(55, 65, 81)', stripe: 'rgb(60, 70, 85)' },
    bgDark: 'dark:bg-gray-700',
  highlightDark: { bg: 'dark:bg-gray-700', border: 'dark:border-gray-600/50' },
    borderDark: 'dark:border-gray-600',
    textDark: 'dark:text-gray-100',
    sidebarDark: 'dark:bg-gray-700 dark:border-gray-600 border-dashed dark:text-gray-100',
  },
  readyfordevelopment: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-900',
    sidebar: 'bg-gray-50 border-gray-200 text-gray-900',
    tagBg: 'bg-gray-500',
    tagBgDark: 'dark:bg-gray-600',
    arrow: { default: '#6b7280', hover: '#4b5563' },
    highlight: { bg: 'bg-gray-100/80', border: 'border-gray-300/50' },
    resizeHandle: { bg: 'bg-gray-200/60', line: 'bg-gray-600' },
    resizeHandleDark: { bg: 'dark:bg-gray-600/60', line: 'dark:bg-gray-400' },
    previewBorder: 'border-gray-500',
    qaStriped: { base: 'rgb(249, 250, 251)', stripe: 'rgb(243, 244, 246)' },
    bgDark: 'dark:bg-gray-700',
  highlightDark: { bg: 'dark:bg-gray-700', border: 'dark:border-gray-600/50' },
    borderDark: 'dark:border-gray-600',
    textDark: 'dark:text-gray-100',
    sidebarDark: 'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100',
    qaStripedDark: { base: 'rgb(55, 65, 81)', stripe: 'rgb(60, 70, 85)' },
  },
  transferredtodevelopment: {
    bg: 'bg-gray-100',
    border: 'border-gray-300',
    text: 'text-gray-900',
    sidebar: 'bg-gray-50 border-gray-200 text-gray-900',
    tagBg: 'bg-gray-500',
    tagBgDark: 'dark:bg-gray-600',
    arrow: { default: '#6b7280', hover: '#4b5563' },
    highlight: { bg: 'bg-gray-100/80', border: 'border-gray-300/50' },
    resizeHandle: { bg: 'bg-gray-200/60', line: 'bg-gray-600' },
    resizeHandleDark: { bg: 'dark:bg-gray-600/60', line: 'dark:bg-gray-400' },
    previewBorder: 'border-gray-500',
    qaStriped: { base: 'rgb(249, 250, 251)', stripe: 'rgb(243, 244, 246)' },
    bgDark: 'dark:bg-gray-700',
  highlightDark: { bg: 'dark:bg-gray-700', border: 'dark:border-gray-600/50' },
    borderDark: 'dark:border-gray-600',
    textDark: 'dark:text-gray-100',
    sidebarDark: 'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100',
    qaStripedDark: { base: 'rgb(55, 65, 81)', stripe: 'rgb(60, 70, 85)' },
  },

  // Синие статусы (в тёмной теме обводка blue-500, чтобы полосы не терялись на фоне)
  inprogress: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-900',
    sidebar: 'bg-blue-50 border-blue-200 text-blue-900',
    tagBg: 'bg-blue-500',
    tagBgDark: 'dark:bg-blue-600',
    arrow: { default: '#3b82f6', hover: '#2563eb' },
    highlight: { bg: 'bg-blue-100/80', border: 'border-blue-300/50' },
    resizeHandle: { bg: 'bg-blue-200/60', line: 'bg-blue-600' },
    resizeHandleDark: { bg: 'dark:bg-blue-700/60', line: 'dark:bg-blue-400' },
    previewBorder: 'border-blue-500',
    qaStriped: { base: 'rgb(239, 246, 255)', stripe: 'rgb(229, 240, 254)' },
    bgDark: 'dark:bg-blue-900',
    borderDark: 'dark:border-blue-500',
    highlightDark: { bg: 'dark:bg-blue-900/40', border: 'dark:border-blue-500/80' },
    textDark: 'dark:text-blue-100',
    sidebarDark: 'dark:bg-blue-900/30 dark:border-blue-500 dark:text-blue-100',
    qaStripedDark: { base: 'rgb(30, 58, 138)', stripe: 'rgb(35, 63, 145)' },
  },

  // Розовые статусы
  review: {
    bg: 'bg-pink-100',
    border: 'border-pink-300',
    text: 'text-pink-900',
    sidebar: 'bg-pink-50 border-pink-200 text-pink-900',
    tagBg: 'bg-pink-500',
    tagBgDark: 'dark:bg-pink-600',
    arrow: { default: '#ec4899', hover: '#db2777' },
    highlight: { bg: 'bg-pink-100/80', border: 'border-pink-300/50' },
    resizeHandle: { bg: 'bg-pink-200/60', line: 'bg-pink-600' },
    resizeHandleDark: { bg: 'dark:bg-pink-700/60', line: 'dark:bg-pink-400' },
    previewBorder: 'border-pink-500',
    qaStriped: { base: 'rgb(253, 244, 251)', stripe: 'rgb(252, 237, 248)' },
    bgDark: 'dark:bg-pink-900',
  highlightDark: { bg: 'dark:bg-pink-900/40', border: 'dark:border-pink-700/50' },
    borderDark: 'dark:border-pink-700',
    textDark: 'dark:text-pink-100',
    sidebarDark: 'dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-100',
    qaStripedDark: { base: 'rgb(131, 24, 67)', stripe: 'rgb(140, 28, 72)' },
  },
  inreview: {
    bg: 'bg-pink-100',
    border: 'border-pink-300',
    text: 'text-pink-900',
    sidebar: 'bg-pink-50 border-pink-200 text-pink-900',
    tagBg: 'bg-pink-500',
    tagBgDark: 'dark:bg-pink-600',
    arrow: { default: '#ec4899', hover: '#db2777' },
    highlight: { bg: 'bg-pink-100/80', border: 'border-pink-300/50' },
    resizeHandle: { bg: 'bg-pink-200/60', line: 'bg-pink-600' },
    resizeHandleDark: { bg: 'dark:bg-pink-700/60', line: 'dark:bg-pink-400' },
    previewBorder: 'border-pink-500',
    qaStriped: { base: 'rgb(253, 244, 251)', stripe: 'rgb(252, 237, 248)' },
    bgDark: 'dark:bg-pink-900',
  highlightDark: { bg: 'dark:bg-pink-900/40', border: 'dark:border-pink-700/50' },
    borderDark: 'dark:border-pink-700',
    textDark: 'dark:text-pink-100',
    sidebarDark: 'dark:bg-pink-900/30 dark:border-pink-700 dark:text-pink-100',
    qaStripedDark: { base: 'rgb(131, 24, 67)', stripe: 'rgb(140, 28, 72)' },
  },

  // Красные статусы
  defect: {
    bg: 'bg-red-100',
    border: 'border-red-300',
    text: 'text-red-900',
    sidebar: 'bg-red-50 border-red-200 text-red-900',
    tagBg: 'bg-red-500',
    tagBgDark: 'dark:bg-red-600',
    arrow: { default: '#ef4444', hover: '#dc2626' },
    highlight: { bg: 'bg-red-100/80', border: 'border-red-300/50' },
    resizeHandle: { bg: 'bg-red-200/60', line: 'bg-red-600' },
    resizeHandleDark: { bg: 'dark:bg-red-700/60', line: 'dark:bg-red-400' },
    previewBorder: 'border-red-500',
    qaStriped: { base: 'rgb(254, 242, 242)', stripe: 'rgb(254, 232, 232)' },
    bgDark: 'dark:bg-red-900',
  highlightDark: { bg: 'dark:bg-red-900/40', border: 'dark:border-red-700/50' },
    borderDark: 'dark:border-red-700',
    textDark: 'dark:text-red-100',
    sidebarDark: 'dark:bg-red-900/30 dark:border-red-700 dark:text-red-100',
    qaStripedDark: { base: 'rgb(127, 29, 29)', stripe: 'rgb(135, 32, 32)' },
  },
  blocked: {
    bg: 'bg-red-100',
    border: 'border-red-300',
    text: 'text-red-900',
    sidebar: 'bg-red-50 border-red-200 text-red-900',
    tagBg: 'bg-red-500',
    tagBgDark: 'dark:bg-red-600',
    arrow: { default: '#ef4444', hover: '#dc2626' },
    highlight: { bg: 'bg-red-100/80', border: 'border-red-300/50' },
    resizeHandle: { bg: 'bg-red-200/60', line: 'bg-red-600' },
    resizeHandleDark: { bg: 'dark:bg-red-700/60', line: 'dark:bg-red-400' },
    previewBorder: 'border-red-500',
    qaStriped: { base: 'rgb(254, 242, 242)', stripe: 'rgb(254, 232, 232)' },
    bgDark: 'dark:bg-red-900',
  highlightDark: { bg: 'dark:bg-red-900/40', border: 'dark:border-red-700/50' },
    borderDark: 'dark:border-red-700',
    textDark: 'dark:text-red-100',
    sidebarDark: 'dark:bg-red-900/30 dark:border-red-700 dark:text-red-100',
    qaStripedDark: { base: 'rgb(127, 29, 29)', stripe: 'rgb(135, 32, 32)' },
  },

  // Оранжевые статусы
  readyfortest: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-900',
    sidebar: 'bg-orange-50 border-orange-200 text-orange-900',
    tagBg: 'bg-orange-500',
    tagBgDark: 'dark:bg-orange-600',
    arrow: { default: '#f97316', hover: '#ea580c' },
    highlight: { bg: 'bg-orange-100/80', border: 'border-orange-300/50' },
    resizeHandle: { bg: 'bg-orange-200/60', line: 'bg-orange-600' },
    resizeHandleDark: { bg: 'dark:bg-orange-700/60', line: 'dark:bg-orange-400' },
    previewBorder: 'border-orange-500',
    // Светлая тема: непрозрачные полосы (orange-50 / orange-100)
    qaStriped: { base: 'rgb(255, 247, 237)', stripe: 'rgb(255, 237, 213)' },
    bgDark: 'dark:bg-orange-900',
  highlightDark: { bg: 'dark:bg-orange-900/40', border: 'dark:border-orange-700/50' },
    borderDark: 'dark:border-orange-700',
    textDark: 'dark:text-orange-100',
    sidebarDark: 'dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-100',
    qaStripedDark: { base: 'rgb(154, 52, 18)', stripe: 'rgb(170, 58, 20)' },
  },
  readyfortesting: {
    bg: 'bg-orange-100',
    border: 'border-orange-300',
    text: 'text-orange-900',
    sidebar: 'bg-orange-50 border-orange-200 text-orange-900',
    tagBg: 'bg-orange-500',
    tagBgDark: 'dark:bg-orange-600',
    arrow: { default: '#f97316', hover: '#ea580c' },
    highlight: { bg: 'bg-orange-100/80', border: 'border-orange-300/50' },
    resizeHandle: { bg: 'bg-orange-200/60', line: 'bg-orange-600' },
    resizeHandleDark: { bg: 'dark:bg-orange-700/60', line: 'dark:bg-orange-400' },
    previewBorder: 'border-orange-500',
    qaStriped: { base: 'rgb(255, 247, 237)', stripe: 'rgb(255, 237, 213)' },
    bgDark: 'dark:bg-orange-900',
  highlightDark: { bg: 'dark:bg-orange-900/40', border: 'dark:border-orange-700/50' },
    borderDark: 'dark:border-orange-700',
    textDark: 'dark:text-orange-100',
    sidebarDark: 'dark:bg-orange-900/30 dark:border-orange-700 dark:text-orange-100',
    qaStripedDark: { base: 'rgb(154, 52, 18)', stripe: 'rgb(170, 58, 20)' },
  },

  // Жёлтый статус — в тестировании (отдельно от оранжевого «готово к тесту»)
  intesting: {
    bg: 'bg-yellow-100',
    border: 'border-yellow-300',
    text: 'text-yellow-900',
    sidebar: 'bg-yellow-50 border-yellow-200 text-yellow-900',
    tagBg: 'bg-yellow-500',
    tagBgDark: 'dark:bg-yellow-600',
    arrow: { default: '#eab308', hover: '#ca8a04' },
    highlight: { bg: 'bg-yellow-100/80', border: 'border-yellow-300/50' },
    resizeHandle: { bg: 'bg-yellow-200/60', line: 'bg-yellow-600' },
    resizeHandleDark: { bg: 'dark:bg-yellow-700/60', line: 'dark:bg-yellow-400' },
    previewBorder: 'border-yellow-500',
    // Светлая тема: без низкой альфы (иначе полоски почти не видны на фоне карточки)
    qaStriped: { base: 'rgb(255, 251, 235)', stripe: 'rgb(254, 243, 199)' },
    bgDark: 'dark:bg-yellow-900',
    highlightDark: { bg: 'dark:bg-yellow-900/40', border: 'dark:border-yellow-600/50' },
    borderDark: 'dark:border-yellow-600',
    textDark: 'dark:text-yellow-100',
    sidebarDark: 'dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-100',
    qaStripedDark: { base: 'rgb(113, 63, 18)', stripe: 'rgb(133, 77, 14)' },
  },

  // Фиолетовый статус (RC - Release Candidate)
  rc: {
    bg: 'bg-violet-100',
    border: 'border-violet-300',
    text: 'text-violet-900',
    sidebar: 'bg-violet-50 border-violet-200 text-violet-900',
    tagBg: 'bg-violet-500',
    tagBgDark: 'dark:bg-violet-600',
    arrow: { default: '#8b5cf6', hover: '#7c3aed' },
    highlight: { bg: 'bg-violet-100/80', border: 'border-violet-300/50' },
    resizeHandle: { bg: 'bg-violet-200/60', line: 'bg-violet-600' },
    resizeHandleDark: { bg: 'dark:bg-violet-700/60', line: 'dark:bg-violet-400' },
    previewBorder: 'border-violet-500',
    qaStriped: { base: 'rgb(245, 243, 255)', stripe: 'rgb(237, 233, 254)' },
    bgDark: 'dark:bg-violet-900',
  highlightDark: { bg: 'dark:bg-violet-900/40', border: 'dark:border-violet-700/50' },
    borderDark: 'dark:border-violet-700',
    textDark: 'dark:text-violet-100',
    sidebarDark:
      'dark:bg-violet-950/30 dark:border-violet-800/55 dark:text-violet-100',
    qaStripedDark: { base: 'rgb(76, 29, 149)', stripe: 'rgb(82, 33, 160)' },
  },

  // Зеленые статусы
  closed: {
    bg: 'bg-green-100',
    border: 'border-green-300',
    text: 'text-green-900',
    sidebar: 'bg-green-50 border-green-200 text-green-900',
    tagBg: 'bg-green-500',
    tagBgDark: 'dark:bg-green-600',
    arrow: { default: '#22c55e', hover: '#16a34a' },
    highlight: { bg: 'bg-green-100/80', border: 'border-green-300/50' },
    resizeHandle: { bg: 'bg-green-200/60', line: 'bg-green-600' },
    resizeHandleDark: { bg: 'dark:bg-green-700/60', line: 'dark:bg-green-400' },
    previewBorder: 'border-green-500',
    qaStriped: { base: 'rgb(240, 253, 244)', stripe: 'rgb(220, 252, 231)' },
    bgDark: 'dark:bg-green-900',
  highlightDark: { bg: 'dark:bg-green-900/40', border: 'dark:border-green-700/50' },
    borderDark: 'dark:border-green-700',
    textDark: 'dark:text-green-100',
    sidebarDark: 'dark:bg-green-900/30 dark:border-green-700 dark:text-green-100',
    qaStripedDark: { base: 'rgb(20, 83, 45)', stripe: 'rgb(24, 90, 48)' },
  },
};

/** Классы фона разделителя «оценка/доп» — те же цвета, что граница. Явные строки, чтобы Tailwind не выкидывал классы. */
const PHASE_DIVIDER_CLASSES: Record<string, string> = {
  backlog: 'bg-gray-300 dark:bg-gray-600',
  readyfordevelopment: 'bg-gray-300 dark:bg-gray-600',
  transferredtodevelopment: 'bg-gray-300 dark:bg-gray-600',
  readyfordesignreview: 'bg-fuchsia-300 dark:bg-fuchsia-700',
  indesignreview: 'bg-fuchsia-300 dark:bg-fuchsia-700',
  inprogress: 'bg-blue-300 dark:bg-blue-700',
  review: 'bg-pink-300 dark:bg-pink-700',
  inreview: 'bg-pink-300 dark:bg-pink-700',
  defect: 'bg-red-300 dark:bg-red-700',
  blocked: 'bg-red-300 dark:bg-red-700',
  readyfortest: 'bg-orange-300 dark:bg-orange-700',
  readyfortesting: 'bg-orange-300 dark:bg-orange-700',
  intesting: 'bg-yellow-300 dark:bg-yellow-700',
  rc: 'bg-violet-300 dark:bg-violet-700',
  closed: 'bg-green-300 dark:bg-green-700',
};

const DEFAULT_COLORS: StatusColorGroup = {
  bg: 'bg-gray-100',
  border: 'border-gray-300',
  text: 'text-gray-900',
  sidebar: 'bg-gray-50 border-gray-200 text-gray-900',
  tagBg: 'bg-gray-500',
  tagBgDark: 'dark:bg-gray-600',
  arrow: { default: '#6b7280', hover: '#4b5563' },
  highlight: { bg: 'bg-blue-100/80', border: 'border-blue-300/50' },
  highlightDark: { bg: 'dark:bg-blue-900/40', border: 'dark:border-blue-700/50' },
  resizeHandle: { bg: 'bg-gray-200/60', line: 'bg-gray-600' },
  resizeHandleDark: { bg: 'dark:bg-gray-600/60', line: 'dark:bg-gray-400' },
  previewBorder: 'border-gray-500',
  bgDark: 'dark:bg-gray-700',
  borderDark: 'dark:border-gray-600',
  textDark: 'dark:text-gray-100',
  sidebarDark: 'dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100',
};

/**
 * Получает цвета для статуса задачи
 */
/** Нормализует ключ статуса для поиска в мапе (как в Kanban: lowercase, без пробелов/подчёркиваний/дефисов). */
export function normalizeStatusKey(status: string): string {
  return (status || '').toLowerCase().replace(/[\s_-]/g, '').trim();
}

/** Ключ палитры: приоритет у override из интеграции (visualToken), иначе ключ статуса трекера. */
export function resolvePaletteStatusKey(
  originalStatus: string | undefined,
  paletteKeyOverride: string | undefined
): string | undefined {
  const o = paletteKeyOverride?.trim();
  if (o) {
    return o;
  }
  return originalStatus;
}

/** Статус для палитры карточки/фазы: при монохроме — как у бэклога */
export function resolveStatusForPhaseCardColors(
  scheme: PlanningPhaseCardColorScheme,
  originalStatus?: string,
  paletteKeyOverride?: string
): string | undefined {
  if (scheme === 'monochrome') {
    return 'backlog';
  }
  return resolvePaletteStatusKey(originalStatus, paletteKeyOverride);
}

/** Hex цвета стрелок связей (свимлейн, занятость): та же схема, что у карточек и фаз */
export function getPhaseLinkArrowDefaultHex(
  scheme: PlanningPhaseCardColorScheme,
  originalStatus?: string,
  paletteKeyOverride?: string
): string {
  const statusKey = resolveStatusForPhaseCardColors(scheme, originalStatus, paletteKeyOverride);
  return getStatusColors(statusKey).arrow.default;
}

/**
 * Монохром: граница как у бэклога (с пунктиром) только для статуса «Бэклог», иначе сплошная, те же оттенки.
 */
export function getMonochromeBorderParts(
  originalStatus?: string
): Pick<StatusColorGroup, 'border' | 'borderDark'> {
  const backlog = getStatusColors('backlog');
  const isBacklog =
    originalStatus != null &&
    originalStatus !== '' &&
    normalizeStatusKey(originalStatus) === 'backlog';
  if (isBacklog) {
    return { border: backlog.border, borderDark: backlog.borderDark };
  }
  const border = backlog.border.replace(/\bborder-dashed\b/g, '').trim();
  return { border, borderDark: backlog.borderDark };
}

/** Классы границы для карточки (swimlane/sidebar): border + borderDark одной строкой */
export function getMonochromeCardBorderClasses(originalStatus?: string): string {
  const { border, borderDark } = getMonochromeBorderParts(originalStatus);
  return [border, borderDark ?? ''].filter(Boolean).join(' ').trim();
}

export function getStatusColors(status?: string): StatusColorGroup {
  if (!status) return DEFAULT_COLORS;
  return STATUS_COLOR_MAP[normalizeStatusKey(status)] || DEFAULT_COLORS;
}

/**
 * Классы компактного превью «как карточка в свимлейне»: bg + border из той же схемы, что `getTaskCardStyles` (swimlane, status).
 */
export function getSwimlaneTaskCardChipClassNames(statusKey: string): string {
  const c = getStatusColors(statusKey?.trim());
  return [
    'inline-block h-5 w-9 shrink-0 rounded-lg border-2',
    c.bg,
    c.bgDark,
    c.border,
    c.borderDark,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ключи палитры для админки (маппинг visualToken → цвет карточки/фазы). */
export function listStatusPaletteKeys(): string[] {
  return Object.keys(STATUS_COLOR_MAP).sort((a, b) => a.localeCompare(b));
}

/**
 * Админка: один ключ на каждый уникальный вид чипа карточки (меньше дублей вроде двух «Серый»).
 */
export function listDistinctStatusPaletteKeys(): string[] {
  const keys = listStatusPaletteKeys();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    const sig = getSwimlaneTaskCardChipClassNames(k);
    if (seen.has(sig)) {
      continue;
    }
    seen.add(sig);
    out.push(k);
  }
  return out;
}

/** Канонический ключ палитры: тот же вид чипа → один сохранённый ключ (порядок как в listStatusPaletteKeys). */
export function canonicalPaletteKey(paletteKey: string): string {
  const raw = paletteKey.trim();
  if (!raw) {
    return '';
  }
  const k = normalizeStatusKey(raw);
  if (!(k in STATUS_COLOR_MAP)) {
    return raw;
  }
  const sig = getSwimlaneTaskCardChipClassNames(k);
  for (const c of listStatusPaletteKeys()) {
    if (getSwimlaneTaskCardChipClassNames(c) === sig) {
      return c;
    }
  }
  return k;
}

/**
 * Русское имя «семейства» цвета палитры (админка интеграции).
 */
const STATUS_PALETTE_COLOR_FAMILY_RU: Record<string, string> = {
  backlog: 'Белый',
  readyfordevelopment: 'Серый',
  transferredtodevelopment: 'Серый',
  inprogress: 'Синий',
  review: 'Розовый',
  inreview: 'Розовый',
  defect: 'Красный',
  blocked: 'Красный',
  readyfortest: 'Оранжевый',
  readyfortesting: 'Оранжевый',
  intesting: 'Жёлтый',
  rc: 'Фиолетовый',
  closed: 'Зелёный',
};

export function getStatusPaletteRuLabel(paletteKey: string): string {
  const raw = paletteKey.trim();
  if (!raw) {
    return '';
  }
  const k = normalizeStatusKey(raw);
  return STATUS_PALETTE_COLOR_FAMILY_RU[k] ?? 'Серый';
}

/**
 * Создает CSS стиль для полосатого паттерна QA задач
 * Возвращает светлую версию, темная версия применяется в компоненте TaskCard
 */
export function getQAStripedPattern(status?: string): React.CSSProperties | undefined {
  const colors = getStatusColors(status);
  // Неизвестный статус → DEFAULT без qaStriped; оранжевый readyfortest вводил в заблуждение (бейдж серый, фон «к тесту»).
  const basePattern = colors.qaStriped ?? getStatusColors('backlog').qaStriped;
  if (!basePattern) return undefined;

  return {
    backgroundImage: `repeating-linear-gradient(
      45deg,
      ${basePattern.base},
      ${basePattern.base} 10px,
      ${basePattern.stripe} 10px,
      ${basePattern.stripe} 20px
    )`,
  };
}

/**
 * Общий хелпер для получения полосатого стиля QA и базового цвета
 * с учётом темы (светлая/тёмная) и fallback статуса.
 */
export function getQaStripedStyles(
  status: string | undefined,
  isDark: boolean
): { style?: React.CSSProperties; baseColor?: string } {
  const colors = getStatusColors(status);

  // Для тёмной темы — qaStripedDark; без него нейтральный бэклог, не «готово к тесту» (оранжевый).
  const darkPattern = colors.qaStripedDark ?? getStatusColors('backlog').qaStripedDark;
  if (isDark && darkPattern) {
    return {
      style: {
        backgroundImage: `repeating-linear-gradient(
          45deg,
          ${darkPattern.base},
          ${darkPattern.base} 10px,
          ${darkPattern.stripe} 10px,
          ${darkPattern.stripe} 20px
        )`,
      },
      baseColor: darkPattern.base,
    };
  }

  // Для светлой темы используем getQAStripedPattern (он уже умеет fallback'иться)
  const lightStyle = getQAStripedPattern(status);
  const lightSource = colors.qaStriped ?? getStatusColors('backlog').qaStriped;

  return {
    style: lightStyle,
    baseColor: lightSource?.base,
  };
}

/**
 * Получает цвет для превью границы при расширении задачи
 * Для QA задач применяется маппинг статусов
 */
export function getPreviewBorderColor(status: string | undefined, isQATask: boolean): string {
  if (!status) return DEFAULT_COLORS.previewBorder;

  const normalizedStatus = status.toLowerCase();

  // Для QA задач некоторые статусы маппятся
  if (isQATask) {
    if (normalizedStatus === 'review' || normalizedStatus === 'inreview') {
      return getStatusColors('backlog').previewBorder;
    }
    // rc теперь имеет свой цвет (фиолетовый)
  }

  return getStatusColors(status).previewBorder;
}

/**
 * Получает цвета для resize handle (свимлейн, занятость).
 * `scheme === 'monochrome'` — как у бэклога; иначе по статусу и маппингу QA (review/inreview → бэклог).
 */
export function getResizeHandleColors(
  status: string | undefined,
  isQATask: boolean,
  scheme: PlanningPhaseCardColorScheme = 'status'
) {
  if (scheme === 'monochrome') {
    const statusColors = getStatusColors('backlog');
    return {
      bg: statusColors.resizeHandle.bg,
      bgDark: statusColors.resizeHandleDark?.bg || '',
      line: statusColors.resizeHandle.line,
      lineDark: statusColors.resizeHandleDark?.line || '',
    };
  }

  if (!status) {
    return {
      bg: DEFAULT_COLORS.resizeHandle.bg,
      bgDark: DEFAULT_COLORS.resizeHandleDark?.bg || '',
      line: DEFAULT_COLORS.resizeHandle.line,
      lineDark: DEFAULT_COLORS.resizeHandleDark?.line || '',
    };
  }

  const normalizedStatus = status.toLowerCase();
  let statusColors;

  // Для QA задач некоторые статусы маппятся
  if (isQATask) {
    if (normalizedStatus === 'review' || normalizedStatus === 'inreview') {
      statusColors = getStatusColors('backlog');
    } else {
      statusColors = getStatusColors(status);
    }
  } else {
    statusColors = getStatusColors(status);
  }

  return {
    bg: statusColors.resizeHandle.bg,
    bgDark: statusColors.resizeHandleDark?.bg || '',
    line: statusColors.resizeHandle.line,
    lineDark: statusColors.resizeHandleDark?.line || '',
  };
}

const DEFAULT_DIVIDER_CLASSES = 'bg-gray-300 dark:bg-gray-600';

/**
 * Классы фона для разделителя «оценка / доп» в фазе (тот же цвет, что граница по статусу).
 * Учитывает маппинг статусов для QA, как getResizeHandleColors.
 * Использует явный маппинг PHASE_DIVIDER_CLASSES, чтобы классы не выкидывались Tailwind.
 */
export function getPhaseDividerClasses(status?: string, isQa?: boolean): string {
  if (!status) return DEFAULT_DIVIDER_CLASSES;
  const normalized = normalizeStatusKey(status);
  let lookupKey: string;
  if (isQa && (normalized === 'review' || normalized === 'inreview')) {
    lookupKey = 'backlog';
  } else {
    lookupKey = normalized;
  }
  return PHASE_DIVIDER_CLASSES[lookupKey] ?? DEFAULT_DIVIDER_CLASSES;
}
