# Sprint Manager

Веб-приложение для планирования спринтов в Яндекс Трекере по свимлейнам.

**Этот репозиторий** — публичная **community**-выгрузка исходного кода (open-core): общая кодовая база без закрытых enterprise-модулей и без части сценариев полной продуктовой поставки. Сборка ведётся автоматическим экспортом из приватного монорепозитория.

## Возможности

- **Планирование спринтов** — визуальное распределение задач по дням и разработчикам
- **Управление бэклогом** — просмотр и управление задачами, не включенными в спринт
- **Планирование фич** — создание и управление фичами с задачами
- **Burndown chart** — визуализация прогресса спринта
- **Цели спринта** — управление целями через чеклисты
- **Пользовательские токены** — каждый пользователь может работать под своим OAuth токеном

## Технологический стек

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Next.js API Routes
- **База данных**: PostgreSQL приложения (планер, фичи, снимки задач `issue_snapshots`, мультиарендность, staff/teams)
- **Очередь (опционально)**: Redis + BullMQ — фоновая синхронизация с трекером (`pnpm sync-worker`)
- **Внешние API**: Yandex Tracker API (спринты, доски, мутации, часть чтений)
- **UI**: Tailwind CSS, Radix UI, dnd-kit (drag-and-drop)

## Установка

```bash
pnpm install
cp env.example .env
# Заполните POSTGRES_PASSWORD и при необходимости AUTH_SESSION_SECRET, ORG_SECRETS_ENCRYPTION_KEY, REDIS_URL — см. env.example
```

### Локально: PostgreSQL и Redis через Docker

```bash
docker compose up -d db redis
# В .env: POSTGRES_HOST=localhost, POSTGRES_PORT=5433, REDIS_URL=redis://localhost:6379
pnpm dev
```

Сервис `app` в `docker-compose.yml` поднимает приложение в production-режиме вместе с БД и Redis (порт приложения 3000, БД на хосте 5433).

### Без Docker (свой Postgres)

Задайте `POSTGRES_*` в `.env` и убедитесь, что выполнен `database/init.sql` на чистой БД.

```bash
pnpm dev
```

## Настройка токенов

### Organization ID в Яндекс Трекере

Cloud Organization ID для API трекера задаётся **в админке** для каждой организации продукта (поле подключения к трекеру в БД), а не через общий env. В запросах планера используется контекст выбранной организации (`X-Organization-Id`).

### Серверный токен (опционально, fallback)

```bash
TRACKER_API_URL=https://api.tracker.yandex.net/v3
TRACKER_OAUTH_TOKEN=your_oauth_token_here  # Опционально, для fallback
```

### Пользовательский токен (обязательно)

1. Откройте приложение
2. При первом запуске вы будете перенаправлены на страницу настройки
3. Получите OAuth токен по ссылке
4. Введите токен и нажмите «Продолжить»

Без токена доступ к приложению невозможен.

Подробнее о работе токенов в API и клиенте: [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md).

## Документация

### Основные документы

- **[Возможности приложения](./docs/CAPABILITIES.md)** — обзор функций
- **[Индекс документации](./docs/DOCUMENTATION_INDEX.md)** — навигация по `docs/`
- **[API Документация](./docs/API_DOCUMENTATION.md)** — описание API
- **[Структура проекта](./docs/STRUCTURE.md)** — архитектура приложения

### Специализированные руководства

- **[Руководство по тестированию](./docs/AGENT_TESTING_GUIDE.md)**
- **[Квартальное планирование](./docs/QUARTERLY_PLANNING.md)**
- **[Руководство по иконкам](./docs/ICONS.md)**

## Плановый инкрементальный sync (multi-tenant)

Внешний cron может вызывать `POST /api/internal/sync/tick` с заголовком `X-Sync-Cron-Secret: <SYNC_CRON_SECRET>` (или `Authorization: Bearer <secret>`). Поднимите Redis (`REDIS_URL`) и воркер `pnpm sync-worker`. Без Redis ответ будет `200` с `reason: redis_not_configured` и без постановки job — удобно для CI.

## Основные команды

```bash
pnpm dev          # разработка
pnpm build        # production-сборка
pnpm start        # запуск production-сборки
pnpm lint
pnpm typecheck
pnpm test
```

## CI (GitHub Actions)

В этом репозитории настроен workflow **CI** (`.github/workflows/ci.yml`): `pnpm lint`, `pnpm typecheck`, `pnpm test` на `push`/`pull_request` в основную ветку.

Отдельный workflow **publish-community-core** используется мейнтейнерами для публикации open-core-экспорта и в форках обычно не нужен.

## Структура проекта

```
├── app/                 # Next.js App Router (страницы и app/api/*)
├── components/          # Общие UI
├── features/            # Домены (sprint, backlog, burndown, …)
├── lib/                 # DB, snapshots, tracker API, sync, tenant, …
├── hooks/
├── database/            # init.sql (схема beer_tracker)
└── docs/
```

## Безопасность

- Пользовательские токены хранятся только в браузере (localStorage)
- Токены передаются через HTTPS
- Поддержка fallback на серверный токен
- Приоритет: пользовательский токен > серверный токен

## Контрибьюция

1. Коммиты по [DCO](https://developercertificate.org/) — см. [CONTRIBUTING.md](./CONTRIBUTING.md) (`git commit -s`).
2. Изучите [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)
3. Следуйте структуре проекта и используйте TypeScript
4. Тестируйте изменения перед коммитом

## Лицензия

См. [LICENSE](./LICENSE).

## Поддержка

Начните с [DOCUMENTATION_INDEX.md](./docs/DOCUMENTATION_INDEX.md) и при необходимости с [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md).
