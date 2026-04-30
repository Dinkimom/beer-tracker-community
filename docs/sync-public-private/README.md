# Публичный клон → PR → синк в приватный (без GitLab API)

Канонический **public**-репозиторий на GitHub: **[Dinkimom/beer-tracker-community](https://github.com/Dinkimom/beer-tracker-community)**. Для [`create-public-pr.sh`](../../scripts/sync-public-private/create-public-pr.sh) из контура без `origin` на этот URL задайте `PUBLIC_REPO=Dinkimom/beer-tracker-community`.

Схема без привязки к GitLab: **кто угодно с клоном public-репозитория** открывает PR через скрипт контрибьюта; **owner** ревьюит и мерджит в `main`; подтягивание в **private** делается только на стороне owner (локально или CI с секретами), без вызовов forge API для MR.

См. также поток **private → public** (open-core): [`docs/OPEN_CORE_SPLIT_RUNBOOK.md`](../OPEN_CORE_SPLIT_RUNBOOK.md).

## Поток end-to-end

1. Контрибьютор клонирует **public** репозиторий с GitHub.
2. Вносит правки, затем запускает [`scripts/sync-public-private/contribute.sh`](../../scripts/sync-public-private/contribute.sh) (ветка + `gh pr create`), либо делает то же вручную.
3. Вы в public: ревью, approve, merge в `main`.
4. Вы (или доверенный CI в public с секретами на private): запускаете [`scripts/sync-public-private/downstream-sync.sh`](../../scripts/sync-public-private/downstream-sync.sh) — накладывается diff `before..after` из public, пушится ветка `public-sync/<sha>` в **private**; при необходимости MR в private открываете **вручную** в своём forge.

## Итоговый сценарий (рекомендуемый)

Ниже самый простой операционный процесс для owner после merge PR в community:

1. В private-репо запустите:

```bash
pnpm sync:from-community
```

2. Если в выводе:
   - **`Nothing new on origin/main`** — синк не требуется, всё уже подтянуто.
   - **успешный push ветки `public-sync/<sha>`** — PR в private создастся автоматически (для GitHub) при `pnpm sync:from-community`. Если PR для этой ветки уже есть, скрипт переиспользует его и выведет URL.
   - **конфликт (exit code 2)** — остаётесь в ветке `public-sync/<sha>`, решаете конфликты в IDE:
     - `git status`
     - правки файлов с `<<<<<<<`
     - `git add -A`
     - `git commit -m "sync(public): resolve conflicts ..."`
     - `git push -u origin HEAD` (после push уже созданный PR обновится автоматически)

3. Смерджите PR в private. После merge private снова становится источником истины.

### Важные детали

- Команда по умолчанию работает **в текущем private-клоне** и автоматически переключает вас на `public-sync/<sha>`.
- Локальные незакоммиченные изменения перед синком автоматически убираются в stash и восстанавливаются после завершения (`PRIVATE_AUTO_STASH=1` по умолчанию в `pnpm sync:from-community`).
- State-файл `~/.local/state/beer-tracker/last-public-main-<owner-repo>.sha` хранит последний синканный tip public `main`.
- Авто-PR можно отключить: `PRIVATE_CREATE_PR=0 pnpm sync:from-community`.

Корпоративный контур без `origin` на public GitHub может по-прежнему использовать [`scripts/sync-public-private/create-public-pr.sh`](../../scripts/sync-public-private/create-public-pr.sh) с переменной `PUBLIC_REPO=Dinkimom/beer-tracker-community` (или другим slug при смене org/repo).

## Предусловия

- Истории **public и private** по затронутым путям совместимы (иначе `git apply --3way` часто конфликтует).
- Контрибьютору нужны **git** и **GitHub CLI** (`gh`), авторизованный для создания PR в public (fork или права на репо — по вашей политике). Для **fork** добавьте remote `upstream` на основной репозиторий — `contribute.sh` сам возьмёт его для `fetch`/`rebase`, а в PR подставит `--repo upstream` и `--head fork:ветка`.

## Секреты (только для owner / CI downstream)

| Имя | Назначение |
|-----|------------|
| `PRIVATE_REPO_CLONE_URL` | HTTPS URL private без токена в URL, например `https://github.com/org/private.git` |
| `PRIVATE_GIT_TOKEN` | PAT с правом clone + push веток `public-sync/*` |
| `PRIVATE_USE_GITHUB_TOKEN_AUTH` | Для GitHub Enterprise: `1` (см. комментарии в `downstream-sync.sh`) |

В **public** GitHub Actions не обязательны: можно не хранить токен private в public и гонять `downstream-sync.sh` только на своей машине после merge.

## Чеклист GitHub (public)

- Защита `main`: PR, checks, без force-push.
- Не вешать секреты private на `pull_request` из форков; если используете workflow на `push` в `main`, секреты доступны только после merge в доверенную ветку.

## Скрипты

| Скрипт | Кто запускает |
|--------|----------------|
| [`contribute.sh`](../../scripts/sync-public-private/contribute.sh) | Любой с клоном public + `gh` |
| [`create-public-pr.sh`](../../scripts/sync-public-private/create-public-pr.sh) | Контур, где задан `PUBLIC_REPO`, если `origin` не указывает на public |
| [`downstream-sync.sh`](../../scripts/sync-public-private/downstream-sync.sh) | Только owner / CI с доступом к private |

## Шаблоны тел PR

- PR в public: [`templates/public-pr-body.md`](templates/public-pr-body.md)
- Текст MR в private (если открываете руками): [`templates/private-mr-body.md`](templates/private-mr-body.md)

## `contribute.sh` без `--from-current-branch`

Скрипт создаёт ветку от `origin/${BASE_BRANCH}` и завершается с кодом **10** — дальше коммиты, `git push`, `gh pr create`. Основной сценарий: **`--from-current-branch`** после коммита на своей ветке.

## Автоматический диапазон SHA

1. **GitHub Actions** в public на `push` в `main`: в job доступны `github.event.before` и `github.event.after` — их передают в `downstream-sync.sh` как `BEFORE_SHA` / `AFTER_SHA` (см. шаблон [`.github/workflows/downstream-private-sync.template.yml`](../../.github/workflows/downstream-private-sync.template.yml)). Отдельно считать диапазон не нужно.

2. **Локально / вручную** — обёртка [`scripts/sync-public-private/sync-from-public.sh`](../../scripts/sync-public-private/sync-from-public.sh):
   - **`--public-repo owner/repo`** — сам клонирует или делает `fetch` в кэш (по умолчанию `~/.cache/beer-tracker/public-git/<owner-repo>`), без других флагов включает **авто state-файл** в `~/.local/state/beer-tracker/last-public-main-<owner-repo>.sha`. **Первый запуск** без этого файла только **создаёт** его с текущим tip `main` и выходит (downstream не гоняется); следующие запуски синкают новые коммиты.
   - **`--merge <sha>`** — при необходимости вместе с **`--public-dir`** или после своего клона: `BEFORE=<sha>^`, `AFTER=<sha>`.
   - **`--since-state <файл>`** — свой маркер + **`--public-dir`** или **`--public-repo`**.
   - **`--github-before` / `--github-after`** — как в Actions.

Из корня **private**-монорепо одной командой (подставляет `origin`, токен из `gh`, ветку `master` по умолчанию; опционально переопределения в **`.env.community-sync`**, файл в `.gitignore`):

```bash
pnpm sync:from-community
```

Команда работает в вашем локальном private-клоне: автоматически делает checkout на `public-sync/<sha>` от `origin/<PRIVATE_TARGET_BRANCH>` и применяет patch. Если возникли конфликты, скрипт старается оставить обычные merge-маркеры (`<<<<<<<`) прямо в файлах, чтобы решать в текущей ветке через стандартный git (`status` → правки → `add` → `commit` → `push`).  
Требование: рабочее дерево private-клона должно быть чистым перед запуском (без незакоммиченных изменений).  
Нужен старый изолированный режим через `.sync/community-conflicts` — задайте `PRIVATE_LOCAL_REPO_DIR=""` и `PRIVATE_SYNC_WORKDIR=.sync/community-conflicts`.

Пример после известного merge-коммита на public (свой клон):

```bash
export PRIVATE_REPO_CLONE_URL='https://github.com/org/private.git'
export PRIVATE_GIT_TOKEN='***'
export PRIVATE_TARGET_BRANCH=master   # если не main
./scripts/sync-public-private/sync-from-public.sh \
  --public-dir ~/beer-tracker-community \
  --merge 2b7c7c143be4218d8464eb8f844814aaf5dd5e4e
```

## Локальный smoke downstream (явные SHA)

```bash
export PUBLIC_DIR="$PWD"   # корень public-клона с полной историей для diff
export BEFORE_SHA='<commit-before-merge>'
export AFTER_SHA='<commit-after-merge>'
export PRIVATE_REPO_CLONE_URL='https://github.com/org/private.git'
export PRIVATE_GIT_TOKEN='***'
./scripts/sync-public-private/downstream-sync.sh
```

## Коды выхода `downstream-sync.sh`

| Код | Значение |
|-----|----------|
| 0 | Успех или нечего синкать (пустой diff) |
| 1 | Ошибка окружения/клона |
| 2 | Конфликт при `git apply` |

## Идемпотентность

Если ветка `public-sync/<after>` уже есть на `origin` private, скрипт завершается успехом без повторного пуша.
