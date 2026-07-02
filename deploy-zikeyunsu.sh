#!/usr/bin/env bash
# ============================================================
# 智课云枢 - 远程部署脚本
# 部署到 124.222.177.241
# ============================================================
set -euo pipefail

REMOTE_HOST="ubuntu@124.222.177.241"
REMOTE_DIR="/home/ubuntu/kg_edu"
IMAGE="registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest"

log() {
  printf '\n\033[1;36m==>\033[0m \033[1m%s\033[0m\n' "$*"
}

# 1. 本地构建推送镜像
log "Building and pushing Docker image..."
cd "$(dirname "$0")"
docker buildx build \
  --platform linux/amd64 \
  -f backend/kg_edu/Dockerfile \
  -t "${IMAGE}" \
  --load \
  . 2>&1 | tail -3

docker push "${IMAGE}" 2>&1 | tail -3

# 2. 同步部署文件
log "Syncing deployment files..."
ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" "mkdir -p '${REMOTE_DIR}/nginx/conf.d'"

scp docker-compose.prod.yml "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.yml"
scp nginx/nginx.conf "${REMOTE_HOST}:${REMOTE_DIR}/nginx/nginx.conf"
scp nginx/conf.d/kg-edu.conf "${REMOTE_HOST}:${REMOTE_DIR}/nginx/conf.d/kg-edu.conf"
scp .env.zikeyunsu "${REMOTE_HOST}:${REMOTE_DIR}/.env"

# 3. 拉取最新镜像
log "Pulling image on remote..."
ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml pull backend"

# 4. 启动数据库（如未运行）
log "Starting database..."
ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml up -d db"

# 5. 修改重复的迁移文件名 + 执行迁移
log "Running database migration (with duplicate fix)..."
ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" "
cd '${REMOTE_DIR}'
# 查找并修改重复的 migration module name
docker compose -f docker-compose.yml run --rm backend bash -c '
  # 修复重复的 update_code 迁移
  MIG_DIR=\$(find /app/lib -path \"*/priv/repo/migrations\" -type d | head -1)
  if [ -f \"\$MIG_DIR/20251023125910_update_code.exs\" ]; then
    sed -i \"s/defmodule KgEdu.Repo.Migrations.UpdateCode do/defmodule KgEdu.Repo.Migrations.UpdateCode2 do/\" \"\$MIG_DIR/20251023125910_update_code.exs\"
    echo \"Fixed duplicate migration module name\"
  fi
  # 运行迁移
  /app/bin/kg_edu eval \"KgEdu.Release.migrate_all()\" 2>&1 | tail -20
'
"

# 6. 启动所有服务
log "Starting all services..."
ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml up -d"

# 7. 验证
log "Verifying deployment..."
sleep 5
ssh -o StrictHostKeyChecking=no "${REMOTE_HOST}" "cd '${REMOTE_DIR}' && docker compose -f docker-compose.yml ps"

echo ""
echo "=========================================="
echo "  智课云枢 部署完成!"
echo "  访问地址: http://124.222.177.241"
echo "=========================================="
