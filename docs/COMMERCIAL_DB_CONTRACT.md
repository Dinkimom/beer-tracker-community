# Commercial DB Contract

Цель: зафиксировать контракт данных для коммерческого подключения, чтобы можно было использовать готовую организационную БД без изменения кода приложения.

Контракт учитывает текущую архитектуру Beer Tracker:

- одна PostgreSQL БД;
- схема приложения `beer_tracker` (RW);
- внешние схемы `overseer` и `public` (обычно RO, см. раздел про гибкость).

## 1) Базовая модель подключения

Приложение подключается через `POSTGRES_*` и работает в одной БД.

Базовый runtime-контур:

- `beer_tracker` - состояние приложения, мультиарендность, админка, sync/exporter;
- `overseer` - внешние орг-данные и сырые данные трекера;
- `public` - внешний реестр сотрудников.

## 2) Env для коммерческой версии

Минимальный набор:

- `POSTGRES_HOST`
- `POSTGRES_PORT`
- `POSTGRES_DB` (организационная БД, например `windmill-integrations`)
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`
- `BEER_TRACKER_SCHEMA=beer_tracker`

Для on-prem/sync:

- `AUTH_SESSION_SECRET`
- `ORG_SECRETS_ENCRYPTION_KEY`
- `REDIS_URL` (если используется очередь)
- `SYNC_CRON_SECRET` (если используется cron endpoint)

Для гибкого отключения встроенного экспортера:

- `EXPORTER_ENABLED=true|false`
- `NEXT_PUBLIC_EXPORTER_ENABLED=true|false`

Для режима совместимости источников:

- `DB_CONTRACT_MODE=native|compatibility`
- `DB_CONTRACT_PREFLIGHT_STRICT=true|false` (strict startup-check в compatibility)

## 3) Целевая структура по схемам

### 3.1 `beer_tracker` (RW, основной runtime)

#### 3.1.1 Планирование / продуктовые таблицы

- `task_positions`
- `task_position_segments`
- `task_links`
- `comments`
- `occupancy_task_order`
- `sprint_goals`
- `quarterly_plans`
- `planned_items`
- `quarterly_plan_participants`
- `vacations`
- вспомогательные: `document_versions`, `story_task_positions`, `story_task_links`, `draft_tasks`, `tech_sprint_entries`, `vacation_entries`, и др. из `database/init.sql`.

#### 3.1.2 Организации, доступы, админка

- `organizations`
- `users`
- `organization_secrets`
- `organization_invitations`
- `teams`
- `staff`
- `team_members`
- `system_roles`
- `org_roles`

#### 3.1.3 Exporter/sync

- `issue_snapshots`
- `issue_changelog_events`
- `sync_runs`

### 3.2 `overseer` (внешние орг-данные)

Контрактные таблицы:

- `overseer.teams`
- `overseer.staff_teams`
- `overseer.staff_roles`
- `overseer.roles`
- `overseer.ytracker_raw_issues`

### 3.3 `public` (внешние справочники)

- `public.registry_employees`

## 4) Совместимость с текущим кодом: 2 рабочих режима

### Режим A (native, рекомендованный)

Приложение работает полностью на `beer_tracker` (включая `teams/staff/team_members`, `issue_snapshots`, `sync_runs`).

Используйте, когда БД разворачивается по `database/init.sql` и миграциям проекта.

### Режим B (compatibility с legacy-контуром)

Если есть готовая орг-БД в контракте `beer_tracker + overseer + public`, допускается подключение через слой совместимости:

- `beer_tracker` остаётся write-слоем приложения;
- орг-данные/реестр могут приходить из `overseer/public`;
- при необходимости создаются совместимые представления/materialized pipeline в `beer_tracker`.

Практика для бесшовной подмены:

1. Сохранять канонический интерфейс, который ожидает приложение, в `beer_tracker`.
2. Догружать/синхронизировать данные из `overseer/public` в `beer_tracker` (ETL/refresh job), либо использовать SQL views/foreign tables.
3. Избегать изменений API-контрактов приложения: подмена должна быть на уровне БД-слоя.

Что уже поддержано в коде:

- fallback чтение каталога команд из `overseer.teams`, если в `beer_tracker.teams` нет данных;
- fallback чтение реестра сотрудников из `public.registry_employees` для поиска/резолва сотрудников в admin/on-prem флоу.
- fallback чтение задач и changelog из `overseer.ytracker_raw_issues` для backlog/epics/stories/sprint/changelog API, если `beer_tracker.issue_snapshots` и `beer_tracker.issue_changelog_events` пусты.
- preflight-проверка контракта на старте Node runtime (`instrumentation`) в compatibility-режиме.
- внутренний диагностический endpoint: `GET /api/internal/db-contract/status` (доступ по `SYNC_CRON_SECRET`).

## 5) Must-have интерфейс (минимум)

### 5.1 `beer_tracker` (критично для runtime)

- `task_positions`: `organization_id`, `sprint_id`, `task_id`, `assignee_id`, `start_day`, `start_part`, `duration`
- `task_position_segments`: `organization_id`, `sprint_id`, `task_id`, `segment_index`, `start_day`, `start_part`, `duration`
- `task_links`: `organization_id`, `sprint_id`, `id`, `from_task_id`, `to_task_id`
- `comments`: `organization_id`, `sprint_id`, `id`, `assignee_id`, `text`
- `quarterly_plans`: `id`, `board_id`, `year`, `quarter`
- `planned_items`: `id`, `plan_id`, `type`, `source_id`, `source_key`, `title`, `assignee`, `phases`, `display_order`
- `teams`: `id`, `organization_id`, `slug`, `title`, `tracker_queue_key`, `tracker_board_id`, `active`
- `staff`: `id`, `organization_id`, `tracker_user_id`, `display_name`, `email`
- `team_members`: `team_id`, `staff_id`, `role_slug`
- `issue_snapshots`: `organization_id`, `issue_key`, `payload`, `tracker_updated_at`, `synced_at`
- `issue_changelog_events`: `organization_id`, `issue_key`, `changelog`, `comments`, `synced_at`
- `sync_runs`: `id`, `organization_id`, `job_type`, `status`, `stats`, `started_at`, `finished_at`

### 5.2 `overseer` / `public` (если используется legacy-совместимость)

- `overseer.teams`: `uid`, `slug`, `title`, `queue`, `board`, `active`
- `overseer.staff_teams`: `staff_uid`, `team_uid`
- `overseer.staff_roles`: `staff_uid`, `role_uid`
- `overseer.roles`: `uid`, `slug`, `title`, `active`
- `overseer.ytracker_raw_issues`: `issue_id`, `issue_data`, `issue_logs`, `issue_comments`, `updated_at`
- `public.registry_employees`: `uuid`, `tracker_id`, `email`, `name`, `surname`, `patronymic`, `fullname`, `status`, `avatar_link`, `fired_date`, `birthdate`

## 6) Управление пользователями и границы изменений

- Через админку разрешено управлять составом команд (добавление/удаление участника команды).
- Удаление пользователя из реестра сотрудников не является пользовательской операцией в UI/API.
- Реестр (`staff`/`registry_employees`) и team ACL из `overseer.staff_teams/staff_roles/roles` являются источником организационных данных и администрируются вне UI Beer Tracker.

## 7) Требуемые права БД

Для технического пользователя приложения:

- На `beer_tracker`: `USAGE` + `SELECT, INSERT, UPDATE, DELETE` на таблицы, `USAGE, SELECT` на sequence.
- На `overseer`: минимум `USAGE` + `SELECT` на нужные таблицы (или расширенные права только если выбран write-through в legacy-контуре).
- На `public`: `USAGE` + `SELECT` на `registry_employees`.

В production не выдавать приложению DDL-права (`CREATE`, `ALTER`, `DROP`).

## 8) DDL baseline

Источник истины:

- `database/init.sql` - полный baseline схемы `beer_tracker`.

Рекомендация:

1. создать/проверить `beer_tracker`;
2. применить `init.sql`;
3. догнать миграции проекта;
4. только после этого подключать app/worker/cron.

## 9) SQL smoke-checks перед запуском

Проверка подключения:

```sql
select current_database(), current_user;
```

Проверка схем:

```sql
select schema_name
from information_schema.schemata
where schema_name in ('beer_tracker', 'overseer', 'public');
```

Проверка runtime-таблиц:

```sql
select count(*) from beer_tracker.task_positions;
select count(*) from beer_tracker.teams;
select count(*) from beer_tracker.staff;
select count(*) from beer_tracker.team_members;
select count(*) from beer_tracker.issue_snapshots;
```

Проверка внешних схем (если используются):

```sql
select count(*) from overseer.teams;
select count(*) from public.registry_employees;
select count(*) from overseer.ytracker_raw_issues;
```

Если любой запрос падает с `permission denied` или `relation does not exist`, контракт не выполнен.

## 10) Риски совместимости

- Неполный baseline `beer_tracker` (пропущены миграции).
- Разные структуры `overseer/public` между окружениями.
- Неконсистентные секреты/пароли у `app`, `sync-worker`, `sync-cron`.
- Попытка использовать legacy-источники без слоя совместимости в `beer_tracker`.

## 11) Рекомендуемый rollout

1. Подготовить доступы и grants в staging.
2. Прогнать SQL smoke-checks.
3. Поднять `app` + `sync-worker` (и `sync-cron` при необходимости).
4. Пройти login/admin/team-members smoke.
5. Проверить `POST /api/internal/sync/tick`.
6. Повторить те же grants/values в production.
