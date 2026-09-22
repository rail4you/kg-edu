#!/usr/bin/env bash
# ==============================================================
#  yikecheng.com 专用发布脚本（宝塔 HTTPS 服务器）
#  目标: root@47.99.245.49（宝塔 Nginx 接管 80/443 + Let's Encrypt）
#
#  用法:
#    ./deploy-yikecheng.sh [--skip-build]
#
#  只做三件事：构建推送镜像 → 同步无 nginx 的 compose → 重启 backend。
#  刻意不做：不动远端 .env（保登录态）、不动数据库、不建超管、
#  不碰宝塔/80/443/证书（反代指向 127.0.0.1:4000，backend 重启自愈）。
#
#  其它服务器走各自流程（124.222.177.241 用 deploy-zikeyunsu.sh，
#  新服务器用 deploy-kgedu.sh），互不干扰。
# ==============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}✓${NC} $*"; }
fail() { echo -e "  ${RED}✗${NC} $*" >&2; exit 1; }
step() { echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$*${NC}"; }

REMOTE_HOST="root@47.99.245.49"
REMOTE_DIR="/root/kg_edu"
IMAGE="registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest"
SKIP_BUILD=0

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help)
      echo "用法: $0 [--skip-build]"
      echo "  目标固定: ${REMOTE_HOST}:${REMOTE_DIR}（yikecheng.com 宝塔 HTTPS）"
      exit 0 ;;
    *) fail "未知参数: $arg（仅支持 --skip-build）" ;;
  esac
done

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_SRC="$PROJECT_ROOT/docker-compose.bt.yml"
[ -f "$COMPOSE_SRC" ] || fail "缺少 $COMPOSE_SRC"

echo ""
echo -e "${GREEN}${BOLD}  yikecheng 发布（宝塔 HTTPS 专用）${NC}"
echo -e "  目标:   ${BOLD}${REMOTE_HOST}:${REMOTE_DIR}${NC}"
echo -e "  镜像:   ${BOLD}${IMAGE}${NC}"
echo -e "  红线:   不碰 80/443、不碰宝塔、不碰 .env、不动数据库"
echo ""

# ── Step 1: 构建推送 ──────────────────────────────────────────
if [ "$SKIP_BUILD" = "1" ]; then
  step "Step 1/4: 跳过构建 (--skip-build)"
else
  step "Step 1/4: 构建并推送镜像..."
  (cd "$PROJECT_ROOT" && IMAGE="$IMAGE" PLATFORM="linux/amd64" \
    bash kg-edu-vite-antd/build-test.sh) \
    || fail "构建失败，可用 --skip-build 跳过"
  ok "镜像推送完成"
fi

# ── Step 2: 同步 compose（仅此一个文件） ───────────────────────
step "Step 2/4: 同步 compose（无 nginx 版）..."
ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" \
  "cd '$REMOTE_DIR' && cp docker-compose.yml docker-compose.yml.bak-\$(date +%Y%m%d%H%M%S)"
scp "$COMPOSE_SRC" "$REMOTE_HOST:$REMOTE_DIR/docker-compose.yml" >/dev/null
ok "compose 已同步（远端旧文件已备份）"

# ── Step 3: 拉取并重启 backend ────────────────────────────────
step "Step 3/4: 拉取镜像并重启 backend..."
ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" bash -s << 'REMOTE_EOF'
set -e
cd /root/kg_edu
docker compose -f docker-compose.yml pull backend 2>&1 | tail -2 || true
# 防御：如有残留 docker nginx 容器，移除（宝塔持有 80/443，不允许复活）
docker rm -f kg-edu-nginx 2>/dev/null || true
# 只起 backend+db，绝不 up 全量（compose 里也没有 nginx，但双保险）
docker compose -f docker-compose.yml up -d db backend 2>&1 | tail -3
REMOTE_EOF
ok "backend 重启中（约 30-60 秒恢复）"

# ── Step 4: 验证 ──────────────────────────────────────────────
step "Step 4/4: 验证..."
ssh -o StrictHostKeyChecking=no "$REMOTE_HOST" bash -s << 'CHECK_EOF'
set -e
echo "  等待后端就绪..."
for i in $(seq 1 30); do
  if curl -sf -m 5 http://127.0.0.1:4000/api/health 2>/dev/null | grep -q ok; then
    echo "  ✓ 后端健康 (4000)"
    break
  fi
  [ "$i" = "30" ] && { echo "  ✗ 后端 60s 未就绪，请看日志"; exit 1; }
  sleep 2
done
# 宝塔 80 入口（经反代）
CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 8 -H 'Host: yikecheng.com' http://127.0.0.1/ || true)
echo "  宝塔 80 入口: $CODE"
# 宝塔 nginx 存活确认（没重启它，只确认）
pgrep -f '/www/server/nginx/sbin/nginx' >/dev/null \
  && echo "  ✓ 宝塔 Nginx 运行中" || echo "  ✗ 宝塔 Nginx 不在运行！"
CHECK_EOF
ok "验证完成"

echo ""
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}  发布完成！${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "  请在浏览器确认: ${BOLD}https://yikecheng.com${NC}"
echo -e "  后端日志: ssh $REMOTE_HOST 'docker logs -f kg-edu-backend'"
echo ""
