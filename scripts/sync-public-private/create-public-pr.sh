#!/usr/bin/env bash
# Create a branch + PR in a specific PUBLIC GitHub repo (e.g. corporate mirror where
# `origin` is not the public GitHub remote). For a normal public clone, prefer
# contribute.sh (auto-resolves owner/repo).
# Prerequisites: gh CLI, git, clean working tree (or stash).
#
# Env:
#   PUBLIC_REPO       required, e.g. "acme/beer-tracker-public"
#   GH_TOKEN          optional; gh uses it if set (fine-grained PAT or classic PAT with repo scope on PUBLIC only)
#   BASE_BRANCH       optional, default: main
#   HEAD_BRANCH       optional; default auto: corp/<ticket>-<timestamp>
#   SYNC_ID           optional; default: uuidgen
#
# Usage:
#   ./scripts/sync-public-private/create-public-pr.sh TICKET "PR title" [--body-file path]
# After the script checks out a new branch from origin/BASE, apply your commits
# (or the script exits and you run it again from a prepared branch — see below).
#
# Recommended pattern:
#   1) Commit your work on a local branch in the corporate clone.
#   2) TICKET=JIRA-123 ./scripts/sync-public-private/create-public-pr.sh JIRA-123 "fix: …" --from-current-branch
#
set -euo pipefail

TICKET="${1:?Usage: $0 TICKET \"PR title\" [--body-file FILE | --from-current-branch]}"
TITLE="${2:?PR title required}"
shift 2

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

PUBLIC_REPO="${PUBLIC_REPO:?Set PUBLIC_REPO=owner/repo for the public GitHub repo}"
BASE_BRANCH="${BASE_BRANCH:-main}"

if ! command -v git >/dev/null 2>&1; then
  echo "git not found" >&2
  exit 1
fi
if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found (https://cli.github.com/)" >&2
  exit 1
fi

export GH_REPO="${PUBLIC_REPO}"
if [[ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
  export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
fi

TIMESTAMP="$(date -u +%Y%m%d%H%M%S)"
HEAD_BRANCH="${HEAD_BRANCH:-corp/${TICKET}-${TIMESTAMP}}"
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
    echo "Detached HEAD; checkout a branch first" >&2
    exit 1
  fi
  git fetch origin "${BASE_BRANCH}"
  git rebase "origin/${BASE_BRANCH}" || {
    echo "Rebase onto origin/${BASE_BRANCH} failed; resolve and re-run with same branch" >&2
    exit 1
  }
  git push -u origin "${CURRENT_BRANCH}:${HEAD_BRANCH}"
  PR_HEAD="${HEAD_BRANCH}"
else
  git fetch origin "${BASE_BRANCH}"
  git checkout -B "${HEAD_BRANCH}" "origin/${BASE_BRANCH}"
  echo "" >&2
  echo "Checked out ${HEAD_BRANCH} from origin/${BASE_BRANCH}." >&2
  echo "Apply your patch/commits here, then push and run:" >&2
  echo "  git push -u origin ${HEAD_BRANCH}" >&2
  echo "  gh pr create --base ${BASE_BRANCH} --head ${HEAD_BRANCH} --title $(printf %q "${TITLE}") --body-file ..." >&2
  echo "" >&2
  echo "Or re-run with: --from-current-branch (after committing on your feature branch)." >&2
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

## Metadata
- **Sync-ID:** ${SYNC_ID}
- **Ticket:** ${TICKET}
- **Base:** ${BASE_BRANCH}
- **Head:** ${PR_HEAD}
EOF
fi

gh pr create \
  --repo "${PUBLIC_REPO}" \
  --base "${BASE_BRANCH}" \
  --head "${PR_HEAD}" \
  --title "${TITLE}" \
  --body-file "${BODY_PATH}"

echo "Created PR in ${PUBLIC_REPO} (Sync-ID ${SYNC_ID})" >&2
