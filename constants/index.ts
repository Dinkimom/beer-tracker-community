export const WORKING_DAYS = 10;
/** Рабочих дней в одной календарной неделе сетки спринта (при двухнедельном спринте = WORKING_DAYS / 2) */
export const WORKING_DAYS_PER_WEEK = 5;
export const PARTS_PER_DAY = 3;

// OAuth Client ID для Yandex Tracker
// Это приложение уже настроено с scopes: tracker:read и tracker:write
export const YANDEX_OAUTH_CLIENT_ID = '363c6187195646f8b0607881832a151e';

// Ширина колонки участников (аватар + имя без обрезки)
export const DEVELOPER_COLUMN_WIDTH = 272;
// Ширина двух колонок участников (для расчета ширины контента в режиме full)
export const TEAM_COLORS: Record<string, string> = {
  Back: 'bg-emerald-100 dark:bg-emerald-900/40',
  Web: 'bg-sky-100 dark:bg-sky-900/40',
  QA: 'bg-amber-100 dark:bg-amber-900/40',
  DevOps: 'bg-violet-100 dark:bg-violet-900/40',
};

export const TEAM_BORDER_COLORS: Record<string, string> = {
  Back: 'border-emerald-300 dark:border-emerald-700',
  Web: 'border-sky-300 dark:border-sky-700',
  QA: 'border-amber-300 dark:border-amber-700',
  DevOps: 'border-violet-300 dark:border-violet-700',
};

export const TEAM_TEXT_COLORS: Record<string, string> = {
  Back: 'text-emerald-900 dark:text-emerald-100',
  Web: 'text-sky-900 dark:text-sky-100',
  QA: 'text-amber-900 dark:text-amber-100',
  DevOps: 'text-violet-900 dark:text-violet-100',
};

export const TEAM_SIDEBAR_COLORS: Record<string, string> = {
  Back: 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-900 dark:text-emerald-100',
  Web: 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700 text-sky-900 dark:text-sky-100',
  QA: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700 text-amber-900 dark:text-amber-100',
  DevOps: 'bg-violet-50 dark:bg-violet-900/30 border-violet-200 dark:border-violet-700 text-violet-900 dark:text-violet-100',
};

export const CARD_MARGIN = 8; // 8px с каждой стороны

export { ZIndex, type ZIndexLevel } from './zIndex';
