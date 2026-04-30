#!/usr/bin/env bash
# Invoked from package.json: pnpm sync:from-community
# Loads optional .env.community-sync (gitignored), then runs sync-from-public.sh.
#
# Defaults if unset:
#   PRIVATE_REPO_CLONE_URL  — https URL from `git remote origin` (SSH → https://github.com/…)
#   PRIVATE_GIT_TOKEN       — `gh auth token` when gh is logged in
#   PRIVATE_TARGET_BRANCH   — master
#   COMMUNITY_REPO_SLUG     — Dinkimom/beer-tracker-community
#
# Override in .env.community-sync, e.g. PRIVATE_TARGET_BRANCH=main
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${REPO_ROOT}"

ENV_FILE="${COMMUNITY_SYNC_ENV_FILE:-.env.community-sync}"
if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
  set +a
fi

# HTTPS clone URL with .git suffix (downstream-sync expects token injection on host path).
normalize_private_clone_url() {
  local u="$1"
  u="${u%.git}"
  if [[ "${u}" =~ ^git@github\.com:([^/]+)/(.+)$ ]]; then
    u="https://github.com/${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  fi
  if [[ "${u}" == *.git ]]; then echo "${u}"; else echo "${u}.git"; fi
}

if [[ -z "${PRIVATE_REPO_CLONE_URL:-}" ]]; then
  OR="$(git remote get-url origin 2>/dev/null || true)"
  if [[ -z "${OR}" ]]; then
    echo "No git origin and PRIVATE_REPO_CLONE_URL unset. Set ${ENV_FILE} or git remote." >&2
    exit 1
  fi
  PRIVATE_REPO_CLONE_URL="$(normalize_private_clone_url "${OR}")"
fi

if [[ -z "${PRIVATE_GIT_TOKEN:-}" ]]; then
  if command -v gh >/dev/null 2>&1; then
    PRIVATE_GIT_TOKEN="$(gh auth token 2>/dev/null || true)"
  fi
fi
if [[ -z "${PRIVATE_GIT_TOKEN}" ]]; then
  echo "PRIVATE_GIT_TOKEN unset and gh has no token. Set it in ${ENV_FILE} or: gh auth login" >&2
  exit 1
fi

export PRIVATE_REPO_CLONE_URL
export PRIVATE_GIT_TOKEN
export PRIVATE_TARGET_BRANCH="${PRIVATE_TARGET_BRANCH:-master}"

COMMUNITY_SLUG="${COMMUNITY_REPO_SLUG:-Dinkimom/beer-tracker-community}"

exec bash "${REPO_ROOT}/scripts/sync-public-private/sync-from-public.sh" --public-repo "${COMMUNITY_SLUG}"
