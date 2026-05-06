/**
 * Иерархия z-index по слоям (снизу вверх).
 * Импорт: `import { ZIndex } from '@/constants'`
 * - style: `style={{ zIndex: ZIndex.modal }}`
 * - className: `className={ZIndex.class('modal')}` → `z-[2001]`
 *
 * Слои:
 * 0–9     — базовый контент (стрелки под карточками, слои задач)
 * 10–39   — липкие элементы в контенте, стрелки при hover
 * 40–69   — chrome: колонки, шапка
 * 100–199 — дропдауны, поповеры (контент выше backdrop)
 * 200–299 — плавающие контролы
 * 1000+   — глобальные оверлеи: тултипы, загрузка, drag, меню, модалки
 */
const levels = {
  base: 0,
  contentOverlay: 1,
  contentInteractive: 2,
  /** Бейзлайн поверх полос фаз, чтобы был виден при перетаскивании */
  baselineOverBar: 3,
  stickyInContent: 10,
  stickyElevated: 20,
  arrowsHovered: 30,
  /** Стрелки быстрого скролла к фазе строки: выше контента фазы; ниже sticky-строк эпика/стори (tbody z-30), chrome */
  rowScrollArrow: 9,
  sidebarResize: 40,
  stickyLeftColumn: 50,
  stickyMainHeader: 60,
  dropdown: 100,
  dropdownContent: 110,
  dropdownNested: 120,
  floatingControls: 200,
  tooltip: 1000,
  dragPreview: 1200,
  contextMenu: 1300,
  submenu: 1310,
  popupContent: 1320,
  modalBackdrop: 2000,
  modal: 2001,
  /** Поверх обычной модалки (второй уровень: форма внутри модалки). */
  modalNestedBackdrop: 2010,
  modalNested: 2011,
  overlay: 3000,
} as const;

export type ZIndexLevel = keyof typeof levels;

export const ZIndex = {
  ...levels,
  /** Класс Tailwind для z-index. В className: `ZIndex.class('modal')` → `z-[2001]` */
  class: (level: ZIndexLevel): string => `z-[${levels[level]}]`,
  /** Числовое значение z-index (для inline-style — чтобы не зависеть от Tailwind генерации). */
  value: (level: ZIndexLevel): number => levels[level],
};
