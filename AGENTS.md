# Подсказки для ассистентов и разработчиков

## Перед тем как считать задачу сделанной

1. **`pnpm typecheck`** — без ошибок TypeScript.
2. **`pnpm lint`** — без ошибок ESLint (предупреждения допустимы, пока политика не ужесточена).
3. **`pnpm test`** — unit-тесты (Vitest); при изменении покрытой логики — добавить или обновить тесты.
4. При изменении зависимостей или публичных API — при необходимости **`pnpm build`**.

## Команды

| Команда | Назначение |
|---------|------------|
| `pnpm lint` | ESLint по проекту |
| `pnpm lint:fix` | ESLint с автоисправлением |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Vitest (`vitest run`) и затем **`pnpm check:i18n`** (паритет ключей ru/en) |
| `pnpm check:i18n` | Паритет ключей ru/en + проверка английских листьев (пустые строки, TODO/TBD/FIXME); исключения — `scripts/i18n/english-quality-allowlist.json` |
| `pnpm i18n:export` | Экспорт `en`/`ru` в плоский JSON для офлайн-перевода (см. `scripts/i18n/README.md`) |
| `pnpm i18n:import` | Слияние правок из JSON обратно в `en.ts` / `ru.ts` |
| `pnpm test:watch` | Vitest в режиме watch |
| `pnpm lint:unused` | Knip: неиспользуемые файлы/зависимости |
| `pnpm build` | Production-сборка Next.js |
| `pnpm storybook` | Витрина UI (Storybook, порт 6006) |
| `pnpm build-storybook` | Статическая сборка Storybook в `storybook-static/` (каталог в `.gitignore`) |

Локализация UI (ключи, словари, когда гонять `check:i18n`): **[`scripts/i18n/README.md`](./scripts/i18n/README.md)**.

## Дизайн-система и общие компоненты

- Перед добавлением нового атома UI: поиск в [`components/`](./components/) и в [каталоге спеки](.spec-workflow/specs/project-design-review/COMPONENT_CATALOG.md); по возможности расширять существующий примитив.
- Семантические CSS-токены (бордеры шапки, muted-текст, тосты): [`app/globals.css`](./app/globals.css) (`--ds-*`, `--toast-*`); краткий перечень — в каталоге спеки.
- Сториз для ключевых примитивов: `components/*.stories.tsx`, запуск `pnpm storybook`.

## Архитектура данных (кратко)

Полная карта: **[ARCHITECTURE.md](./ARCHITECTURE.md)** — React Query (задачи спринта, доски), MobX (позиции, UI планера), локальный стейт + `useDebouncedApiSync` (связи, комментарии), паттерн «локальный список задач в планере + оптимистичные правки».

## Слои: MobX, dnd-kit, `lib/`

- **MobX (`lib/layers/application/mobx/`, сторы в `lib/layers/application/mobx/stores/`, корневой `createRootStore` рядом)** — доменное состояние приложения: позиции задач, UI-сессия планера, согласование с API (поколения ответов, оптимистичные обновления). В планере позиции удобнее брать через [`hooks/useTaskPositionsApi.ts`](./hooks/useTaskPositionsApi.ts) (фасад на `TaskPositionsStore`). Не класть сюда жизненный цикл одного жеста drag, если он полностью задаётся dnd-kit.
- **`SprintPlannerUiStore`** — преходящий UI основного планера спринта (поиск по имени, контекстное меню, hover, сегменты фаз, фокус редактирования комментария, модалка учёта работ). Сброс при смене спринта: `clearTransientUiOnSprintChange`. Листья и хуки могут читать стор через `useRootStore().sprintPlannerUi` там, где это уже сделано (канбан, свимлейны, модалки, шапка).
- **`OccupancyView` + `usePlannerUiStore`** — при `usePlannerUiStore: true` (только основной `SprintPlanner`) поля фильтра/меню/сегментов/комментария берутся из `SprintPlannerUiStore`; при `false` или без флага — только из пропсов (эпики и внешние экраны со своим поиском не смешиваются с глобальным стором). Разрешение полей вынесено в `occupancyPlannerUiResolve.ts` для тестов и единой логики.
- **dnd-kit + React** — перетаскивание в UI: `active` / `over`, сброс в `onDragEnd` / `onDragCancel` / `onDragAbort`. Общие правила маршрутизации для планера спринта — `features/sprint/components/SprintPlanner/sprintPlannerDndHelpers.ts` (не дублировать логику между shell и хуками).
- **`lib/` (геометрия, парсеры, чистые функции)** — без зависимостей от MobX и React; тестируемые unit-тестами без рендера.

## Конвенции

- Следовать существующим паттернам в соседних файлах (именование, импорты, стиль компонентов).
- Не добавлять лишние зависимости без необходимости; неиспользуемый код удалять, а не «заглушать» без причины.
- Политика по Sonar/React Compiler зафиксирована в `eslint.config.mjs` (см. комментарий в начале файла).

## Pre-commit (Husky + lint-staged)

После **`pnpm install`** активируется хук: при коммите на **проиндексированных** `*.{js,jsx,mjs,cjs,ts,tsx}` запускается **`eslint --fix`**.

- Обойти хук (только при необходимости): `git commit --no-verify` или `HUSKY=0 git commit …`.
- Полный проект по-прежнему не линтится в хуке — только изменённые файлы; перед пушем полезно **`pnpm lint`**, **`pnpm typecheck`** и **`pnpm test`**.

## CI

В GitLab для **merge request** дополнительно выполняется job **`dco`** (проверка `Signed-off-by` по [DCO](https://developercertificate.org/); см. [CONTRIBUTING.md](./CONTRIBUTING.md)). На каждом MR и пуше в ветки также идёт **`lint-and-typecheck`** (`pnpm lint` + `pnpm typecheck` + `pnpm test`). Сборка Docker-образа не запускает ESLint (`NEXT_IGNORE_ESLINT` в Dockerfile), поэтому локальные и CI-проверки обязательны.
