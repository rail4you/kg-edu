#!/usr/bin/env bash
# ============================================================
#  KgEdu 依赖补丁应用脚本
#
#  将 patches/*.patch 以幂等方式应用到 deps/ 下的依赖源码。
#  场景：jido_ai 的 ReAct 流式工具参数丢失(args_lost)自动重试补丁，
#  该补丁修复 DashScope 大体积工具参数 JSON 前缀丢失导致生成卡死的问题。
#
#  deps/ 目录被 .gitignore 忽略，因此补丁文件必须入库并在
#  每次 mix deps.get（拉取干净依赖）后重新应用：
#
#     ./backend/kg_edu/patches/apply.sh
#
#  或通过 mix 别名自动触发（见 mix.exs aliases）：
#
#     mix deps.get      # 自动附带应用补丁
#     mix patch_deps    # 手动重跑补丁
#
#  脚本幂等：已应用过的补丁会被检测并跳过，可安全重复执行。
# ============================================================
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd || echo /)"
PATCHES_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# deps 目录: 相对脚本位置(仓库内 ../deps；Docker 镜像内同为 ../deps)
DEPS_DIR="$(cd "$PATCHES_DIR/../deps" && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[0;33m'; NC='\033[0m'

if [ ! -d "$DEPS_DIR" ]; then
  echo "${YELLOW}[patch] deps/ 不存在，先执行: cd backend/kg_edu && mix deps.get${NC}"
  exit 1
fi

applied=0
skipped=0
failed=0

for patch_file in "$PATCHES_DIR"/*.patch; do
  [ -e "$patch_file" ] || continue
  patch_name="$(basename "$patch_file")"

  # 从补丁头(--- a/<dep>/...)提取目标依赖名（若补丁覆盖多依赖则逐个处理）
  mapfile -t dep_paths < <(grep -E '^--- a/' "$patch_file" | sed -E 's#^--- a/([^/]+)/.*#\1#' | sort -u)

  for dep in "${dep_paths[@]}"; do
    [ -n "$dep" ] || continue
    if [ ! -d "$DEPS_DIR/$dep" ]; then
      echo "${YELLOW}[patch] ⚠ 依赖目录缺失: deps/$dep — 请先 cd backend/kg_edu && mix deps.get${NC}"
      failed=$((failed + 1))
      continue
    fi

    target_dir="$DEPS_DIR/$dep"

    if (cd "$DEPS_DIR" && git apply --check -p1 "$patch_file" >/dev/null 2>&1); then
      if (cd "$DEPS_DIR" && git apply -p1 "$patch_file" >/dev/null 2>&1); then
        echo "${GREEN}[patch] ✅ 已应用 $patch_name → deps/$dep${NC}"
        applied=$((applied + 1))
      else
        echo "${RED}[patch] ❌ 应用失败: $patch_name → deps/$dep${NC}"
        failed=$((failed + 1))
      fi
    elif (cd "$DEPS_DIR" && git apply --check -R -p1 "$patch_file" >/dev/null 2>&1); then
      echo "${YELLOW}[patch] ⏭ 已应用过, 跳过 $patch_name → deps/$dep${NC}"
      skipped=$((skipped + 1))
    else
      echo "${RED}[patch] ❌ 无法应用且无法反向确认: $patch_name → deps/$dep${NC}"
      failed=$((failed + 1))
    fi
  done
done

echo ""
echo "依赖补丁处理完成: 应用 $applied, 跳过 $skipped, 失败 $failed"
exit $((failed > 0 ? 1 : 0))