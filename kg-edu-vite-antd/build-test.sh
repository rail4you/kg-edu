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
# 同步 MediaPipe 人脸检测资源到 public/mediapipe（wasm 来自依赖；模型首次需下载或预置）
bash scripts/sync-mediapipe-assets.sh || echo "WARN: MediaPipe 资源同步失败，人脸检测可能不可用"
# 去掉 @vitejs/plugin-legacy 后单次构建即可，4GB 足够（之前双构建才需 8GB）
NODE_OPTIONS="--max-old-space-size=4096" bunx vite build

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
# priv/static 下有少量 git 跟踪的源文件（如 files/template.xlsx、logo/ 品牌图），
# 不能整目录删除；用 git clean 只清构建产物（.gitignore 忽略部分），保留跟踪文件。
# 否则旧 hash 文件 + digest 产物无限累积（曾涨到 1.8G 并全部打进镜像）
git clean -fdX priv/static
mkdir -p priv/static
cp -r "$FRONTEND_DIR/dist/"* priv/static/

# MediaPipe 人脸检测资源（wasm + 模型）单独放置，避免被 phx.digest 重命名。
# endpoint.ex 通过 Plug.Static at: "/mediapipe" 从 priv/mediapipe 提供。
rm -rf priv/mediapipe
cp -r "$FRONTEND_DIR/dist/mediapipe" priv/mediapipe

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
