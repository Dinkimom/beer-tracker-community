# Контрибьют в `beer-tracker-community` (пошаговый пример)

Краткий сценарий для private-клона, где `origin` — GitLab, а public-репо доступно как `upstream`.

Канонический public: [github.com/Dinkimom/beer-tracker-community](https://github.com/Dinkimom/beer-tracker-community).

## Предусловия

- Есть remote `upstream` на public-репо:

  ```bash
  git remote add upstream https://github.com/Dinkimom/beer-tracker-community.git
  ```

- В `package.json` есть команда:

  ```bash
  pnpm community:pr
  ```

- `gh` авторизован: `gh auth status`.

## Пример: новая ветка от `upstream/main` + PR

```bash
# 1) Обновляем ссылки на public
git fetch upstream main

# 2) Создаём ветку от текущего public-main
git checkout -b test-contribute upstream/main

# (опционально) Явно фиксируем tracking для ветки
git branch --set-upstream-to=upstream/main test-contribute

# 3) Вносим изменения и коммитим
git add <files>
git commit -s -m "chore: краткое описание"

# 4) Проверяем, что скрипт примет diff (без push/PR)
COMMUNITY_FORK_REMOTE=upstream pnpm community:pr -- "chore: краткое описание" --from-current-branch --dry-run

# 5) Создаём ветку в public и открываем PR
COMMUNITY_FORK_REMOTE=upstream pnpm community:pr -- "chore: краткое описание" --from-current-branch
```

После шага 5 команда выводит URL PR в GitHub.

## Если правки уже сделаны в другой ветке (например, `master`)

Используйте `cherry-pick`:

```bash
git fetch upstream main
git checkout -b test-contribute upstream/main
git cherry-pick <sha1> <sha2> ...
COMMUNITY_FORK_REMOTE=upstream pnpm community:pr -- "chore: ..." --from-current-branch --dry-run
COMMUNITY_FORK_REMOTE=upstream pnpm community:pr -- "chore: ..." --from-current-branch
```

## Частые ошибки

- **`This branch does not contain upstream/main`**  
  Ветка не включает актуальный tip public. Создайте ветку от `upstream/main` заново или сделайте merge/rebase на него.

- **`Refusing: ... OUT_OF_SCOPE`**  
  В diff есть пути вне open-core allow/deny. Нужна более узкая ветка/чистый cherry-pick.

- **Очень много файлов в редакторе**  
  Ориентируйтесь на `git status` и `community:pr --dry-run`; UI может показывать артефакты `.next`/`node_modules`.
