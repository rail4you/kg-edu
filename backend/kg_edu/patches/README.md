# 依赖补丁 (Dependency Patches)

`deps/` 目录被 `.gitignore` 忽略，因此对第三方依赖源码的修复必须以补丁文件形式
入库，并在每次拉取/编译依赖后重新应用。

## 补丁列表

| 补丁 | 目标依赖 | 说明 |
|------|---------|------|
| `0001-jido_ai-args_lost_retry.patch` | `jido_ai 2.2.0` | ReAct 流式工具参数丢失(args_lost)自动重试：DashScope 等流式接口在传输大体积工具参数 JSON 时可能丢失开头分片，导致工具收到空参数后无限重试、生成“卡住”。补丁在工具参数解码失败时丢弃该轮并自动重发 LLM 请求（≤2次）。 |

## 生成补丁

```bash
# 从干净依赖(mix deps.get 后) 与已补丁版本生成
cp -r /path/to/pristine/deps/jido_ai /tmp/jido_clean
cp -r deps/jido_ai /tmp/jido_patched
diff -u /tmp/jido_clean/jido_ai/lib/jido_ai/reasoning/react/runner.ex \
        /tmp/jido_patched/jido_ai/lib/jido_ai/reasoning/react/runner.ex \
  > patches/NNNN-<dep>-<desc>.patch
# 然后把 --- /tmp/jido_clean/... 改为 --- a/<dep>/...；+++ 对应改为 +++ b/<dep>/...
```

路径约定：补丁内路径相对于 `backend/kg_edu/deps/` 根目录（`a/jido_ai/lib/...`），
脚本用 `git apply -p1` 在 deps 根目录应用。

## 应用补丁（幂等）

```bash
# 方式1: 手动
./backend/kg_edu/patches/apply.sh

# 方式2: mix 别名（推荐）— mix deps.get 后自动触发，也可随时手动执行
cd backend/kg_edu
mix deps.get      # 自动附带补丁
mix patch_deps    # 手动重跑
```

脚本会逐补丁检查：未应用则应用，已应用则跳过，无法应用则报错退出（非 0）。