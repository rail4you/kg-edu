#!/bin/bash
# 一键构建并部署 — 包含前端 (Vite) + 后端 (Phoenix) 的完整构建和 Docker 打包
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/kg-edu-vite-antd"
BACKEND_DIR="$PROJECT_ROOT/backend/kg_edu"
PLATFORM="${PLATFORM:-linux/amd64}"
IMAGE="${IMAGE:-registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest}"

echo "=========================================="
echo "  KgEdu 完整构建脚本"
echo "=========================================="
echo ""
echo "  Platform: $PLATFORM"
echo "  Image:    $IMAGE"
echo ""

# === Step 1: Build Frontend ===
echo "==> Step 1: Building React Frontend (Vite)..."
cd "$FRONTEND_DIR"

# Stop any running Vite dev servers
pkill -f "vite" 2>/dev/null || true
sleep 1

bun install
NODE_OPTIONS="--max-old-space-size=8192" bunx vite build

echo "==> Verifying dist..."
if [ ! -f "dist/index.html" ]; then
  echo "ERROR: dist/index.html not found — build failed!"
  exit 1
fi
ls -la dist/ | head -10

# === Step 2: Build Phoenix with Frontend ===
echo ""
echo "==> Step 2: Copying dist to Phoenix priv/static..."

cd "$BACKEND_DIR"
cp -r "$FRONTEND_DIR/dist/"* priv/static/

echo "==> Running phx.digest..."
MIX_ENV=prod mix phx.digest

# === Step 3: Build Docker Image ===
echo ""
echo "==> Step 3: Building Docker image..."

cd "$PROJECT_ROOT"
docker buildx build \
  --platform "${PLATFORM}" \
  -f backend/kg_edu/Dockerfile \
  -t "${IMAGE}" \
  --load \
  .

# === Step 4: Push (optional) ===
echo ""
echo "==> Step 4: Pushing image..."
docker push "${IMAGE}"

echo ""
echo "=========================================="
echo "  Build Complete!"
echo "  Image: $IMAGE"
echo "=========================================="
echo ""
echo "  Deploy with:"
echo "    docker-compose -f docker-compose.prod.yml up -d"
echo ""
