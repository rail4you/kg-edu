#!/usr/bin/env bash
set -euo pipefail

# ============================================================
#  远程部署脚本
#  1. 本地构建统一 Docker 镜像 (前端 + 后端, linux/amd64)
#  2. 推送镜像到阿里云容器镜像仓库
#  3. 同步 docker-compose + nginx 配置到远程服务器
#  4. 远程拉取镜像并启动服务
# ============================================================

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 远程服务器配置 ──────────────────────────────────────────
REMOTE_HOST="${REMOTE_HOST:-root@123.57.141.233}"
REMOTE_DIR="${REMOTE_DIR:-/root/kg_edu}"

# ── 镜像配置 ───────────────────────────────────────────────
PLATFORM="${PLATFORM:-linux/amd64}"
IMAGE="${IMAGE:-registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest}"

# ── 步骤开关 (可通过环境变量跳过) ──────────────────────────
BUILD_IMAGE="${BUILD_IMAGE:-1}"
SYNC_DEPLOY_FILES="${SYNC_DEPLOY_FILES:-1}"
REMOTE_PULL="${REMOTE_PULL:-1}"
REMOTE_START="${REMOTE_START:-1}"

log() {
  printf '\n\033[1;36m==>\033[0m \033[1m%s\033[0m\n' "$*"
}

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

# ── Step 1: 本地构建并推送镜像 ──────────────────────────────
run_build() {
  if [[ "${BUILD_IMAGE}" != "1" ]]; then
    return
  fi

  log "Building unified image (frontend + backend) for ${PLATFORM}"
  (cd "${PROJECT_ROOT}/kg-edu-vite-antd" && PLATFORM="${PLATFORM}" IMAGE="${IMAGE}" bash ./build-test.sh)
}

# ── Step 2: 同步部署文件到远程 ──────────────────────────────
sync_deploy_files() {
  if [[ "${SYNC_DEPLOY_FILES}" != "1" ]]; then
    return
  fi

  log "Syncing deployment files to ${REMOTE_HOST}:${REMOTE_DIR}"
  ssh "${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}/nginx/conf.d'"

  scp "${PROJECT_ROOT}/docker-compose.prod.yml" \
      "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.yml"
  scp "${PROJECT_ROOT}/nginx/nginx.conf" \
      "${REMOTE_HOST}:${REMOTE_DIR}/nginx/nginx.conf"
  scp "${PROJECT_ROOT}/nginx/conf.d/kg-edu.conf" \
      "${REMOTE_HOST}:${REMOTE_DIR}/nginx/conf.d/kg-edu.conf"
}

# ── Step 3: 远程拉取镜像 ────────────────────────────────────
pull_remote_images() {
  if [[ "${REMOTE_PULL}" != "1" ]]; then
    return
  fi

  log "Pulling fresh images on remote host"
  ssh "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml pull backend"
}

# ── Step 4: 远程启动服务 ────────────────────────────────────
run_remote_start() {
  if [[ "${REMOTE_START}" != "1" ]]; then
    return
  fi

  log "Starting services on remote host"
  ssh "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml up -d"
}

# ── Main ────────────────────────────────────────────────────
main() {
  need_cmd docker
  need_cmd ssh
  need_cmd scp

  log "=========================================="
  log "  KgEdu Remote Deploy"
  log "  Target: ${REMOTE_HOST}:${REMOTE_DIR}"
  log "  Image:  ${IMAGE}"
  log "=========================================="

  run_build
  sync_deploy_files
  pull_remote_images
  run_remote_start

  log "Deploy finished!"
  echo ""
  echo "  Verify:  ssh ${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker compose -f docker-compose.yml ps'"
  echo "  Logs:    ssh ${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker compose -f docker-compose.yml logs -f'"
  echo ""
}

main "$@"
