#!/usr/bin/env bash
# Resolve BEFORE_SHA / AFTER_SHA for public → private sync and run downstream-sync.sh.
#
# Modes (exactly one), or use --public-repo alone for "clone + default state file":
#   --since-state FILE   BEFORE = contents of FILE, AFTER = current origin/<branch>.
#   --merge SHA          BEFORE = SHA^, AFTER = SHA.
#   --github-before X --github-after Y   passthrough for Actions.
#
# Public tree (one of):
#   --public-dir PATH    existing checkout (default: cwd if inside a git repo)
#   --public-repo OWNER/REPO   clone or fetch under --public-clone-root (GitHub HTTPS only).
#                        If no mode flags are passed, implies --since-state on a default
#                        file under XDG_STATE_HOME (see below).
#   Do not pass both --public-dir and --public-repo.
#
# With --public-repo:
#   --public-clone-root DIR   default: ${XDG_CACHE_HOME:-~/.cache}/beer-tracker/public-git
#   --public-remote / --public-branch   same as below
#
# Common:
#   --public-remote NAME default: origin
#   --public-branch NAME default: main
#
# Pass-through to downstream-sync.sh:
#   PRIVATE_REPO_CLONE_URL, PRIVATE_GIT_TOKEN, PRIVATE_TARGET_BRANCH (optional),
#   PRIVATE_USE_GITHUB_TOKEN_AUTH, PUBLIC_REPO_SLUG, SYNC_ID, UPSTREAM_PR_URL
#
# Examples:
#   # One command: ensure clone, diff since last successful sync, downstream:
#   export PRIVATE_REPO_CLONE_URL=… PRIVATE_GIT_TOKEN=… PRIVATE_TARGET_BRANCH=master
#   ./scripts/sync-public-private/sync-from-public.sh --public-repo Dinkimom/beer-tracker-community
#
#   # First run: creates state file with current main tip and exits (no downstream).
#   # Next runs: sync new commits only.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOWNSTREAM="${SCRIPT_DIR}/downstream-sync.sh"

PUBLIC_DIR=""
PUBLIC_REPO_SLUG=""
PUBLIC_CLONE_ROOT=""
PUBLIC_REMOTE="origin"
PUBLIC_BRANCH="main"
STATE_FILE=""
MERGE_SHA=""
GH_BEFORE=""
GH_AFTER=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --public-dir)
      PUBLIC_DIR="${2:?}"
      shift 2
      ;;
    --public-repo)
      PUBLIC_REPO_SLUG="${2:?}"
      shift 2
      ;;
    --public-clone-root)
      PUBLIC_CLONE_ROOT="${2:?}"
      shift 2
      ;;
    --public-remote)
      PUBLIC_REMOTE="${2:?}"
      shift 2
      ;;
    --public-branch)
      PUBLIC_BRANCH="${2:?}"
      shift 2
      ;;
    --since-state)
      STATE_FILE="${2:?}"
      shift 2
      ;;
    --merge)
      MERGE_SHA="${2:?}"
      shift 2
      ;;
    --github-before)
      GH_BEFORE="${2:?}"
      shift 2
      ;;
    --github-after)
      GH_AFTER="${2:?}"
      shift 2
      ;;
    -h | --help)
      sed -n '1,55p' "$0" >&2
      exit 0
      ;;
    *)
      echo "Unknown option: $1 (try --help)" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${PUBLIC_DIR}" && -n "${PUBLIC_REPO_SLUG}" ]]; then
  echo "Use either --public-dir or --public-repo, not both." >&2
  exit 1
fi

if [[ -n "${PUBLIC_REPO_SLUG}" ]]; then
  ROOT="${PUBLIC_CLONE_ROOT:-${XDG_CACHE_HOME:-$HOME/.cache}/beer-tracker/public-git}"
  SAFE_NAME="${PUBLIC_REPO_SLUG//\//-}"
  PUBLIC_DIR="${ROOT}/${SAFE_NAME}"
  mkdir -p "${ROOT}"
  if [[ ! -d "${PUBLIC_DIR}/.git" ]]; then
    echo "[sync-from-public] cloning https://github.com/${PUBLIC_REPO_SLUG}.git -> ${PUBLIC_DIR}" >&2
    git clone --depth 500 "https://github.com/${PUBLIC_REPO_SLUG}.git" "${PUBLIC_DIR}"
  else
    echo "[sync-from-public] fetch ${PUBLIC_REMOTE} ${PUBLIC_BRANCH} in ${PUBLIC_DIR}" >&2
    git -C "${PUBLIC_DIR}" fetch "${PUBLIC_REMOTE}" "${PUBLIC_BRANCH}"
  fi
  export PUBLIC_REPO_SLUG_FOR_STATE="${SAFE_NAME}"
fi

if [[ -z "${PUBLIC_DIR}" ]]; then
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    PUBLIC_DIR="$(git rev-parse --show-toplevel)"
  else
    echo "Set --public-dir, --public-repo, or run from inside a git checkout." >&2
    exit 1
  fi
fi

if [[ ! -d "${PUBLIC_DIR}/.git" ]]; then
  echo "Not a git checkout: ${PUBLIC_DIR}" >&2
  exit 1
fi

MODE_COUNT=0
[[ -n "${STATE_FILE}" ]] && MODE_COUNT=$((MODE_COUNT + 1))
[[ -n "${MERGE_SHA}" ]] && MODE_COUNT=$((MODE_COUNT + 1))
[[ -n "${GH_BEFORE}" || -n "${GH_AFTER}" ]] && MODE_COUNT=$((MODE_COUNT + 1))

# --public-repo without explicit range mode → track tip of main via default state file (only then; never guess from cwd).
if [[ "${MODE_COUNT}" -eq 0 ]]; then
  if [[ -n "${PUBLIC_REPO_SLUG_FOR_STATE:-}" ]]; then
    STATE_BASE="${XDG_STATE_HOME:-$HOME/.local/state}/beer-tracker"
    mkdir -p "${STATE_BASE}"
    STATE_FILE="${STATE_BASE}/last-public-main-${PUBLIC_REPO_SLUG_FOR_STATE}.sha"
    MODE_COUNT=1
    echo "[sync-from-public] using default state file: ${STATE_FILE}" >&2
  else
    echo "Specify one of: --since-state | --merge | --github-before+--github-after, or --public-repo alone (clone + auto state)." >&2
    exit 1
  fi
fi

if [[ "${MODE_COUNT}" -ne 1 ]]; then
  echo "Specify exactly one of: --since-state FILE | --merge SHA | (--github-before X and --github-after Y)" >&2
  exit 1
fi

if [[ -n "${GH_BEFORE}" || -n "${GH_AFTER}" ]]; then
  if [[ -z "${GH_BEFORE}" || -z "${GH_AFTER}" ]]; then
    echo "Both --github-before and --github-after are required together." >&2
    exit 1
  fi
  BEFORE_SHA="${GH_BEFORE}"
  AFTER_SHA="${GH_AFTER}"
  # Ensure objects exist for diff in shallow clone
  git -C "${PUBLIC_DIR}" fetch --depth 500 "${PUBLIC_REMOTE}" "${PUBLIC_BRANCH}" 2>/dev/null || true
  git -C "${PUBLIC_DIR}" fetch "${PUBLIC_REMOTE}" "${AFTER_SHA}" 2>/dev/null || true
else
  git -C "${PUBLIC_DIR}" fetch "${PUBLIC_REMOTE}" "${PUBLIC_BRANCH}"
  REF_FULL="${PUBLIC_REMOTE}/${PUBLIC_BRANCH}"
  AFTER_TIP="$(git -C "${PUBLIC_DIR}" rev-parse "${REF_FULL}")"

  if [[ -n "${STATE_FILE}" ]]; then
    if [[ ! -f "${STATE_FILE}" ]]; then
      mkdir -p "$(dirname "${STATE_FILE}")"
      tmp="${STATE_FILE}.tmp.$$"
      echo "${AFTER_TIP}" >"${tmp}"
      mv -f "${tmp}" "${STATE_FILE}"
      echo "[sync-from-public] bootstrapped state file (downstream skipped this run): ${STATE_FILE}" >&2
      echo "[sync-from-public] recorded ${REF_FULL} = ${AFTER_TIP}. Run the same command again after new commits land on ${PUBLIC_BRANCH}." >&2
      exit 0
    fi
    BEFORE_SHA="$(tr -d '[:space:]' <"${STATE_FILE}")"
    AFTER_SHA="${AFTER_TIP}"
    if [[ -z "${BEFORE_SHA}" ]]; then
      echo "State file is empty: ${STATE_FILE}" >&2
      exit 1
    fi
    if [[ "${BEFORE_SHA}" == "${AFTER_SHA}" ]]; then
      echo "Nothing new on ${REF_FULL} (marker equals tip ${AFTER_SHA})." >&2
      exit 0
    fi
  elif [[ -n "${MERGE_SHA}" ]]; then
    MERGE_RESOLVED="$(git -C "${PUBLIC_DIR}" rev-parse "${MERGE_SHA}")"
    BEFORE_SHA="$(git -C "${PUBLIC_DIR}" rev-parse "${MERGE_RESOLVED}^")"
    AFTER_SHA="${MERGE_RESOLVED}"
  fi
fi

export PUBLIC_DIR
export BEFORE_SHA
export AFTER_SHA

echo "[sync-from-public] BEFORE_SHA=${BEFORE_SHA}" >&2
echo "[sync-from-public] AFTER_SHA=${AFTER_SHA}" >&2

if [[ "${BEFORE_SHA}" =~ ^0+$ ]]; then
  echo "[sync-from-public] before is all zeros; refusing (same guard as downstream-sync)." >&2
  exit 1
fi

if ! "${DOWNSTREAM}"; then
  exit_code=$?
  echo "[sync-from-public] downstream-sync.sh exited ${exit_code}" >&2
  exit "${exit_code}"
fi

if [[ -n "${STATE_FILE}" ]]; then
  tmp="${STATE_FILE}.tmp.$$"
  echo "${AFTER_SHA}" >"${tmp}"
  mv -f "${tmp}" "${STATE_FILE}"
  echo "[sync-from-public] updated state file: ${STATE_FILE}" >&2
fi

exit 0
