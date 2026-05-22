#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

REMOTE_HOST="${REMOTE_HOST:-root@123.57.141.233}"
REMOTE_DIR="${REMOTE_DIR:-/root/kg_edu}"
REMOTE_START_SCRIPT="${REMOTE_START_SCRIPT:-start.sh}"
PLATFORM="${PLATFORM:-linux/amd64}"

BUILD_BACKEND="${BUILD_BACKEND:-1}"
BUILD_FRONTEND="${BUILD_FRONTEND:-1}"
BUILD_AGENT="${BUILD_AGENT:-1}"
SYNC_DEPLOY_FILES="${SYNC_DEPLOY_FILES:-1}"
REMOTE_PULL_IMAGES="${REMOTE_PULL_IMAGES:-1}"
RUN_REMOTE_START="${RUN_REMOTE_START:-1}"

log() {
  printf '\n==> %s\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

run_local_builds() {
  if [[ "${BUILD_BACKEND}" == "1" ]]; then
    log "Building and pushing backend image"
    (cd "${PROJECT_ROOT}/backend/kg_edu" && PLATFORM="${PLATFORM}" bash ./build.sh)
  fi

  if [[ "${BUILD_FRONTEND}" == "1" ]]; then
    log "Building and pushing frontend image"
    (cd "${PROJECT_ROOT}/kg-edu-vite-antd" && PLATFORM="${PLATFORM}" bash ./build-test.sh)
  fi

  if [[ "${BUILD_AGENT}" == "1" ]]; then
    log "Building and pushing AI Agent image"
    (cd "${PROJECT_ROOT}/agent-server" && PLATFORM="${PLATFORM}" bash ./build.sh)
  fi
}

sync_deploy_files() {
  if [[ "${SYNC_DEPLOY_FILES}" != "1" ]]; then
    return
  fi

  log "Syncing deployment files to ${REMOTE_HOST}:${REMOTE_DIR}"
  ssh "${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}/nginx/conf.d' '${REMOTE_DIR}/pi-config'"

  scp "${PROJECT_ROOT}/docker-compose.prod.yml" \
    "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.prod.yml"
  scp "${PROJECT_ROOT}/nginx/nginx.conf" \
    "${REMOTE_HOST}:${REMOTE_DIR}/nginx/nginx.conf"
  scp "${PROJECT_ROOT}/nginx/conf.d/kg-edu.conf" \
    "${REMOTE_HOST}:${REMOTE_DIR}/nginx/conf.d/kg-edu.conf"
  scp "${PROJECT_ROOT}/pi-config/models.json" \
    "${REMOTE_HOST}:${REMOTE_DIR}/pi-config/models.json"
}

pull_remote_images() {
  if [[ "${REMOTE_PULL_IMAGES}" != "1" ]]; then
    return
  fi

  log "Pulling fresh images on remote host"
  ssh "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && (docker compose -f docker-compose.prod.yml pull backend frontend ai-agent || docker-compose -f docker-compose.prod.yml pull backend frontend ai-agent)"
}

run_remote_start() {
  if [[ "${RUN_REMOTE_START}" != "1" ]]; then
    return
  fi

  log "Running remote ${REMOTE_START_SCRIPT}"
  ssh "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && chmod +x './${REMOTE_START_SCRIPT}' && './${REMOTE_START_SCRIPT}'"
}

main() {
  need_cmd docker
  need_cmd ssh
  need_cmd scp

  log "Deploy target: ${REMOTE_HOST}:${REMOTE_DIR}"
  run_local_builds
  sync_deploy_files
  pull_remote_images
  run_remote_start
  log "Deploy finished"
}

main "$@"
