#!/usr/bin/env bash
# Open a GitHub pull request against the canonical community repo from a clone where
# `origin` may be private (e.g. GitLab): push branch to your GitHub fork, then `gh pr create`.
#
# Safety: requires a clean tree, branch that already contains the tip of public main
# (no commits missing from upstream — sync first). Raw `git diff` vs public can list
# 10k+ paths on private master; previews use the same path set as open-core export
# (community-core-allow.json + deny). Fails if any changed path is outside that scope.
#
# Prerequisites: git; gh CLI (https://cli.github.com/) with auth to GitHub; a remote
# that points to YOUR fork of beer-tracker-community (push access), or `upstream`
# if you push to the canonical repo as maintainer.
#
# Env:
#   COMMUNITY_FORK_REMOTE  optional — git remote name for the fork (e.g. `fork`) or `upstream`
#   COMMUNITY_PUBLIC_REPO  default: Dinkimom/beer-tracker-community (owner/repo for gh)
#   UPSTREAM_REMOTE        default: upstream — tracks canonical public main
#   BASE_BRANCH            default: main
#   HEAD_BRANCH            optional — auto if omitted
#   SYNC_ID                optional — embedded in PR body
#   COMMUNITY_PR_ALLOW_DIRTY=1           allow dirty working tree (not recommended)
#   COMMUNITY_PR_MAX_FILES=200          max paths in diff vs public (0 = no limit)
#   COMMUNITY_PR_SKIP_FILE_LIMIT=1      disable max-files check
#   COMMUNITY_PR_SKIP_SCOPE_FILTER=1   skip open-core path filter (dangerous; raw diff in preview)
#   COMMUNITY_PR_DRY_RUN=1               only fetch + checks + print diff (no push / no gh)
#   COMMUNITY_PR_CONFIRM_THRESHOLD=15   above this many paths, require COMMUNITY_PR_CONFIRM=1 to push
#   COMMUNITY_PR_CONFIRM=1              you reviewed printed diff/stat and accept push + PR
#   COMMUNITY_PR_DIFF_PREVIEW_LINES=120  max lines of `git diff` preview printed before push
#
# Usage:
#   ./scripts/sync-public-private/contribute-to-community.sh ["PR title"] [--body-file PATH] [--dry-run]
#   COMMUNITY_FORK_REMOTE=fork ./scripts/sync-public-private/contribute-to-community.sh "PR title" --from-current-branch
# If title is omitted, the script uses the subject of the last commit.
# Interactive prompts (title + confirm) are handled by `community-pr-cli.ts` (`pnpm community:pr`).
#
set -euo pipefail

# `pnpm run community:pr -- "title"` forwards a literal `--` as $1; strip it.
while [[ "${1:-}" == "--" ]]; do
  shift
done

TITLE=""
BODY_FILE=""
FROM_CURRENT=1
DRY_RUN="${COMMUNITY_PR_DRY_RUN:-0}"
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
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    *)
      if [[ -z "${TITLE}" ]]; then
        TITLE="$1"
        shift
      else
        echo "Unknown arg: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Run from a git checkout (repository root)." >&2
  exit 1
fi

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "${REPO_ROOT}"

if [[ -z "${TITLE}" ]]; then
  TITLE="$(git log -1 --pretty=%s 2>/dev/null || true)"
fi
if [[ -z "${TITLE}" ]]; then
  echo "Could not resolve PR title. Pass it explicitly, e.g.:" >&2
  echo "  pnpm community:pr -- \"feat: ...\"" >&2
  exit 1
fi

FORK_REMOTE="${COMMUNITY_FORK_REMOTE:-${FORK_REMOTE:-}}"
if [[ -z "${FORK_REMOTE}" ]]; then
  if git remote get-url fork >/dev/null 2>&1; then
    FORK_REMOTE="fork"
    echo "[community:pr] Using push remote 'fork' (auto: remote exists)." >&2
  else
    FORK_REMOTE="upstream"
    echo "[community:pr] Using push remote '${FORK_REMOTE}' (auto: no 'fork' remote)." >&2
  fi
fi

PUBLIC_REPO="${COMMUNITY_PUBLIC_REPO:-Dinkimom/beer-tracker-community}"
BASE_BRANCH="${BASE_BRANCH:-main}"
UPSTREAM_REMOTE="${UPSTREAM_REMOTE:-upstream}"

if ! command -v git >/dev/null 2>&1; then
  echo "git not found" >&2
  exit 1
fi

if ! git remote get-url "${UPSTREAM_REMOTE}" >/dev/null 2>&1; then
  echo "Remote '${UPSTREAM_REMOTE}' is missing. Add the public repo, e.g.:" >&2
  echo "  git remote add upstream https://github.com/Dinkimom/beer-tracker-community.git" >&2
  exit 1
fi

if ! git remote get-url "${FORK_REMOTE}" >/dev/null 2>&1; then
  if [[ "${FORK_REMOTE}" == "fork" ]]; then
    if ! command -v gh >/dev/null 2>&1; then
      echo "Remote 'fork' is not configured and gh CLI is missing." >&2
      echo "Install gh (https://cli.github.com/) or add fork manually:" >&2
      echo "  git remote add fork git@github.com:YOU/beer-tracker-community.git" >&2
      exit 1
    fi

    if ! gh auth status >/dev/null 2>&1; then
      echo "Remote 'fork' is not configured and GitHub auth is missing." >&2
      echo "Run: gh auth login" >&2
      echo "Then retry community:pr (the script will auto-configure 'fork')." >&2
      exit 1
    fi

    GH_LOGIN="$(gh api user -q .login 2>/dev/null || true)"
    if [[ -z "${GH_LOGIN}" ]]; then
      echo "Remote 'fork' is not configured and GitHub username could not be resolved from gh." >&2
      echo "Run: gh auth login" >&2
      echo "Or configure remote manually:" >&2
      echo "  git remote add fork git@github.com:YOU/beer-tracker-community.git" >&2
      exit 1
    fi

    git remote add fork "git@github.com:${GH_LOGIN}/beer-tracker-community.git"
    echo "[community:pr] Auto-configured remote 'fork' -> git@github.com:${GH_LOGIN}/beer-tracker-community.git" >&2
  else
    echo "Remote '${FORK_REMOTE}' is not configured." >&2
    echo "Add a GitHub fork, e.g.: git remote add fork git@github.com:YOU/beer-tracker-community.git" >&2
    echo "Or set COMMUNITY_FORK_REMOTE to the remote name you push to." >&2
    exit 1
  fi
fi

if [[ "${DRY_RUN}" -eq 0 ]] && ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI not found (https://cli.github.com/)" >&2
  exit 1
fi

if [[ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]]; then
  export GH_TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
fi

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

fork_owner_from_url() {
  local url="$1"
  local s="${url}"
  s="${s#https://github.com/}"
  s="${s#http://github.com/}"
  s="${s#git@github.com:}"
  s="${s%.git}"
  echo "${s%%/*}"
}

FORK_URL="$(git remote get-url "${FORK_REMOTE}")"
FORK_OWNER="$(fork_owner_from_url "${FORK_URL}")"
if [[ -z "${FORK_OWNER}" || "${FORK_OWNER}" == "${FORK_URL}" ]]; then
  echo "Could not parse GitHub owner from ${FORK_REMOTE} URL: ${FORK_URL}" >&2
  echo "Use an https://github.com/OWNER/... or git@github.com:OWNER/... remote." >&2
  exit 1
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "${CURRENT_BRANCH}" == "HEAD" ]]; then
  echo "Detached HEAD; checkout a branch first." >&2
  exit 1
fi

if [[ -z "${COMMUNITY_PR_ALLOW_DIRTY:-}" ]] && [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash, or set COMMUNITY_PR_ALLOW_DIRTY=1 (not recommended)." >&2
  exit 1
fi

echo "Fetching ${UPSTREAM_REMOTE}/${BASE_BRANCH}..." >&2
git fetch "${UPSTREAM_REMOTE}" "${BASE_BRANCH}"

UPSTREAM_TIP="${UPSTREAM_REMOTE}/${BASE_BRANCH}"
if ! git rev-parse "${UPSTREAM_TIP}" >/dev/null 2>&1; then
  echo "Cannot resolve ${UPSTREAM_TIP} after fetch." >&2
  exit 1
fi

if ! git merge-base --is-ancestor "${UPSTREAM_TIP}" HEAD; then
  echo "This branch does not contain ${UPSTREAM_TIP} (public main is not in your history)." >&2
  echo "Create a topic branch from current public main, cherry-pick or port changes, then retry." >&2
  exit 1
fi

if ! counts="$(git rev-list --left-right --count "${UPSTREAM_TIP}...HEAD" 2>/dev/null)"; then
  echo "Could not compare ${UPSTREAM_TIP} with HEAD (unrelated histories?)." >&2
  exit 1
fi
read -r left right <<<"${counts}"
if [[ "${left}" -gt 0 ]]; then
  echo "Branch is behind public by ${left} commit(s) on ${UPSTREAM_TIP}." >&2
  echo "Sync first, e.g. merge or rebase onto ${UPSTREAM_TIP}, then retry (pnpm sync:upstream on a dedicated branch if that fits your flow)." >&2
  exit 1
fi

RAW_DIFF_LIST="$(mktemp)"
SCOPED_LIST="$(mktemp)"
OUTSIDE_ERR="$(mktemp)"
INTERNAL_BODY=""
cleanup_contrib_pr() {
  rm -f "${RAW_DIFF_LIST}" "${SCOPED_LIST}" "${OUTSIDE_ERR}"
  if [[ -n "${INTERNAL_BODY:-}" ]]; then
    rm -f "${INTERNAL_BODY}"
  fi
}
trap cleanup_contrib_pr EXIT

git diff --name-only "${UPSTREAM_TIP}...HEAD" >"${RAW_DIFF_LIST}"
if ! grep -q . "${RAW_DIFF_LIST}"; then
  echo "No file changes vs ${UPSTREAM_TIP} — nothing to open a PR for." >&2
  exit 1
fi

raw_count="$(grep -c . "${RAW_DIFF_LIST}" || true)"

if [[ -n "${COMMUNITY_PR_SKIP_SCOPE_FILTER:-}" ]]; then
  echo "WARNING: COMMUNITY_PR_SKIP_SCOPE_FILTER=1 — preview uses full raw diff (${raw_count} paths), not open-core scope." >&2
  cp "${RAW_DIFF_LIST}" "${SCOPED_LIST}"
else
  set +e
  pnpm exec tsx scripts/open-core/filter-community-pr-paths.ts <"${RAW_DIFF_LIST}" >"${SCOPED_LIST}" 2>"${OUTSIDE_ERR}"
  filter_status=$?
  set -e
  if [[ "${filter_status}" -ne 0 ]]; then
    echo "open-core path filter failed (tsx). Fix the error above." >&2
    exit 1
  fi
  if grep -q '^OUT_OF_SCOPE' "${OUTSIDE_ERR}"; then
    outside_n="$(grep -c '^OUT_OF_SCOPE' "${OUTSIDE_ERR}" || true)"
    echo "" >&2
    echo "Refusing: ${outside_n} changed path(s) are outside community export scope (community-core-allow + deny)." >&2
    echo "Use a topic branch from ${UPSTREAM_TIP} that only touches open-core paths, or split the change." >&2
    sed -n '1,50p' "${OUTSIDE_ERR}" >&2
    echo "Emergency only: COMMUNITY_PR_SKIP_SCOPE_FILTER=1 (previews entire raw diff)." >&2
    exit 1
  fi
fi

if ! grep -q . "${SCOPED_LIST}"; then
  echo "No paths remain in open-core scope (${raw_count} raw path(s) vs ${UPSTREAM_TIP} were all outside allow/deny export rules)." >&2
  exit 1
fi

file_count="$(grep -c . "${SCOPED_LIST}" || true)"
echo "--- Raw paths vs ${UPSTREAM_TIP}: ${raw_count}; open-core scoped: ${file_count} ---" >&2

MAX_FILES="${COMMUNITY_PR_MAX_FILES:-200}"
if [[ "${MAX_FILES}" != "0" ]] && [[ -z "${COMMUNITY_PR_SKIP_FILE_LIMIT:-}" ]] && [[ "${file_count}" -gt "${MAX_FILES}" ]]; then
  echo "Scoped diff vs ${UPSTREAM_TIP} touches ${file_count} paths (limit ${MAX_FILES})." >&2
  echo "Use a narrower topic branch from public main, or set COMMUNITY_PR_SKIP_FILE_LIMIT=1 if you accept the risk." >&2
  exit 1
fi

echo "--- Paths in open-core PR scope (${file_count}) ---" >&2
head -50 "${SCOPED_LIST}" >&2
if [[ "${file_count}" -gt 50 ]]; then
  echo "... ($((file_count - 50)) more)" >&2
fi

# Apple Git and older releases lack `git diff --pathspec-from-file`; use merge-base + explicit paths.
MERGE_BASE="$(git merge-base "${UPSTREAM_TIP}" HEAD)"

echo "" >&2
echo "========== git diff --stat (open-core paths only; merge-base ${MERGE_BASE}) ==========" >&2
_batch=()
while IFS= read -r line || [[ -n "${line}" ]]; do
  [[ -z "${line}" ]] && continue
  _batch+=("$line")
  if [[ ${#_batch[@]} -ge 80 ]]; then
    git diff --stat "${MERGE_BASE}" HEAD -- "${_batch[@]}" >&2 || true
    _batch=()
  fi
done <"${SCOPED_LIST}"
if [[ ${#_batch[@]} -gt 0 ]]; then
  git diff --stat "${MERGE_BASE}" HEAD -- "${_batch[@]}" >&2 || true
fi

PREVIEW_LINES="${COMMUNITY_PR_DIFF_PREVIEW_LINES:-120}"
echo "" >&2
echo "========== git diff preview (open-core paths, up to ${PREVIEW_LINES} lines) ==========" >&2
set +o pipefail
{
  _batch=()
  while IFS= read -r line || [[ -n "${line}" ]]; do
    [[ -z "${line}" ]] && continue
    _batch+=("$line")
    if [[ ${#_batch[@]} -ge 80 ]]; then
      git diff "${MERGE_BASE}" HEAD -- "${_batch[@]}" 2>/dev/null || true
      _batch=()
    fi
  done <"${SCOPED_LIST}"
  if [[ ${#_batch[@]} -gt 0 ]]; then
    git diff "${MERGE_BASE}" HEAD -- "${_batch[@]}" 2>/dev/null || true
  fi
} | head -n "${PREVIEW_LINES}" >&2 || true
set -o pipefail

unset _batch 2>/dev/null || true

CONFIRM_THRESHOLD="${COMMUNITY_PR_CONFIRM_THRESHOLD:-15}"
if [[ "${DRY_RUN}" -eq 1 ]]; then
  echo "" >&2
  echo "COMMUNITY_PR_DRY_RUN / --dry-run: stopping before push and gh pr create." >&2
  exit 0
fi

if [[ "${file_count}" -gt "${CONFIRM_THRESHOLD}" ]] && [[ "${COMMUNITY_PR_CONFIRM:-}" != "1" ]]; then
  echo "" >&2
  echo "Refusing push: ${file_count} paths exceed confirm threshold (${CONFIRM_THRESHOLD})." >&2
  echo "Review the diff/stat above, then re-run with COMMUNITY_PR_CONFIRM=1 if this scope is intended." >&2
  echo "To inspect only: add --dry-run or COMMUNITY_PR_DRY_RUN=1." >&2
  exit 1
fi

git push -u "${FORK_REMOTE}" "${CURRENT_BRANCH}:${HEAD_BRANCH}"

if [[ -n "${BODY_FILE}" ]]; then
  BODY_PATH="${BODY_FILE}"
else
  BODY_PATH="$(mktemp)"
  INTERNAL_BODY="${BODY_PATH}"
  {
    echo "## Summary"
    echo "${TITLE}"
    echo ""
    echo "## Contributor metadata"
    echo "- **Sync-ID:** ${SYNC_ID}"
    echo "- **Public base:** ${PUBLIC_REPO}@${BASE_BRANCH} (merge-base range \`${UPSTREAM_TIP}...HEAD\`)"
    echo "- **Fork remote:** ${FORK_REMOTE}"
    echo "- **Head:** ${FORK_OWNER}:${HEAD_BRANCH}"
    echo "- **Raw paths vs public:** ${raw_count}"
    echo "- **Open-core scoped paths:** ${file_count}"
    echo '```'
    head -120 "${SCOPED_LIST}"
    if [[ "${file_count}" -gt 120 ]]; then
      echo "... ($((file_count - 120)) more paths)"
    fi
    echo '```'
  } >"${BODY_PATH}"
fi

gh pr create \
  --repo "${PUBLIC_REPO}" \
  --base "${BASE_BRANCH}" \
  --head "${FORK_OWNER}:${HEAD_BRANCH}" \
  --title "${TITLE}" \
  --body-file "${BODY_PATH}"

echo "Opened PR on ${PUBLIC_REPO} (head ${FORK_OWNER}:${HEAD_BRANCH}, Sync-ID ${SYNC_ID})." >&2
