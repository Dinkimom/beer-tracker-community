#!/usr/bin/env bash
# Remove common build / dependency trees from the git index only (files stay on disk).
# Run from repo root; then review `git status` and commit if anything was unstaged from tracking.
#
# Does not delete local folders — only stops tracking paths that should rely on .gitignore.
#
set -euo pipefail

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

ROOT="$(git rev-parse --show-toplevel)"
cd "${ROOT}"

# Keep in sync with typical noise in community-core-deny-pathPrefixes.txt + local dev stacks.
ARTIFACTS=(
  .next
  node_modules
  .open-core-export
  coverage
  storybook-static
  .pnpm-store
  .vercel
)

removed_any=0
for rel in "${ARTIFACTS[@]}"; do
  if git ls-files -- "${rel}" 2>/dev/null | head -1 | grep -q .; then
    count="$(git ls-files -- "${rel}" 2>/dev/null | wc -l | tr -d ' ')"
    echo "Removing ${count} tracked path(s) from index: ${rel}/" >&2
    git rm -rq --cached --ignore-unmatch -- "${rel}"
    removed_any=1
  fi
done

if [[ "${removed_any}" -eq 0 ]]; then
  echo "Nothing to do: none of these paths are tracked in git: ${ARTIFACTS[*]}" >&2
  exit 0
fi

echo "" >&2
echo "Done. Files are still on disk; only the git index was updated." >&2
echo "Next: git status — then commit, e.g. git commit -m \"chore: stop tracking build artifacts\"" >&2
