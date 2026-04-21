#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

# Avoid macOS Keychain / global credential helpers overriding embedded credentials in HTTPS URLs.
export GIT_TERMINAL_PROMPT=0
GIT_NO_HELPER=(git -c credential.helper= -c credential.useHttpPath=true)

fail() {
  echo "[open-core] $*" >&2
  exit 1
}

normalize_repo_slug() {
  local raw="$1"
  local s="${raw}"
  s="${s#https://github.com/}"
  s="${s#http://github.com/}"
  s="${s#git@github.com:}"
  s="${s%.git}"
  echo "${s}"
}

# Load PUBLIC_CORE_* from `.env` (without sourcing the whole file) unless already exported.
# Works for both `pnpm open-core:publish` and direct `bash scripts/open-core/publish-community-core.sh`.
eval "$(node "${ROOT_DIR}/scripts/open-core/load-open-core-publish-env.mjs" --emit-bash)"

: "${PUBLIC_CORE_REPO:?Set PUBLIC_CORE_REPO to owner/name of the public repository}"
: "${PUBLIC_CORE_PUSH_TOKEN:?Set PUBLIC_CORE_PUSH_TOKEN (PAT) with push rights to target public branch}"
PUBLIC_CORE_REPO="$(normalize_repo_slug "${PUBLIC_CORE_REPO}")"
PUBLIC_CORE_TARGET_BRANCH="${PUBLIC_CORE_TARGET_BRANCH:-main}"
AUTH_REMOTE="https://x-access-token:${PUBLIC_CORE_PUSH_TOKEN}@github.com/${PUBLIC_CORE_REPO}.git"

check_repo_access() {
  local api_url="https://api.github.com/repos/${PUBLIC_CORE_REPO}"
  local tmp_body
  tmp_body="$(mktemp)"
  local status
  status="$(curl -sS -o "${tmp_body}" -w "%{http_code}" \
    -H "Authorization: Bearer ${PUBLIC_CORE_PUSH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "${api_url}" || true)"

  case "${status}" in
    200)
      # Fine-grained PAT: GET /repos can still list permissions.push for your user while the token
      # only has Metadata (read). Git + Contents API then return 403. Probe with invalid base64:
      # GitHub returns 422 once contents write is allowed (no commit created); 403 if token cannot write.
      rm -f "${tmp_body}"
      local probe_resp probe_status probe_path
      probe_resp="$(mktemp)"
      probe_path=".open-core-publish-token-probe-$(openssl rand -hex 8)"
      probe_status="$(curl -sS -o "${probe_resp}" -w "%{http_code}" -X PUT \
        -H "Authorization: Bearer ${PUBLIC_CORE_PUSH_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        "https://api.github.com/repos/${PUBLIC_CORE_REPO}/contents/${probe_path}" \
        -d '{"message":"open-core PAT probe","content":"NOT_VALID_BASE64"}' || true)"

      case "${probe_status}" in
        422)
          rm -f "${probe_resp}"
          # GitHub blocks PATs from touching .github/workflows/* without the `workflow` scope (classic)
          # or Workflows read/write (fine-grained), even when Contents write is allowed.
          local wf_probe_resp wf_status wf_path wf_snip
          wf_probe_resp="$(mktemp)"
          wf_path=".github/workflows/.open-core-publish-workflow-scope-probe-$(openssl rand -hex 8).yml"
          wf_status="$(curl -sS -o "${wf_probe_resp}" -w "%{http_code}" -X PUT \
            -H "Authorization: Bearer ${PUBLIC_CORE_PUSH_TOKEN}" \
            -H "Accept: application/vnd.github+json" \
            "https://api.github.com/repos/${PUBLIC_CORE_REPO}/contents/${wf_path}" \
            -d '{"message":"open-core workflow PAT probe","content":"NOT_VALID_BASE64"}' || true)"

          case "${wf_status}" in
            422)
              rm -f "${wf_probe_resp}"
              ;;
            403)
              wf_snip="$(head -c 260 "${wf_probe_resp}" | tr '\n' ' ')"
              rm -f "${wf_probe_resp}"
              fail "This PAT cannot create or update files under .github/workflows/ (required because the community export includes workflow YAML). Classic PAT: add the **workflow** scope. Fine-grained PAT: Repository permissions → **Workflows → Read and write**. GitHub: ${wf_snip}"
              ;;
            *)
              wf_snip="$(head -c 260 "${wf_probe_resp}" | tr '\n' ' ')"
              rm -f "${wf_probe_resp}"
              fail "Unexpected GitHub workflows probe response (${wf_status}) for ${PUBLIC_CORE_REPO}: ${wf_snip}"
              ;;
          esac
          ;;
        403)
          if grep -q 'Resource not accessible by personal access token' "${probe_resp}" 2>/dev/null; then
            rm -f "${probe_resp}"
            fail "Fine-grained PAT cannot write repository contents. In GitHub → Settings → Developer settings → Fine-grained tokens → edit this token: add Repository permission **Contents: Read and write** and ensure **${PUBLIC_CORE_REPO}** is in the token's repository list (or authorize SSO for the owning org)."
          fi
          rm -f "${probe_resp}"
          fail "Access forbidden (403) on contents write probe. Check org SSO authorization and repository access for this token."
          ;;
        *)
          rm -f "${probe_resp}"
          fail "Unexpected GitHub contents probe response (${probe_status}) for ${PUBLIC_CORE_REPO}: $(head -c 240 "${probe_resp}" | tr '\n' ' ')"
          ;;
      esac
      ;;
    401)
      rm -f "${tmp_body}"
      fail "GitHub token is invalid or expired (401). Recreate PUBLIC_CORE_PUSH_TOKEN."
      ;;
    403)
      rm -f "${tmp_body}"
      fail "Access forbidden (403). Check token scope, repo access, and org SSO authorization."
      ;;
    404)
      rm -f "${tmp_body}"
      fail "Repository ${PUBLIC_CORE_REPO} not found for this token (404). Check repo slug and token repository access."
      ;;
    *)
      rm -f "${tmp_body}"
      fail "Unexpected GitHub API response (${status}) while checking ${PUBLIC_CORE_REPO}."
      ;;
  esac

  rm -f "${tmp_body}"
}

check_target_branch_exists() {
  if "${GIT_NO_HELPER[@]}" ls-remote --exit-code --heads "${AUTH_REMOTE}" "${PUBLIC_CORE_TARGET_BRANCH}" >/dev/null 2>&1; then
    return 0
  fi

  local any_heads
  any_heads="$("${GIT_NO_HELPER[@]}" ls-remote --heads "${AUTH_REMOTE}" 2>/dev/null || true)"
  if [[ -z "${any_heads}" ]]; then
    fail "Public repository has no branches yet. Create initial commit (e.g. README) and rerun."
  fi

  fail "Target branch '${PUBLIC_CORE_TARGET_BRANCH}' not found in ${PUBLIC_CORE_REPO}. Set PUBLIC_CORE_TARGET_BRANCH correctly."
}

EXPORT_DIR="${OPEN_CORE_EXPORT_DIR:-${ROOT_DIR}/.open-core-export}"
WORK_DIR="${OPEN_CORE_PUBLISH_WORKDIR:-${RUNNER_TEMP:-/tmp}/beer-tracker-open-core-publish}"

check_repo_access
check_target_branch_exists

pnpm open-core:export -- --out-dir="${EXPORT_DIR}"

rm -rf "${WORK_DIR}"
mkdir -p "${WORK_DIR}"

"${GIT_NO_HELPER[@]}" clone --depth 1 --branch "${PUBLIC_CORE_TARGET_BRANCH}" "${AUTH_REMOTE}" "${WORK_DIR}/repo"

git -C "${WORK_DIR}/repo" rm -rf . >/dev/null 2>&1 || true

rsync -a --delete \
  --exclude ".git/" \
  "${EXPORT_DIR}/" \
  "${WORK_DIR}/repo/"

git -C "${WORK_DIR}/repo" add -A

if git -C "${WORK_DIR}/repo" diff --cached --quiet; then
  echo "[open-core] No changes to publish."
  exit 0
fi

git -C "${WORK_DIR}/repo" \
  -c user.name="open-core-bot" \
  -c user.email="open-core-bot@users.noreply.github.com" \
  commit -m "chore(open-core): sync from private ${GITHUB_SHA:-local}"

# `git clone` stores `origin` without credentials; push explicitly to AUTH_REMOTE.
"${GIT_NO_HELPER[@]}" -C "${WORK_DIR}/repo" push "${AUTH_REMOTE}" "HEAD:${PUBLIC_CORE_TARGET_BRANCH}"

echo "[open-core] Published to ${PUBLIC_CORE_REPO} ${PUBLIC_CORE_TARGET_BRANCH}."
