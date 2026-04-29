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
#
set -euo pipefail

PUBLIC_DIR="${PUBLIC_DIR:-${GITHUB_WORKSPACE:-}}"
BEFORE_SHA="${BEFORE_SHA:?Set BEFORE_SHA (e.g. github.event.before)}"
AFTER_SHA="${AFTER_SHA:?Set AFTER_SHA (e.g. github.event.after)}"
PRIVATE_REPO_CLONE_URL="${PRIVATE_REPO_CLONE_URL:?Set PRIVATE_REPO_CLONE_URL}"
PRIVATE_GIT_TOKEN="${PRIVATE_GIT_TOKEN:?Set PRIVATE_GIT_TOKEN}"
PRIVATE_TARGET_BRANCH="${PRIVATE_TARGET_BRANCH:-main}"

if [[ -z "${PUBLIC_DIR}" || ! -d "${PUBLIC_DIR}/.git" ]]; then
  echo "PUBLIC_DIR must point to a git checkout of the public repo" >&2
  exit 1
fi

if [[ "${BEFORE_SHA}" =~ ^0+$ ]]; then
  echo "before SHA is all zeros (initial push or unknown); refusing to sync unbounded history" >&2
  echo "Set BEFORE_SHA to the first parent of AFTER_SHA for a one-shot import, or extend script." >&2
  exit 1
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "${WORKDIR}"' EXIT

PATCH_FILE="${WORKDIR}/public-range.patch"

git -C "${PUBLIC_DIR}" diff --binary "${BEFORE_SHA}" "${AFTER_SHA}" >"${PATCH_FILE}"

if [[ ! -s "${PATCH_FILE}" ]]; then
  echo "Empty diff between ${BEFORE_SHA} and ${AFTER_SHA}; nothing to sync" >&2
  exit 0
fi

# --- clone private with token in URL (not stored in git config) ---
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

SYNC_BRANCH="public-sync/${AFTER_SHA}"
if git -C "${WORKDIR}/private" ls-remote --heads origin "refs/heads/${SYNC_BRANCH}" | grep -q .; then
  echo "Branch ${SYNC_BRANCH} already exists on origin; idempotent exit" >&2
  exit 0
fi

git -C "${WORKDIR}/private" checkout -b "${SYNC_BRANCH}" "origin/${PRIVATE_TARGET_BRANCH}"

if ! git -C "${WORKDIR}/private" apply --3way "${PATCH_FILE}"; then
  echo "git apply failed (conflicts). Resolve manually from patch in CI artifacts or re-run locally." >&2
  exit 2
fi

if git -C "${WORKDIR}/private" diff --quiet && git -C "${WORKDIR}/private" diff --cached --quiet; then
  echo "Patch applied but no changes recorded (unexpected)" >&2
  exit 1
fi

git -C "${WORKDIR}/private" add -A

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

git -C "${WORKDIR}/private" commit -F "${MSG_FILE}"
git -C "${WORKDIR}/private" push -u origin "HEAD:${SYNC_BRANCH}"

echo "Pushed ${SYNC_BRANCH} to private origin. Open a PR/MR in your forge from that branch to ${PRIVATE_TARGET_BRANCH} if required." >&2

exit 0
