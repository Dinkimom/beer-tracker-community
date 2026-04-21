# Бэклог рефакторинга

Документ фиксирует уже выполненный рефакторинг и список задач на будущее. Используется для планирования и онбординга.

---

## 1. Что уже сделано

### 1.1 Разбивка клиентского API (`lib/beerTrackerApi` → `lib/api/`)

Часть API вынесена в отдельные модули в `lib/api/`. Импорты вида `import { ... } from '@/lib/beerTrackerApi'` по-прежнему работают за счёт реэкспорта в `beerTrackerApi.ts` (`export * from './api'`).

| Модуль        | Файл            | Функции |
|---------------|-----------------|--------|
| **boards**    | `lib/api/boards.ts`   | `fetchBoards`, `fetchBoard`, `fetchSprints`, `createSprint` |
| **drafts**    | `lib/api/drafts.ts`   | `fetchDrafts`, `createDraft`, `updateDraft`, `deleteDraft` (драфты квартального плана на верхнем уровне) |
| **sprints**   | `lib/api/sprints.ts`  | `fetchSprintPositions`, `saveTaskPosition`, `saveTaskPositionsBatch`, `fetchSprintLinks`, `saveTaskLink`, `saveTaskLinksBatch`, `deleteTaskLink`, `fetchSprintComments`, `saveComment`, `deleteComment`, `updateSprintStatus`, `fetchSprintTasks`, `deleteTaskPosition`, `clearSprintPositions`, `clearSprintLinks`, `fetchOccupancyTaskOrder`, `saveOccupancyTaskOrder`, `fetchBacklog`, `fetchBurndownData` |
| **types**     | `lib/api/types.ts`    | Общие типы API (`TransitionItem`, `BoardListItem`, `OccupancyTaskOrder` и др.) |
| **auth**      | `lib/api/auth.ts`     | `validateToken` |

Текущая структура реэкспорта: `lib/api/index.ts` экспортирует `auth`, `boards`, `drafts`, `features`, `issues`, `quarterly`, `sprints`, `stories`, `types`.

### 1.2 Сайдбар и состояние

- **Контекст сайдбара:** `features/sidebar/contexts/TaskSidebarContext.tsx` — табы (`TasksTab`, `GoalsTab`, `BacklogTab` и др.) берут данные через `useTaskSidebar()`, без прокидывания пропсов с верху.
- **Состояние TasksSidebar (квартальное планирование):** вынесено в хук `useTasksSidebarState` (`features/quarterly-planning/components/Task/hooks/useTasksSidebarState.ts`) на `useReducer`; в `TasksSidebar.tsx` убрано множество разрозненных `useState`.

### 1.3 Качество кода

- **Типизация:** использование `any` убрано (типы в API routes, Occupancy, модалках, `beerTrackerApi` и т.д.).
- **Инлайн-импорты типов:** все конструкции вида `import('@/...').Type` заменены на обычные `import type` в начале файла; в ESLint добавлено правило `no-restricted-syntax` с селектором `TSImportType`.

---

## 2. Планы на рефакторинг

### 2.1 ~~Добить разбивку `lib/beerTrackerApi.ts`~~ (сделано)

Разбивка выполнена. Добавлены модули:

| Модуль       | Файл               | Содержимое |
|-------------|--------------------|------------|
| **issues**  | `lib/api/issues.ts` | Задачи Tracker: fetchIssueFull, getIssue, переходы, чеклист, changelog, createIssue и др. |
| **stories** | `lib/api/stories.ts` | Стори и драфт-задачи: fetchStories, fetchStory, fetchStoryTasks, позиции/связи, createStoryDraftTask, updateStoryDraftTask, deleteStoryDraftTask. |
| **features** | `lib/api/features.ts` | Фичи, документы, диаграммы, груминг (todos и диаграмма). |
| **quarterly** | `lib/api/quarterly.ts` | Квартальные планы, участники, доступность, fetchQuarterlyEpicStories, fetchQuarterlyStoryTasks. |

Файл `lib/beerTrackerApi.ts` сокращён до барреля: только `export * from './api'`.

### 2.2 Крупные файлы (средний приоритет)

| Файл | Ориентир строк | Статус / предложение |
|------|-----------------|----------------------|
| `lib/beerTrackerApi.ts` | ~12 | **Сделано:** баррель, реализация в `lib/api/`. |
| `lib/trackerApi.ts`     | — | **Сделано:** вынесено в `lib/trackerApi/` (constants, workflows, boards, sprints, issues, index). |
| `lib/clickhouseApi.ts`  | — | **Сделано:** вынесено в `lib/clickhouseApi/`, затем удалено полностью — заменено на `lib/snapshots/*` (PostgreSQL). |
| `features/sprint/components/SprintPlanner.tsx` | ~670 | **Частично:** панель контролов вынесена в `SprintPlannerControlsBar`. При необходимости — ещё подкомпоненты. |
| `features/sprint/components/SprintPlanner/hooks/useSprintPlannerHandlers.ts` | ~185 | **Сделано:** интерфейс `UseSprintPlannerHandlersProps` вынесен в `useSprintPlannerHandlers.types.ts`. |

### 2.3 ESLint-disable (средний приоритет)

- **react-hooks/exhaustive-deps** — много отключений; по возможности пересмотреть зависимости эффектов или вынести логику так, чтобы правило не отключать.
- **no-await-in-loop** — в `app/api/quarterly-plans/route.ts` и `useFeaturesData.ts`; оставить один явный паттерн батчей с ограничением параллелизма.
- **react-hooks/set-state-in-effect** — в нескольких компонентах; где возможно — переписать без setState в эффекте.

### 2.4 Обработка ошибок на клиенте (средний приоритет)

- Ввести единый подход к показу ошибок пользователю (toast или глобальный обработчик, в т.ч. для React Query).
- В местах, где сейчас только `console.error` и возврат/редьюс без UI (например, GroomingTab, части useLoadStoryTasks), добавить уведомление пользователя.

### 2.5 Shared UI-компоненты (средний приоритет)

Подробный аудит дублирующихся компонентов и рекомендации — в **[docs/SHARED_COMPONENTS_AUDIT.md](./SHARED_COMPONENTS_AUDIT.md)**.

Кратко:
- **SearchInput** — поле поиска с иконкой и кнопкой очистки (9+ мест: SidebarFilters, TasksTabFilters, SprintPlannerControlsBar, DocumentSearch, FeaturesListFilters, TasksSidebar, UserSelector, ParticipantsModal и др.).
- **Бейджи/теги:** PointBadge (SP/TP), TeamTag + общий `getTeamTagClasses`, везде использовать `StatusTag` вместо ручного рендера (TaskBadges, TaskSidebarCard, feature-planner TaskCard).
- **Input / TextArea** — единые классы для полей в модалках (AvailabilityEditModal, DraftTaskModal, PhaseEditModal, ParticipantsModal и др.).
- **Button** (опционально) — вариант secondary для кнопок «Отмена» и фильтров.

### 2.6 Мелкие улучшения (низкий приоритет)

- **Дублирование:** общие мапперы/хелперы для задач и позиций (useLoadStoryTasks, useTaskState, useApiStorage); единый helper для «при ошибке вернуть []» вместо повторяющегося try/catch.
- **Типизация:** в `lib/api-error-handler.ts` заменить `error as { response?: ... }` на проверки/type guard.
- **Константы:** вынести строки статусов (`'in-progress'`, `'todo'`) и константы вроде `batchSize` в именованные константы/enum.

---

## 3. Как делать разбивку API (напоминание)

1. Создать файл в `lib/api/`, например `lib/api/issues.ts`.
2. Перенести туда функции соответствующего блока из `beerTrackerApi.ts`, подтянуть импорты (типы из `@/types`, `./types`, `axios` и т.д.).
3. В `lib/api/index.ts` добавить `export * from './issues'` (или другой модуль).
4. Удалить перенесённый блок из `lib/beerTrackerApi.ts`.
5. Убрать неиспользуемые импорты типов из `beerTrackerApi.ts`.
6. Прогнать `pnpm typecheck` и линтер.

Импорты из `@/lib/beerTrackerApi` менять не обязательно — они продолжают работать через `export * from './api'`.

---

**Последнее обновление:** февраль 2025
