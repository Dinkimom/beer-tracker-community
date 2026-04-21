# Sprint Manager

Веб-приложение для планирования спринтов в Яндекс Трекере по свимлейнам.

## 🚀 Возможности

- **Планирование спринтов** — визуальное распределение задач по дням и разработчикам
- **Управление бэклогом** — просмотр и управление задачами, не включенными в спринт
- **Планирование фич** — создание и управление фичами с задачами
- **Burndown chart** — визуализация прогресса спринта
- **Цели спринта** — управление целями через чеклисты
- **Пользовательские токены** — каждый пользователь может работать под своим OAuth токеном

## 📦 Технологический стек

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Next.js API Routes
- **База данных**: PostgreSQL приложения (планер, фичи, **снимки задач** `issue_snapshots`, мультиарендность, staff/teams)
- **Очередь (опционально)**: Redis + BullMQ — фоновая синхронизация с трекером (`pnpm sync-worker`)
- **Внешние API**: Yandex Tracker API (спринты, доски, мутации, часть чтений)
- **UI**: Tailwind CSS, Radix UI, dnd-kit (drag-and-drop)

## 🛠️ Установка

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

Задайте `POSTGRES_*` в `.env` и убедитесь, что выполнен `database/init.sql` на чистой БД (или эквивалентные миграции).

```bash
pnpm dev
```

## 🔑 Настройка токенов

### Organization ID в Яндекс Трекере

Cloud Organization ID для API трекера задаётся **в админке** для каждой организации продукта (поле подключения к трекеру в БД), а не через общий env. В запросах планера используется контекст выбранной организации (`X-Organization-Id`).

### Серверный токен (опционально, fallback)

Настройте переменные окружения в `.env.local`:

```bash
TRACKER_API_URL=https://api.tracker.yandex.net/v3
TRACKER_OAUTH_TOKEN=your_oauth_token_here  # Опционально, для fallback
```

### Пользовательский токен (обязательно)

1. Откройте приложение
2. При первом запуске вы будете перенаправлены на страницу настройки
3. Получите OAuth токен по ссылке
4. Введите токен и нажмите "Продолжить"

Без токена доступ к приложению невозможен.

Подробнее: [USER_TOKEN_GUIDE.md](./docs/USER_TOKEN_GUIDE.md)

## 📚 Документация

### Основные документы

- **[Возможности приложения](./docs/CAPABILITIES.md)** — полный обзор всех возможностей и функций
- **[Навигация по документации](./docs/README.md)** — индекс всей документации проекта
- **[API Документация](./docs/API_DOCUMENTATION.md)** — подробное описание API
- **[Структура проекта](./docs/STRUCTURE.md)** — архитектура приложения

### Специализированные руководства

- **[Руководство по тестированию](./docs/AGENT_TESTING_GUIDE.md)** — тест-кейсы и инструкции
- **[Квартальное планирование](./docs/QUARTERLY_PLANNING.md)** — планирование на квартал вперед
- **[Windmill / историческая схема](./docs/WINDMILL_INTEGRATION.md)** — справочник для миграции данных (код `lib/windmillDb` удалён)
- **[Руководство по иконкам](./docs/ICONS.md)** — использование иконок в проекте

### Дополнительные материалы

- **[Известные проблемы](./BUGS_AND_TASKS.md)** — список известных проблем и задач
- **[Планировщик фич](./FEATURE_PLANER.md)** — концепция планировщика фич

## ⏱ Плановый инкрементальный sync (multi-tenant)

Внешний cron (например раз в 1–5 минут) может вызывать:

`POST /api/internal/sync/tick`

с заголовком `X-Sync-Cron-Secret: <SYNC_CRON_SECRET>` (или `Authorization: Bearer <secret>`). Поднимите Redis (`REDIS_URL`) и воркер `pnpm sync-worker`. Без Redis ответ будет `200` с `reason: redis_not_configured` и без постановки job — удобно для CI. Организации выбираются только с завершённой первичной синхронизацией (`initial_sync_completed_at`), не выключенным `settings.sync.enabled` и `sync_next_run_at` в прошлом или не заданным; за тик обрабатывается не больше `SYNC_MAX_ORGS_PER_TICK` org.

## 🎯 Основные команды

```bash
# Запуск в режиме разработки
pnpm dev

# Сборка для production
pnpm build

# Запуск production сборки
pnpm start

# Линтинг
pnpm lint

# Проверка типов
pnpm typecheck
```

## 🚢 CI/CD (GitHub Actions)

Проект использует GitHub Actions:

- `CI` (`.github/workflows/ci.yml`) — `pnpm lint`, `pnpm typecheck`, `pnpm test` на `push` в `master` и на каждый `pull_request`.
- `Deploy on master tag` (`.github/workflows/deploy-on-tag.yml`) — деплой на удаленный хост при создании тега, если tagged-коммит входит в историю `master`.

Для деплоя добавьте в GitHub repository secrets:

- `DEPLOY_HOST` — адрес удаленного хоста
- `DEPLOY_USER` — пользователь для SSH
- `DEPLOY_SSH_KEY` — приватный SSH-ключ (PEM/OpenSSH)
- `DEPLOY_PORT` — порт SSH (обычно `22`)
- `DEPLOY_PATH` — путь к директории проекта на сервере (где уже есть git-репозиторий и `.env`)

Поток деплоя:

1. Создать тег на коммите из `master`
2. Отправить тег в GitHub (`git push origin <tag>`)
3. GitHub Action подключится по SSH, переключит серверный репозиторий на тег и выполнит `docker compose up -d --build --remove-orphans`

## 🏗️ Структура проекта

```
beer-tracker/
├── app/                 # Next.js App Router (страницы и app/api/*)
├── components/          # Общие UI
├── features/            # Домены (sprint, backlog, burndown, …)
├── lib/                 # DB, snapshots, tracker API, sync, tenant, …
├── hooks/
├── database/            # init.sql (схема beer_tracker)
└── docs/
```

## 🔒 Безопасность

- Пользовательские токены хранятся только в браузере (localStorage)
- Токены передаются через HTTPS
- Поддержка fallback на серверный токен
- Приоритет: пользовательский токен > серверный токен

## 🤝 Контрибьюция

1. **Merge request:** коммиты должны быть подписаны по [DCO](https://developercertificate.org/) — см. [CONTRIBUTING.md](./CONTRIBUTING.md) (`git commit -s`).
2. Изучите [API_DOCUMENTATION.md](./docs/API_DOCUMENTATION.md)
3. Следуйте существующей структуре проекта
4. Используйте TypeScript для типобезопасности
5. Тестируйте изменения перед коммитом

## 📝 Лицензия

См. [LICENSE](./LICENSE).

Кратко:
- Автор: Дмитриев Никита Михайлович (2026)
- Бессрочная, безвозмездная, неисключительная лицензия для ООО «УАЙКЛАЕНТС» (ИНН 7708274185) **для внутренних нужд**
- **Запрещены** распространение третьим лицам и коммерческое использование без отдельного соглашения с Автором

## 🆘 Поддержка

При возникновении проблем:
1. Проверьте [BUGS_AND_TASKS.md](./BUGS_AND_TASKS.md)
2. Изучите документацию в [docs/](./docs/)
3. Свяжитесь с командой разработки
