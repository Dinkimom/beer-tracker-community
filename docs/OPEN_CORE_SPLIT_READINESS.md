# Open-core split readiness

Документ фиксирует текущий статус разделения private/community-core и служит чек-листом перед финальной публикацией.

## Текущий статус

- Экспорт и публикация автоматизированы (`pnpm open-core:export`, `pnpm open-core:publish`).
- Для публикации добавлен безопасный загрузчик env только для `PUBLIC_CORE_*`.
- Demo-роуты и demo-библиотека исключаются из экспорта через deny-list.
- Шаблон `env.example` в export заменён на on-prem-only вариант.

## Что уже закрыто

- Есть allow/deny-манифесты: `scripts/open-core/community-core-allow.json`, `scripts/open-core/community-core-deny-pathPrefixes.txt`.
- Есть leak-scan при экспорте в `scripts/open-core/build-community-core-export.ts`.
- Есть CI workflow публикации: `.github/workflows/publish-community-core.yml`.
- Экспорт подставляет community env-шаблон:
  - источник: `scripts/open-core/community-core-env.example`
  - результат: `.open-core-export/env.example`

## Критические блокеры (P0)

1. **P0 блокеров не осталось (на текущем ревизионном срезе)**
   - Общие импорты в `@/lib/demo/*` убраны из shared-слоя.
   - Добавлен отдельный CI gate `verify-community-export` в publish workflow.
   - Export-артефакт проверен как standalone (`install + typecheck + build`).

## Важные доработки (P1)

1. **Лицензия в public export**
   - Закрыто: в export подставляется проприетарный `LICENSE` (шаблон `scripts/open-core/community-core-LICENSE`, по смыслу как в корне репозитория).
   - В `.open-core-export/package.json` выставляется `"license": "UNLICENSED"` (условия — в файле `LICENSE`).

2. **Проверка политики `package.json` для public**
   - Сверить, корректно ли оставлять `"private": true` в публикуемом репозитории.

3. **Явный release checklist для split**
   - Зафиксировать последовательность: export -> verify -> publish -> smoke-check public repo.

## Рекомендуемый план закрытия

1. Завершить финальный quality gate в private:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`
2. Проверить готовность публикации:
   - `PUBLIC_CORE_REPO`, `PUBLIC_CORE_PUSH_TOKEN`, `PUBLIC_CORE_TARGET_BRANCH`
   - repository variable `OPEN_CORE_PUBLISH` = `true` только на период публикации (не Secret — см. runbook)
3. Выполнить publish и smoke-check public репозитория:
   - `pnpm install --frozen-lockfile`
   - `pnpm typecheck`
   - `pnpm build`
4. Зафиксировать результаты smoke-check в MR/релизных заметках.

## Критерии готовности (Go/No-Go)

- [x] Export-артефакт (`.open-core-export`) собирается без ошибок как отдельный проект.
- [x] В export отсутствуют demo/private артефакты и секреты.
- [x] В export присутствует корректная лицензия и актуальная документация запуска.
- [ ] Публикация в public репозиторий проходит без ручных правок.
- [ ] Smoke-check public `main/master`: install + build + базовый запуск.

## Связанные документы

- Runbook: `docs/OPEN_CORE_SPLIT_RUNBOOK.md`

## Быстрые команды проверки

```bash
pnpm open-core:export -- --out-dir=.open-core-export
cd .open-core-export
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Если любой шаг падает, публиковать в public repo нельзя.
