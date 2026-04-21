# Open-core split runbook

Операционный runbook для публикации community-core из private-репозитория в public.

## Цель

- Синхронизировать public-репозиторий только с разрешённой частью кода (community-core).
- Исключить demo/private артефакты и утечки секретов.
- Сделать процесс повторяемым: local verify -> CI verify -> publish.

## Роли

- **Owner release**: запускает проверку готовности и принимает Go/No-Go.
- **Maintainer private**: вносит изменения в private-репо, держит зелёный CI.
- **Bot/CI**: выполняет publish в public при включённом флаге.

## Предусловия

- Public repo создан и доступен токену с правом push.
- В public есть целевая ветка (`main` или `master`, согласно `PUBLIC_CORE_TARGET_BRANCH`).
- В private настроены секреты/переменные CI:
  - `PUBLIC_CORE_REPO` (`owner/repo`)
  - `PUBLIC_CORE_PUSH_TOKEN` (PAT с write на contents)
  - `OPEN_CORE_PUBLISH=true` (repo variable, только когда готовы публиковать)

## Локальный прогон перед релизом

1. Актуализировать ветку private и установить зависимости.
2. Запустить export:

```bash
pnpm open-core:export -- --out-dir=.open-core-export
```

3. Проверить, что export собирается как отдельный проект:

```bash
cd .open-core-export
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

4. Проверить содержимое вручную:
- нет `app/demo`, `app/api/demo`, `lib/demo`;
- `env.example` соответствует on-prem-only политике;
- нет следов private/enterprise/licensing папок;
- есть обязательные файлы для public repo (`README.md` из шаблона `scripts/open-core/community-core-README.md`, CONTRIBUTING, LICENSE).

5. Вернуться в корень private:

```bash
cd ..
```

## CI-пайплайн (рекомендованный порядок)

1. PR в private проходит `lint + typecheck + tests`.
2. Отдельный verify-job на export (обязательный):
   - `pnpm open-core:export`
   - сборка/типизация в `.open-core-export`.
3. Merge в `master` private.
4. Workflow `publish-community-core` публикует в public (только если `OPEN_CORE_PUBLISH=true`).

## Локальный publish (аварийный/ручной сценарий)

Использовать только если CI-публикация временно недоступна.

```bash
pnpm open-core:publish
```

Что делает команда:
- загружает `PUBLIC_CORE_*` из `.env` через `scripts/open-core/load-open-core-publish-env.mjs` (внутри `publish-community-core.sh`);
- выполняет export;
- проверяет доступ к GitHub repo и наличие target branch;
- коммитит и пушит изменения в public.

## Smoke-check после публикации

В public репозитории:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm build
```

Минимальная проверка руками:
- приложение стартует;
- on-prem onboarding доступен;
- demo-маршруты/страницы отсутствуют или неактивны;
- документация соответствует фактическому поведению.

## Частые проблемы и быстрые решения

- **403 при push**: у токена нет write или не авторизован SSO.
- **404 репозиторий не найден**: неверный `PUBLIC_CORE_REPO` или у токена нет доступа к repo.
- **Target branch not found**: создать initial commit в public и/или выставить `PUBLIC_CORE_TARGET_BRANCH`.
- **Сборка export падает на импортах**: в allow-области остались импорты в deny-пути (например, `@/lib/demo/*`).

## Go/No-Go чеклист

- [ ] Все проверки private зелёные (`lint`, `typecheck`, `test`).
- [ ] Export-артефакт собирается отдельно (`typecheck`, `build`).
- [ ] В export нет demo/private кодовой базы и секретов.
- [ ] Public repo обновился бот-коммитом без ручных правок.
- [ ] Smoke-check public репозитория успешен.

## Ссылки

- Readiness: `docs/OPEN_CORE_SPLIT_READINESS.md`
- Export script: `scripts/open-core/build-community-core-export.ts`
- Publish script: `scripts/open-core/publish-community-core.sh`
- Publish workflow: `.github/workflows/publish-community-core.yml`
