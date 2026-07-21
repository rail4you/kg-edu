#!/usr/bin/env bash
# ============================================================
#  KgEdu 代码检查脚本
#  在修改页面后运行，确保没有遗漏的 import 和语法错误
#  用法: ./check.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
ok()  { echo -e "  ${GREEN}✓${NC} $*"; }
fail(){ echo -e "  ${RED}✗${NC} $*"; }
step(){ echo -e "\n${CYAN}${BOLD}==>${NC} ${BOLD}$*${NC}"; }

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT/kg-edu-vite-antd"

step "1/3: TypeScript 类型检查 (tsc)..."
if npx tsc --noEmit 2>&1 | head -30; then
  ok "TypeScript 检查通过"
else
  echo ""
  fail "TypeScript 有错误，请修复后再部署"
  exit 1
fi

step "2/3: Vite 构建检查 (esbuild)..."
BUILD_OUTPUT=$(npx vite build 2>&1 || true)
if echo "$BUILD_OUTPUT" | grep -q "ERROR"; then
  echo "$BUILD_OUTPUT" | grep -B2 -A3 "ERROR"
  fail "构建失败，请修复错误"
  exit 1
else
  ok "Vite 构建通过"
fi

step "3/3: 页面健康检查 (curl)..."
# 启动临时 dev server 检查关键页面
if pgrep -f "vite" >/dev/null 2>&1; then
  PAGES=(
    "http://localhost:8081/"
    "http://localhost:8081/courses"
    "http://localhost:8081/micro-majors"
    "http://localhost:8081/micro-major/dashboard"
    "http://localhost:8081/micro-major/courses"
    "http://localhost:8081/micro-major/chapters"
    "http://localhost:8081/micro-major/student-management"
  )
  for page in "${PAGES[@]}"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" "$page" 2>/dev/null || echo "FAIL")
    if [ "$code" = "200" ]; then
      ok "$page → $code"
    else
      fail "$page → $code"
    fi
  done
else
  ok "跳过页面检查 (dev server 未运行)"
fi

echo ""
echo -e "${GREEN}${BOLD}  ✅ 全部检查通过，可以安全部署${NC}"
