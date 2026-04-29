#!/usr/bin/env bash
# Open a contribution PR against this repository (public clone).
# Resolves GitHub owner/repo from `gh` or `git remote origin`.
#
# Prerequisites: git; gh CLI (https://cli.github.com/) authenticated for GitHub.
#
# Env:
#   BASE_BRANCH       target branch for PR (default: main)
#   HEAD_BRANCH       optional explicit head branch name
#   UPSTREAM_REMOTE   remote to rebase onto (default: upstream if present, else origin)
#   SYNC_ID           optional; embedded in PR body for owner tracking
#
# Usage:
#   ./scripts/sync-public-private/contribute.sh "PR title" [--from-current-branch] [--body-file PATH]
#
# Recommended:
#   1) git checkout -b my-fix
#   2) commit your changes
#   3) ./scripts/sync-public-private/contribute.sh "fix: …" --from-current-branch
#
set -euo pipefail

TITLE="${1:?Usage: $0 \"PR title\" [--body-file FILE | --from-current-branch]}"
shift 1

BODY_FILE=""
FROM_CURRENT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --body-file)
      BODY_FILE="${2:?--body-file needs a path}"
      shift 2
      ;;
    --from-current-branch)
      FROM_CURRENT=1
      shift
      ;;
    *)
      echo "Unknown arg: $1" >&2
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

BASE_BRANCH="${BASE_BRANCH:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git not found" >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found (https://cli.github.com/)" >&2
  exit 1
fi

if [[ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
  export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
fi

SELF=""
PARENT=""
if gh repo view >/dev/null 2>&1; then
  SELF="$(gh repo view --json nameWithOwner -q .nameWithOwner)"
  PARENT="$(gh repo view --json parent -q '.parent.nameWithOwner // empty')"
else
  ORIGIN_URL="$(git remote get-url origin 2>/dev/null || true)"
  # https://github.com/owner/repo.git  or  git@github.com:owner/repo.git
  if [[ "${ORIGIN_URL}" =~ github\.com[:/]([^/]+)/([^/.]+)(\.git)?$ ]]; then
    SELF="${BASH_REMATCH[1]}/${BASH_REMATCH[2]}"
  fi
fi

if [[ -z "${SELF}" ]]; then
  echo "Could not resolve GitHub owner/repo. Run inside a clone whose origin is github.com, or:" >&2
  echo "  gh auth login && gh repo view" >&2
  exit 1
fi

BASE_REMOTE="${UPSTREAM_REMOTE:-}"
if [[ -z "${BASE_REMOTE}" ]] && git remote get-url upstream >/dev/null 2>&1; then
  BASE_REMOTE="upstream"
fi
BASE_REMOTE="${BASE_REMOTE:-origin}"

TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
SLUG="$(echo "${TITLE}" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-40)"
[[ -z "${SLUG}" ]] && SLUG="contrib"
HEAD_BRANCH="${HEAD_BRANCH:-contrib/${SLUG}-${TIMESTAMP}}"

if [[ -z "${SYNC_ID:-}" ]]; then
  if command -v uuidgen >/dev/null 2>&1; then
    SYNC_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
  else
    SYNC_ID="$(openssl rand -hex 16)"
  fi
fi

if [[ "${FROM_CURRENT}" -eq 1 ]]; then
  CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "${CURRENT_BRANCH}" == "HEAD" ]]; then
    echo "Detached HEAD; checkout a branch first." >&2
    exit 1
  fi
  git fetch "${BASE_REMOTE}" "${BASE_BRANCH}"
  git rebase "${BASE_REMOTE}/${BASE_BRANCH}" || {
    echo "Rebase onto ${BASE_REMOTE}/${BASE_BRANCH} failed; resolve conflicts and retry." >&2
    exit 1
  }
  git push -u origin "${CURRENT_BRANCH}:${HEAD_BRANCH}"
  PR_HEAD="${HEAD_BRANCH}"
else
  git fetch "${BASE_REMOTE}" "${BASE_BRANCH}"
  git checkout -B "${HEAD_BRANCH}" "${BASE_REMOTE}/${BASE_BRANCH}"
  echo "" >&2
  echo "Checked out ${HEAD_BRANCH} from ${BASE_REMOTE}/${BASE_BRANCH}." >&2
  echo "Make commits, then:" >&2
  echo "  git push -u origin ${HEAD_BRANCH}" >&2
  echo "  gh pr create --repo <upstream> --base ${BASE_BRANCH} --head <fork>:${HEAD_BRANCH} …" >&2
  echo "" >&2
  echo "Or run again with --from-current-branch after committing on your branch." >&2
  exit 10
fi

if [[ -n "${BODY_FILE}" ]]; then
  BODY_PATH="${BODY_FILE}"
else
  BODY_PATH="$(mktemp)"
  trap 'rm -f "${BODY_PATH}"' EXIT
  cat >"${BODY_PATH}" <<EOF
## Summary
${TITLE}

## Contributor metadata
- **Sync-ID:** ${SYNC_ID}
- **Base:** ${BASE_BRANCH}
- **Head:** ${PR_HEAD}
EOF
fi

PR_REPO="${SELF}"
HEAD_FOR_PR="${PR_HEAD}"
if [[ -n "${PARENT}" ]]; then
  PR_REPO="${PARENT}"
  HEAD_FOR_PR="${SELF}:${PR_HEAD}"
fi

gh pr create \
  --repo "${PR_REPO}" \
  --base "${BASE_BRANCH}" \
  --head "${HEAD_FOR_PR}" \
  --title "${TITLE}" \
  --body-file "${BODY_PATH}"

echo "Opened PR on ${PR_REPO} (head ${HEAD_FOR_PR}, Sync-ID ${SYNC_ID}). Maintainer merges to ${BASE_BRANCH}; private sync is owner-side (see docs/sync-public-private/README.md)." >&2
