#!/usr/bin/env bash
# Prepare a clean branch for community PR:
# - starts from upstream/main
# - cherry-picks commit(s) from current branch
#
# Usage:
#   ./scripts/sync-public-private/prepare-community-branch.sh "feat: title"
#   ./scripts/sync-public-private/prepare-community-branch.sh "feat: title" --all-ahead
#
# Env:
#   UPSTREAM_REMOTE default: upstream
#   BASE_BRANCH    default: main
#   COMMUNITY_BRANCH_PREFIX default: community
#
set -euo pipefail

while [[ "${1:-}" == "--" ]]; do
  shift
done

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: $0 \"PR title\" [--all-ahead]" >&2
  echo "  --all-ahead   cherry-pick all non-merge commits from upstream/main..current-branch" >&2
  exit 0
fi

TITLE="${1:-}"
if [[ -z "${TITLE}" ]]; then
  echo "Usage: $0 \"PR title\" [--all-ahead]" >&2
  exit 1
fi
shift || true

ALL_AHEAD=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all-ahead)
      ALL_AHEAD=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
      echo "Usage: $0 \"PR title\" [--all-ahead]" >&2
      exit 1
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run from a git checkout (repository root)." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"
BASE_BRANCH="${BASE_BRANCH:-main}"
BRANCH_PREFIX="${COMMUNITY_BRANCH_PREFIX:-community}"

if ! git remote get-url "${UPSTREAM_REMOTE}" >/dev/null 2>&1; then
  echo "Remote '${UPSTREAM_REMOTE}' is missing." >&2
  echo "Add it first, e.g.:" >&2
  echo "  git remote add upstream https://github.com/Dinkimom/beer-tracker-community.git" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes first." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" == "HEAD" ]]; then
  echo "Detached HEAD; checkout a branch first." >&2
  exit 1
fi

echo "Fetching ${UPSTREAM_REMOTE}/${BASE_BRANCH}..." >&2
git fetch "${UPSTREAM_REMOTE}" "${BASE_BRANCH}"

UPSTREAM_TIP="${UPSTREAM_REMOTE}/${BASE_BRANCH}"
if ! git rev-parse "${UPSTREAM_TIP}" >/dev/null 2>&1; then
  echo "Cannot resolve ${UPSTREAM_TIP} after fetch." >&2
  exit 1
fi

if [[ "${ALL_AHEAD}" -eq 1 ]]; then
  mapfile -t COMMITS < <(git rev-list --reverse --no-merges "${UPSTREAM_TIP}..${CURRENT_BRANCH}")
  if [[ ${#COMMITS[@]} -eq 0 ]]; then
    echo "No non-merge commits ahead of ${UPSTREAM_TIP} on ${CURRENT_BRANCH}." >&2
    exit 1
  fi
else
  COMMITS=("$(git rev-parse HEAD)")
fi

SLUG="$(echo "${TITLE}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-40)"
[[ -z "${SLUG}" ]] && SLUG="contrib"
TARGET_BRANCH="${BRANCH_PREFIX}/${SLUG}"

if git rev-parse --verify "${TARGET_BRANCH}" >/dev/null 2>&1; then
  TS="$(date -u +%Y%m%d%H%M%S)"
  TARGET_BRANCH="${TARGET_BRANCH}-${TS}"
fi

git checkout -b "${TARGET_BRANCH}" "${UPSTREAM_TIP}"

echo "Cherry-picking ${#COMMITS[@]} commit(s) from ${CURRENT_BRANCH}..." >&2
for commit in "${COMMITS[@]}"; do
  git cherry-pick "${commit}"
done

echo "" >&2
echo "Prepared branch: ${TARGET_BRANCH}" >&2
echo "Next step:" >&2
echo "  COMMUNITY_FORK_REMOTE=fork pnpm community:pr -- \"${TITLE}\" --from-current-branch" >&2
