# Индекс документации Beer Tracker

Быстрый справочник по всей документации проекта.

## 📋 Структура документации

```
beer-tracker/
├── README.md                          # Быстрый старт, установка, настройка
├── docs/
│   ├── README.md                      # Навигация по документации (НАЧНИТЕ ЗДЕСЬ)
│   ├── CAPABILITIES.md                # 🆕 Полный обзор возможностей приложения
│   ├── API_DOCUMENTATION.md           # API, архитектура запросов
│   ├── API_BACKENDS.md                # Маршруты /api → Tracker, PG
│   ├── STRUCTURE.md                   # Feature-based архитектура
│   ├── ADR-001-quarterly-planning-v1-v2.md  # ADR: quarterly v1 vs v2 (канон, импорты)
│   ├── QUARTERLY_PLANNING.md          # Квартальное планирование
│   ├── QUARTERLY_PLANNING_DESIGN_REVIEW.md  # 🆕 Дизайн-ревью квартального планирования
│   ├── AGENT_TESTING_GUIDE.md         # Тест-кейсы для агентов
│   ├── ICONS.md                       # Руководство по иконкам
│   ├── REFACTORING_BACKLOG.md         # Что отрефакторено и бэклог рефакторинга
│   └── ZINDEX.md                      # Работа с z-index
├── FEATURE_PLANER.md                  # Концепция планировщика фич
├── QUARTERLY_PLANNING_SUMMARY.md      # Сводка по квартальному планированию
├── BUGS_AND_TASKS.md                  # Известные проблемы и задачи
├── REFACTORING_SUMMARY.md             # Сводка по реструктуризации
└── SIDEBAR_MIGRATION.md               # Миграция сайдбара
```

## 🎯 С чего начать?

### Для новых разработчиков

1. **[README.md](../README.md)** — установка и настройка
2. **[CAPABILITIES.md](./CAPABILITIES.md)** — что умеет приложение
3. **[STRUCTURE.md](./STRUCTURE.md)** — архитектура проекта
4. **[API_DOCUMENTATION.md](./API_DOCUMENTATION.md)** — работа с API
5. **[API_BACKENDS.md](./API_BACKENDS.md)** — какой бэкенд у какого `/api` маршрута

### Для пользователей

1. **[CAPABILITIES.md](./CAPABILITIES.md)** — возможности приложения
2. **[AGENT_TESTING_GUIDE.md](./AGENT_TESTING_GUIDE.md)** — как использовать функции

### Для тестировщиков

1. **[AGENT_TESTING_GUIDE.md](./AGENT_TESTING_GUIDE.md)** — тест-кейсы

## 📚 Категории документации

### 🚀 Основная документация

| Документ | Описание | Аудитория |
|----------|----------|-----------|
| [CAPABILITIES.md](./CAPABILITIES.md) | Полный обзор возможностей | Все |
| [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) | API, архитектура запросов | Разработчики |
| [API_BACKENDS.md](./API_BACKENDS.md) | Маршруты `/api` → Tracker, PostgreSQL | Разработчики |
| [COMMERCIAL_DB_CONTRACT.md](./COMMERCIAL_DB_CONTRACT.md) | Контракт орг-БД для коммерческого подключения (`beer_tracker` + `overseer/public`) | Разработчики, DevOps |
| [STRUCTURE.md](./STRUCTURE.md) | Feature-based архитектура | Разработчики |
| [ADR-001-quarterly-planning-v1-v2.md](./ADR-001-quarterly-planning-v1-v2.md) | Квартальное планирование: v1 legacy vs v2 канон | Разработчики |
| [FOLDER_NAMING.md](./FOLDER_NAMING.md) | Именование папок (kebab vs PascalCase для доменов) | Разработчики |
| [README.md](./README.md) | Навигация по документации | Все |

### 🔧 Специализированные руководства

| Документ | Описание | Аудитория |
|----------|----------|-----------|
| [QUARTERLY_PLANNING.md](./QUARTERLY_PLANNING.md) | Квартальное планирование | Все |
| [QUARTERLY_PLANNING_DESIGN_REVIEW.md](./QUARTERLY_PLANNING_DESIGN_REVIEW.md) | Дизайн-ревью квартального планирования | Разработчики, Дизайнеры |
| [ICONS.md](./ICONS.md) | Использование иконок | Разработчики |
| [ZINDEX.md](./ZINDEX.md) | Работа с z-index | Разработчики |
| [AGENT_TESTING_GUIDE.md](./AGENT_TESTING_GUIDE.md) | Тест-кейсы | Тестировщики |

### 📄 Дополнительные материалы

| Документ | Описание | Аудитория |
|----------|----------|-----------|
| [FEATURE_PLANER.md](../FEATURE_PLANER.md) | Концепция планировщика фич | Разработчики |
| [QUARTERLY_PLANNING_SUMMARY.md](../QUARTERLY_PLANNING_SUMMARY.md) | Сводка по квартальному планированию | Разработчики |
| [BUGS_AND_TASKS.md](../BUGS_AND_TASKS.md) | Известные проблемы | Все |
| [REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md) | Реструктуризация проекта | Разработчики |
| [REFACTORING_BACKLOG.md](./REFACTORING_BACKLOG.md) | Что уже отрефакторено и бэклог на будущее | Разработчики |
| [OPEN_CORE_SPLIT_READINESS.md](./OPEN_CORE_SPLIT_READINESS.md) | Готовность к разделению private/public | Разработчики, DevOps |
| [OPEN_CORE_SPLIT_RUNBOOK.md](./OPEN_CORE_SPLIT_RUNBOOK.md) | Операционный runbook публикации community-core | Разработчики, DevOps |
| [sync-public-private/README.md](./sync-public-private/README.md) | PR из public → синк в private (`contribute.sh`, downstream) | Мейнтейнеры |
| [sync-public-private/CONTRIBUTING_EXAMPLE.md](./sync-public-private/CONTRIBUTING_EXAMPLE.md) | Пошаговый пример: новая ветка от `upstream/main` и `community:pr` | Мейнтейнеры |
| [SIDEBAR_MIGRATION.md](../SIDEBAR_MIGRATION.md) | Миграция сайдбара | Разработчики |

## 🔍 Поиск по темам

### По функциональности

- **Планирование спринтов** → [CAPABILITIES.md](./CAPABILITIES.md#1-планирование-спринтов)
- **Бэклог** → [CAPABILITIES.md](./CAPABILITIES.md#2-управление-бэклогом)
- **Планирование фич** → [CAPABILITIES.md](./CAPABILITIES.md#3-планирование-фич), [FEATURE_PLANER.md](../FEATURE_PLANER.md)
- **Квартальное планирование** → [CAPABILITIES.md](./CAPABILITIES.md#4-квартальное-планирование), [QUARTERLY_PLANNING.md](./QUARTERLY_PLANNING.md), [QUARTERLY_PLANNING_DESIGN_REVIEW.md](./QUARTERLY_PLANNING_DESIGN_REVIEW.md)
- **Burndown Chart** → [CAPABILITIES.md](./CAPABILITIES.md#5-burndown-chart)
- **Цели спринта** → [CAPABILITIES.md](./CAPABILITIES.md#6-цели-спринта)

### По техническим вопросам

- **API** → [API_DOCUMENTATION.md](./API_DOCUMENTATION.md), [API_BACKENDS.md](./API_BACKENDS.md)
- **Архитектура** → [STRUCTURE.md](./STRUCTURE.md)
- **Именование папок (домены)** → [FOLDER_NAMING.md](./FOLDER_NAMING.md)

- **База данных** → [API_DOCUMENTATION.md](./API_DOCUMENTATION.md#распределение-эндпоинтов-по-источникам-данных), [COMMERCIAL_DB_CONTRACT.md](./COMMERCIAL_DB_CONTRACT.md)
- **Иконки** → [ICONS.md](./ICONS.md)
- **Z-index и слои** → [ZINDEX.md](./ZINDEX.md)
- **Тестирование** → [AGENT_TESTING_GUIDE.md](./AGENT_TESTING_GUIDE.md)
- **Рефакторинг** → [REFACTORING_BACKLOG.md](./REFACTORING_BACKLOG.md)

## 📝 Обновление документации

Документация обновляется по мере развития проекта. При добавлении нового документа:

1. Добавьте его в этот индекс
2. Обновите [docs/README.md](./README.md)
3. Добавьте ссылку в соответствующий раздел [README.md](../README.md)

---

**Последнее обновление:** декабрь 2025
