/** Centralised Tailwind class tokens for the admin panel UI. */

export const cardShell =
  'rounded-xl border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800';
export const cardHeader = 'border-b border-gray-200 px-4 py-3 sm:px-5 dark:border-gray-700';
export const cardBody = 'px-4 py-4 sm:px-5 sm:py-5';

/** Простой список в карточке (организации, команды): &lt;ul&gt; */
export const adminListShell =
  'divide-y divide-gray-200 overflow-hidden rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-600';

/** Общая «подложка» строки списка */
export const adminListRow =
  'bg-white px-3 py-2.5 dark:bg-gray-900/35';

/** Одна строка: слева контент, справа действия */
export const adminListRowLayoutSimple =
  'flex flex-wrap items-center justify-between gap-2';

/** Строка с развёрнутым блоком слева и панелью действий справа (команды) */
export const adminListRowLayoutGrid =
  'grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6';

/** Участник команды: основной блок + селект роли и действие */
export const adminListRowLayoutMember =
  'flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4';

/**
 * Табличная сетка состава команды: сотрудник | приглашение | роли (система + команда) | удалить.
 * Колонки фиксированы, чтобы строки не «ездили» при скрытии блока приглашения.
 */
export const adminTeamRosterGrid =
  'grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_13rem_minmax(18rem,28rem)_minmax(3.25rem,3.75rem)] sm:gap-x-5 sm:gap-y-0 sm:items-center';

/** Заголовок над списком состава (те же колонки, что у adminTeamRosterGrid). */
export const adminTeamRosterTableHeader =
  'hidden border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-400 sm:grid sm:grid-cols-[minmax(0,1fr)_13rem_minmax(18rem,28rem)_minmax(3.25rem,3.75rem)] sm:gap-x-5 sm:items-center';

/** Сгруппированный список (статусы по категориям): внешняя обёртка */
export const adminListGroupedShell =
  'overflow-hidden rounded-lg border border-gray-200 dark:border-gray-600';

/** Заголовок группы внутри adminListGroupedShell */
export const adminListGroupTitle =
  'border-b border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-300';

/** &lt;ul&gt; внутри группы */
export const adminListGroupUl =
  'divide-y divide-gray-200 dark:divide-gray-700';

/** Строка с hover (настройки в строке, например палитра статуса) */
export const adminListRowInteractive =
  'transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/35';

export const hPage = 'text-base font-semibold text-gray-900 dark:text-gray-100';
export const hCard = 'text-sm font-semibold text-gray-900 dark:text-gray-100';
/** Вторичный текст (описания, подсказки); в тёмной теме чуть выше контраст для чтения. */
export const muted = 'text-sm text-gray-600 dark:text-gray-300';
export const label = 'mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-300';
export const field =
  'h-9 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-blue-400 dark:focus:ring-blue-400/20';

/** Чекбокс в формах админки: без классов в тёмной теме контроль почти не виден. */
export const adminFormCheckbox =
  'h-4 w-4 shrink-0 cursor-pointer rounded border-2 border-gray-300 bg-white accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:border-gray-500 dark:bg-gray-700 dark:accent-blue-400 dark:focus:ring-blue-400 dark:focus:ring-offset-gray-800';

/** @deprecated по мере миграции — предпочитать `Button` (`variant="primary"` и др.). */
export const btnPrimary =
  'inline-flex items-center justify-center rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50';
export const btnSecondary =
  'inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600';
export const btnAccent =
  'inline-flex items-center justify-center rounded-lg border border-blue-500/60 bg-blue-50 px-3.5 py-2 text-sm font-medium text-blue-900 transition-colors hover:bg-blue-100 dark:border-blue-500/50 dark:bg-blue-950/60 dark:text-blue-100 dark:hover:bg-blue-900/50';
export const btnWarn =
  'inline-flex items-center justify-center rounded-lg border border-amber-400/80 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-950 transition-colors hover:bg-amber-100 dark:border-amber-500/45 dark:bg-amber-950/55 dark:text-amber-100 dark:hover:bg-amber-900/45';

export const tabBtnBase =
  'cursor-pointer rounded-lg border border-transparent px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0';
export const tabBtnActive =
  'border-gray-200 bg-white text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100';
export const tabBtnIdle =
  'text-gray-600 hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100';

/** Статусный бейдж-пилюля. Пример: <span className={badgeSuccess}>Токен сохранён</span> */
export const badgeSuccess =
  'inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/45 dark:text-green-200';

/** Предупредительный бейдж-пилюля. Пример: <span className={badgeWarning}>Не настроен</span> */
export const badgeWarning =
  'inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-100';

/** Нейтральный/приглушённый бейдж-пилюля. Пример: <span className={badgeMuted}>org_admin</span> */
export const badgeMuted =
  'inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-700 dark:text-gray-300';

/** Деструктивная кнопка (удаление). Пример: <button className={btnDanger}>Удалить</button> */
export const btnDanger =
  'inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-950/40';
