#!/usr/bin/env bash
# After merge to public default branch: apply the same file-level diff into a private
# clone and push branch public-sync/<after_sha>. For maintainers / CI with secrets only.
#
# Typical GitHub Actions env (push to main):
#   PUBLIC_DIR          path to public checkout (default: $GITHUB_WORKSPACE)
#   BEFORE_SHA          github.event.before
#   AFTER_SHA           github.event.after
#
# Private remote (HTTPS; token is not persisted in git config):
#   PRIVATE_REPO_CLONE_URL   e.g. https://github.com/org/private.git
#   PRIVATE_GIT_TOKEN        PAT (GitHub: classic or fine-grained with contents: write)
#   PRIVATE_TARGET_BRANCH    default: main
#
# Clone auth (PAT in URL):
#   PRIVATE_USE_GITHUB_TOKEN_AUTH   auto | 0 | 1
#     auto: x-access-token only when host is exactly github.com
#     1:    always x-access-token (GitHub Enterprise HTTPS clone)
#     0:    oauth2:user (some non-GitHub forges)
#
# Optional commit message metadata:
#   PUBLIC_REPO_SLUG   e.g. acme/repo
#   SYNC_ID            from contributor PR body
#   UPSTREAM_PR_URL    merged public PR link
# Patch shaping:
#   SYNC_EXCLUDE_PATHS comma-separated pathspec excludes (default: OPEN_CORE_EXPORT_META.json)
# Conflict/debug ergonomics:
#   KEEP_WORKDIR_ON_ERROR=1   do not delete workdir on non-zero exit
#   PRIVATE_SYNC_WORKDIR=PATH use explicit workdir path (reused/cleaned each run)
# Local private checkout mode (recommended for manual conflict resolution in IDE):
#   PRIVATE_LOCAL_REPO_DIR=PATH   use existing private clone instead of temp clone
#                                 (requires clean working tree; auto checkout public-sync/<sha>)
#
set -euo pipefail

PUBLIC_DIR="${PUBLIC_DIR:-${GITHUB_WORKSPACE:-}}"
BEFORE_SHA="${BEFORE_SHA:?Set BEFORE_SHA (e.g. github.event.before)}"
AFTER_SHA="${AFTER_SHA:?Set AFTER_SHA (e.g. github.event.after)}"
PRIVATE_REPO_CLONE_URL="${PRIVATE_REPO_CLONE_URL:?Set PRIVATE_REPO_CLONE_URL}"
PRIVATE_GIT_TOKEN="${PRIVATE_GIT_TOKEN:?Set PRIVATE_GIT_TOKEN}"
PRIVATE_TARGET_BRANCH="${PRIVATE_TARGET_BRANCH:-main}"
PRIVATE_LOCAL_REPO_DIR="${PRIVATE_LOCAL_REPO_DIR:-}"

if [[ -z "${PUBLIC_DIR}" || ! -d "${PUBLIC_DIR}/.git" ]]; then
  echo "PUBLIC_DIR must point to a git checkout of the public repo" >&2
  exit 1
fi

if [[ "${BEFORE_SHA}" =~ ^0+$ ]]; then
  echo "before SHA is all zeros (initial push or unknown); refusing to sync unbounded history" >&2
  echo "Set BEFORE_SHA to the first parent of AFTER_SHA for a one-shot import, or extend script." >&2
  exit 1
fi

KEEP_WORKDIR_ON_ERROR="${KEEP_WORKDIR_ON_ERROR:-0}"
WORKDIR_AUTO=1
if [[ -n "${PRIVATE_SYNC_WORKDIR:-}" ]]; then
  WORKDIR="${PRIVATE_SYNC_WORKDIR}"
  WORKDIR_AUTO=0
  rm -rf "${WORKDIR}"
  mkdir -p "${WORKDIR}"
else
  WORKDIR="$(mktemp -d)"
fi

cleanup_workdir() {
  rc=$?
  if [[ "${WORKDIR_AUTO}" -eq 1 && "${KEEP_WORKDIR_ON_ERROR}" != "1" ]]; then
    rm -rf "${WORKDIR}"
    return
  fi
  if [[ "${rc}" -ne 0 ]]; then
    echo "Kept workdir for manual conflict resolution: ${WORKDIR}" >&2
    echo "Private clone path: ${WORKDIR}/private" >&2
    echo "Patch file path: ${PATCH_FILE:-${WORKDIR}/public-range.patch}" >&2
  fi
}
trap cleanup_workdir EXIT

PATCH_FILE="${WORKDIR}/public-range.patch"
SYNC_EXCLUDE_PATHS="${SYNC_EXCLUDE_PATHS:-OPEN_CORE_EXPORT_META.json}"
DIFF_ARGS=(diff --binary "${BEFORE_SHA}" "${AFTER_SHA}")
IFS=',' read -r -a EXCLUDE_LIST <<< "${SYNC_EXCLUDE_PATHS}"
HAS_EXCLUDES=0
for p in "${EXCLUDE_LIST[@]}"; do
  p="${p#"${p%%[![:space:]]*}"}"
  p="${p%"${p##*[![:space:]]}"}"
  if [[ -n "${p}" ]]; then
    HAS_EXCLUDES=1
  fi
done
if [[ "${HAS_EXCLUDES}" -eq 1 ]]; then
  DIFF_ARGS+=(-- .)
  for p in "${EXCLUDE_LIST[@]}"; do
    p="${p#"${p%%[![:space:]]*}"}"
    p="${p%"${p##*[![:space:]]}"}"
    [[ -n "${p}" ]] && DIFF_ARGS+=(":(exclude)${p}")
  done
fi
git -C "${PUBLIC_DIR}" "${DIFF_ARGS[@]}" >"${PATCH_FILE}"

if [[ ! -s "${PATCH_FILE}" ]]; then
  echo "Empty diff between ${BEFORE_SHA} and ${AFTER_SHA}; nothing to sync" >&2
  exit 0
fi

# --- clone private with token in URL (not stored in git config) ---
if [[ -n "${PRIVATE_LOCAL_REPO_DIR}" ]]; then
  if [[ ! -d "${PRIVATE_LOCAL_REPO_DIR}/.git" ]]; then
    echo "PRIVATE_LOCAL_REPO_DIR is not a git checkout: ${PRIVATE_LOCAL_REPO_DIR}" >&2
    exit 1
  fi
  if ! git -C "${PRIVATE_LOCAL_REPO_DIR}" diff --quiet || ! git -C "${PRIVATE_LOCAL_REPO_DIR}" diff --cached --quiet; then
    echo "PRIVATE_LOCAL_REPO_DIR has uncommitted changes; commit/stash first: ${PRIVATE_LOCAL_REPO_DIR}" >&2
    exit 1
  fi
  git -C "${PRIVATE_LOCAL_REPO_DIR}" fetch origin "${PRIVATE_TARGET_BRANCH}"
  PRIVATE_DIR="${PRIVATE_LOCAL_REPO_DIR}"
else
  HOST_PATH="${PRIVATE_REPO_CLONE_URL#https://}"
  HOST="${HOST_PATH%%/*}"
  AUTH_MODE="${PRIVATE_USE_GITHUB_TOKEN_AUTH:-auto}"
  if [[ "${AUTH_MODE}" == "1" ]] || { [[ "${AUTH_MODE}" == "auto" ]] && [[ "${HOST}" == "github.com" ]]; }; then
    CLONE_URL="https://x-access-token:${PRIVATE_GIT_TOKEN}@${HOST_PATH}"
  else
    CLONE_URL="https://oauth2:${PRIVATE_GIT_TOKEN}@${HOST_PATH}"
  fi

  git clone --depth 200 --branch "${PRIVATE_TARGET_BRANCH}" "${CLONE_URL}" "${WORKDIR}/private"
  git -C "${WORKDIR}/private" config user.email "public-sync-bot@users.noreply.github.com"
  git -C "${WORKDIR}/private" config user.name "public-sync-bot"
  PRIVATE_DIR="${WORKDIR}/private"
fi

SYNC_BRANCH="public-sync/${AFTER_SHA}"
if git -C "${PRIVATE_DIR}" ls-remote --heads origin "refs/heads/${SYNC_BRANCH}" | grep -q .; then
  echo "Branch ${SYNC_BRANCH} already exists on origin; idempotent exit" >&2
  exit 0
fi

git -C "${PRIVATE_DIR}" checkout -B "${SYNC_BRANCH}" "origin/${PRIVATE_TARGET_BRANCH}"

if ! git -C "${PRIVATE_DIR}" apply --3way --index "${PATCH_FILE}"; then
  echo "Indexed apply failed; retrying conflict-friendly apply in working tree..." >&2
  git -C "${PRIVATE_DIR}" reset --hard "origin/${PRIVATE_TARGET_BRANCH}" >/dev/null
  if ! git -C "${PRIVATE_DIR}" apply --3way "${PATCH_FILE}"; then
    if [[ -n "$(git -C "${PRIVATE_DIR}" ls-files -u)" ]] || ! git -C "${PRIVATE_DIR}" diff --quiet; then
      echo "git apply left conflicts in working tree." >&2
      echo "Open ${PRIVATE_DIR} in your editor and resolve with git:" >&2
      echo "  git -C \"${PRIVATE_DIR}\" status" >&2
      echo "  # fix conflicts in files" >&2
      echo "  git -C \"${PRIVATE_DIR}\" add -A" >&2
      echo "  git -C \"${PRIVATE_DIR}\" commit -m \"sync(public): resolve conflicts ${BEFORE_SHA:0:7}..${AFTER_SHA:0:7}\"" >&2
      echo "  git -C \"${PRIVATE_DIR}\" push -u origin \"HEAD:${SYNC_BRANCH}\"" >&2
      exit 2
    fi
    git -C "${PRIVATE_DIR}" apply --reject --whitespace=fix "${PATCH_FILE}" >/dev/null 2>&1 || true
    echo "git apply failed; wrote reject hunks (*.rej)." >&2
    echo "Open ${PRIVATE_DIR} and resolve using .rej files, then:" >&2
    echo "  git -C \"${PRIVATE_DIR}\" add -A" >&2
    echo "  git -C \"${PRIVATE_DIR}\" commit -m \"sync(public): resolve rejects ${BEFORE_SHA:0:7}..${AFTER_SHA:0:7}\"" >&2
    echo "  git -C \"${PRIVATE_DIR}\" push -u origin \"HEAD:${SYNC_BRANCH}\"" >&2
    exit 2
  fi
fi

if git -C "${PRIVATE_DIR}" diff --quiet && git -C "${PRIVATE_DIR}" diff --cached --quiet; then
  echo "Patch applied but no changes recorded (unexpected)" >&2
  exit 1
fi

git -C "${PRIVATE_DIR}" add -A

MSG_FILE="${WORKDIR}/commitmsg"
{
  echo "sync(public): apply range ${BEFORE_SHA:0:7}..${AFTER_SHA:0:7}"
  echo ""
  echo "Public repo: ${PUBLIC_REPO_SLUG:-unknown}"
  echo "Before: ${BEFORE_SHA}"
  echo "After: ${AFTER_SHA}"
  [[ -n "${SYNC_ID:-}" ]] && echo "Sync-ID: ${SYNC_ID}"
  [[ -n "${UPSTREAM_PR_URL:-}" ]] && echo "Upstream PR: ${UPSTREAM_PR_URL}"
} >"${MSG_FILE}"

git -C "${PRIVATE_DIR}" commit -F "${MSG_FILE}"
git -C "${PRIVATE_DIR}" push -u origin "HEAD:${SYNC_BRANCH}"

echo "Pushed ${SYNC_BRANCH} to private origin. Open a PR/MR in your forge from that branch to ${PRIVATE_TARGET_BRANCH} if required." >&2

exit 0
