# 前端 React SPA 迁移到 Phoenix 方案

> 将 React (Vite) 构建产物迁移到 Phoenix 静态服务，结合 ash_typescript Hook 替代 JWT 手动鉴权，最终只打包一套 Elixir Phoenix 镜像。

**创建日期**: 2026-06-21  
**状态**: 待审核

---

## 目录

1. [现状分析](#1-现状分析)
2. [目标架构](#2-目标架构)
3. [关键决策：ash_typescript Hook 替代 JWT 手动传递](#3-关键决策ash_typescript-hook-替代-jwt-手动传递)
4. [实施步骤](#4-实施步骤)
5. [路由冲突处理](#5-路由冲突处理)
6. [构建和部署](#6-构建和部署)
7. [测试验证方案](#7-测试验证方案)
8. [回滚方案](#8-回滚方案)
9. [风险与缓解](#9-风险与缓解)

---

## 1. 现状分析

### 1.1 开发环境架构（迁移后）

```
Browser → :8081 (Vite) → proxy 分发
  ├─ /rpc                  → :4000 (Phoenix)
  ├─ /api                  → :4000
  ├─ /api/upload           → :4000
  ├─ /api/sts-token        → :4000
  ├─ /api/assistant        → :4000
  ├─ /agent  [rewrite]     → :4000
  ├─ /competency-graph     → :4000
  └─ /curriculum           → :4000

Vite 自己处理:
  ├─ /src/*               → React 源码 (HMR)
  ├─ /@vite/*             → Vite 内部
  └─ SPA fallback         → index.html (dev)
```

### 1.2 生产环境架构（当前）

```
Browser → :80 (Nginx) → Docker 内部路由
  ├─ /agent/  [rewrite]    → ai-agent:5050
  ├─ /api/                 → frontend:3000 (Hono) → 代理到 backend:4000
  ├─ /rpc/                 → frontend:3000 → backend:4000
  ├─ /competency-graph/    → frontend:3000 → backend:4000
  ├─ /curriculum/          → frontend:3000 → backend:4000
  └─ /                     → frontend:3000 (Vite SPA dist)
```

**4 个 Docker 容器**: db, backend, ai-agent, frontend, nginx

关键在于：Express + Pi SDK 已全部迁移到 Phoenix (:4000)，但 **frontend 容器还在跑**，它只做两件事：
1. 用 Hono 服务 React 的 `dist/` 静态文件
2. 把 API 请求代理到 backend:4000

**这两件事 Phoenix 完全可以自己做。**

### 1.3 当前鉴权方案：JWT 手动传递

**前端侧** (`kg-edu-vite-antd/src/`):

```
登录流程:
  signInTenant RPC → JWT token → sessionStorage.setItem("jwt_access_token")

每次 API 调用:
  getAuthHeaders() → Authorization: Bearer <token> → 手动传入 headers 参数

全局拦截器:
  fetch-interceptor.ts → 拦截 401/403 → refresh_session → 失败跳转登录

AG-UI 聊天:
  agui-assistant.ts → getAssistantHeaders() → Authorization + X-Org-Schema
```

**后端侧** (`backend/kg_edu/lib/kg_edu_web/`):

```
router.ex: api pipeline
  → plug :load_from_bearer       (AshAuthentication)
  → plug :set_actor, :user        (AshAuthentication)
  → plug KgEduWeb.Plugs.LoadActor (自定义: 验证 JWT, 加载用户)

SetTenantFromToken plug:
  → 手动 Base64 解码 JWT payload
  → 提取 "tenant" 和 "sub" (user id)
  → Ash.read 加载用户
  → 设置 conn.assigns[:current_user], conn.private[:ash_tenant]
```

**痛点**：
- 每个 API 调用都要手动传 `headers: getAuthHeaders()`
- `fetch-interceptor.ts` 是全局猴子补丁，脆弱且难调试
- `SetTenantFromToken` 手写 JWT 解码逻辑，没有利用 Ash 的类型系统

### 1.4 生成的 ash_rpc.ts 现状

当前 `ash_rpc.ts` (87,377 行)：
- 每个 RPC 函数内部有 `let processedConfig = config;` 占位
- **没有配置** `rpc_action_before_request_hook`
- **没有导入** `RpcHooks` 模块
- Hook 基础设施已就绪，但**未启用**

---

## 2. 目标架构

### 2.1 开发环境（不变）

```
Browser → :8081 (Vite) → proxy → :4000 (Phoenix)
  - Vite HMR 热更新
  - 所有 API 走 proxy
  - LiveView 页面通过 Phoenix 直接访问 (可选)
```

### 2.2 生产环境（目标）

```
Browser → :80 (Nginx 可选) → :4000 (Phoenix) ← 一个镜像
  ├─ /                     → index.html (React SPA)
  ├─ /assets/*             → 静态 JS/CSS/图片
  ├─ /rpc/*                → Ash RPC API
  ├─ /api/*                → REST API (chat, upload, generation, etc.)
  ├─ /live/*               → Phoenix LiveView (管理后台)
  ├─ /admin/*              → AshAdmin (开发/运维)
  └─ /*path                → SPA fallback (React Router)
```

**简化后**:

| 组件 | 之前 | 之后 |
|------|------|------|
| Docker 镜像数 | 4 (backend, frontend, agent, nginx) | **1** (backend) |
| 容器数 | 5 | 2 (db + backend, nginx 可选) |
| 端口 | 80, 3000, 4000, 5050 | **4000** (或 80 via nginx) |
| 前端部署 | 独立容器 + Hono 服务 | Phoenix 静态文件服务 |

### 2.3 鉴权方案（目标）

```
前端侧 (一次配置):
  rpcHooks.ts → setBeforeRequestHook()
    → 从 sessionStorage 读 jwt_access_token
    → 自动注入 Authorization header
    → 所有 RPC 调用无需手动传 headers

后端侧 (保持不变):
  SetTenantFromToken plug → 解码 JWT → 设置 tenant + user
  LoadActor plug → 加载用户并设为 Ash actor
```

---

## 3. 关键决策：ash_typescript Hook 替代 JWT 手动传递

### 3.1 ash_typescript Lifecycle Hooks 机制

ash_typescript 提供 `beforeRequest` / `afterRequest` 钩子，在每次 RPC 调用前后自动执行：

```typescript
// 设置全局 beforeRequest hook（只需调用一次）
import { setBeforeRequestHook } from './ash_rpc';

setBeforeRequestHook(async (actionName, config) => {
  const token = sessionStorage.getItem('jwt_access_token');
  if (token) {
    return {
      ...config,
      headers: {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      },
    };
  }
  return config;
});
```

配置后，所有 RPC 调用自动携带 Authorization header：

```typescript
// 之前：每次都要手动传 headers
const result = await listCourses({
  tenant: 'org_xxx',
  fields: ['id', 'title'],
  headers: getAuthHeaders(),  // ← 繁琐
});

// 之后：完全不需要关心 headers
const result = await listCourses({
  tenant: 'org_xxx',
  fields: ['id', 'title'],
  // headers 自动注入！
});
```

### 3.2 需要修改的配置

#### 3.2.1 Elixir 侧 (`config/config.exs`)

```elixir
# 在现有 ash_typescript 配置中添加
config :ash_typescript,
  # ... 现有配置保持不变 ...
  
  # === 新增：生命周期 Hook ===
  rpc_action_before_request_hook: "RpcHooks.beforeRequest",
  rpc_action_after_request_hook: "RpcHooks.afterRequest",
  
  # 导入 hooks 模块到生成的 ash_rpc.ts
  import_into_generated: [
    %{
      import_name: "RpcHooks",
      file: "./rpcHooks"
    }
  ]
```

#### 3.2.2 前端侧 (新建 `src/lib/rpcHooks.ts`)

```typescript
// src/lib/rpcHooks.ts
// ash_typescript lifecycle hooks — 集中管理 RPC 请求的认证和监控

import type { ActionConfig, ValidationConfig } from './ash_rpc';

/**
 * beforeRequest Hook — 自动注入 JWT 认证头
 * 在所有 RPC action 调用前执行
 */
export async function beforeRequest(
  actionName: string,
  config: ActionConfig
): Promise<ActionConfig> {
  const token = sessionStorage.getItem('jwt_access_token');
  const tenant = sessionStorage.getItem('tenant');

  const headers: Record<string, string> = {
    ...config.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // 注意: tenant 参数已在 RPC body 中传递，不需要额外 header
  // 但某些 API 也需要 X-Org-Schema header（如 agent API），这里统一加
  if (tenant) {
    headers['X-Org-Schema'] = tenant;
  }

  return {
    ...config,
    headers,
  };
}

/**
 * afterRequest Hook — 全局错误处理和日志
 */
export async function afterRequest(
  actionName: string,
  response: Response,
  result: any | null,
  config: ActionConfig
): Promise<void> {
  // 处理 401/403 认证失败 — 透明刷新或跳转登录
  if (response.status === 401 || response.status === 403) {
    // 不要拦截 refresh_session 本身
    if (actionName === 'refresh_session') return;

    const currentToken = sessionStorage.getItem('jwt_access_token');
    if (currentToken) {
      // 尝试刷新 token（沿用现有的 refreshAuthToken 逻辑）
      const { refreshAuthToken } = await import('./auth-check');
      const newToken = await refreshAuthToken(currentToken);
      if (newToken) {
        // 刷新成功，调用方已有重试逻辑（fetch-interceptor）
        return;
      }
    }

    // 刷新失败，跳转登录页
    const { clearAuthStorage, getLoginRedirectPath } = await import('./auth-check');
    const role = sessionStorage.getItem('user_role') || '';
    clearAuthStorage();
    setTimeout(() => {
      window.location.href = getLoginRedirectPath(role);
    }, 100);
    return;
  }

  // 生产环境可接入 Sentry/Datadog 等监控
  if (import.meta.env.PROD && response.status >= 500) {
    console.error(`[RPC Error] ${actionName}: ${response.status}`, result);
  }
}
```

### 3.3 非 RPC API 调用的鉴权处理

有些 API 不走 ash_rpc（直接 fetch），如：
- `/api/assistant/ag-ui` (SSE 聊天)
- `/api/upload` (文件上传)
- `/agent/api/generate_ai_exercise`

这些需要**保留**当前的 `getAuthHeaders()` 或 `getAssistantHeaders()` 模式，但可以封装一个统一的工具函数：

```typescript
// src/lib/api-headers.ts (统一版)
export function getApiHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  const token = sessionStorage.getItem('jwt_access_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const tenant = sessionStorage.getItem('tenant');
  if (tenant) {
    headers['X-Org-Schema'] = tenant;
  }

  return headers;
}
```

**重要**: `fetch-interceptor.ts` 的 401 拦截和透明刷新逻辑仍然保留，用于非 RPC 的 fetch 请求。它与 ash_typescript hooks 互补：
- **ash_typescript hooks**: 处理 ash_rpc.ts 生成的 RPC 调用（`/rpc/run`, `/rpc/validate`）
- **fetch-interceptor**: 处理所有其他 fetch 调用（chat, upload, agent API 等）

---

## 4. 实施步骤

### Phase 1: 启用 ash_typescript Hooks（纯前端改动，无风险）

#### 步骤 1.1: 在 `config.exs` 中添加 Hook 配置

**文件**: `backend/kg_edu/config/config.exs`

在现有 `ash_typescript` 配置块中添加：

```elixir
config :ash_typescript,
  # ... 现有配置不变 ...
  
  # === 新增：生命周期 Hook 配置 ===
  rpc_action_before_request_hook: "RpcHooks.beforeRequest",
  rpc_action_after_request_hook: "RpcHooks.afterRequest",
  rpc_validation_before_request_hook: "RpcHooks.beforeValidationRequest",
  
  # 导入 hooks 模块
  import_into_generated: [
    %{
      import_name: "RpcHooks", 
      file: "./rpcHooks"
    }
  ]
```

#### 步骤 1.2: 创建 `src/lib/rpcHooks.ts`

**文件**: `kg-edu-vite-antd/src/lib/rpcHooks.ts`

（内容见上面 3.2.2 节，完整代码）

#### 步骤 1.3: 重新生成 `ash_rpc.ts`

```bash
cd backend/kg_edu
mix ash_typescript.codegen --output "../../kg-edu-vite-antd/src/lib/ash_rpc.ts"
```

或者重启 `mix phx.server`（开发模式自动重新生成）。

**验证**: 检查生成的 `ash_rpc.ts` 顶部是否有：
```typescript
import { RpcHooks } from "./rpcHooks";
```
并在每个 RPC 函数中看到 `processedConfig` 被 `beforeRequest` hook 处理。

#### 步骤 1.4: 清理前端代码中的手动 headers 传递

**渐进式清理**（可分批进行）：

1. **登录流程** (`auth-context.tsx`): 保持不变，因为登录不需要 auth header
2. **课程列表等普通 CRUD**: 移除 `headers: getAuthHeaders()` 参数
3. **AI 生成等 Agent API**: 保留手动 headers（非 RPC 调用）
4. **文件上传**: 保留（需要 `Content-Type: multipart/form-data`）

**改动量估算**:
- RPC 调用（通过 ash_rpc）: 约 50+ 处调用点，只需删除 `headers` 参数
- 非 RPC 调用: 保持不变或改用统一的 `getApiHeaders()`

#### 步骤 1.5: 验证 Phase 1

在开发环境验证：
```bash
./dev.sh start
# 访问 http://localhost:8081
# 1. 登录 → 检查 sessionStorage 中有 jwt_access_token
# 2. 浏览课程列表 → Network 面板确认 RPC 请求自动携带 Authorization
# 3. 打开 Chat → 确认 ag-ui 请求携带 Authorization
# 4. Token 过期 → 确认自动刷新或跳转登录
```

---

### Phase 2: Phoenix 静态文件服务 React dist

#### 步骤 2.1: 更新 Phoenix Endpoint 静态文件配置

**文件**: `backend/kg_edu/lib/kg_edu_web.ex`

```elixir
# 修改 static_paths，包含 React SPA 的构建输出
def static_paths, do: ~w(assets fonts images favicon.ico robots.txt index.html vite.svg)
```

**文件**: `backend/kg_edu/config/prod.exs`

```elixir
config :kg_edu, KgEduWeb.Endpoint,
  cache_static_manifest: "priv/static/cache_manifest.json",
  # 确保包含 SPA 构建产物的所有文件类型
  static_paths: ~w(
    assets fonts images logo files favicon.ico robots.txt index.html vite.svg
    .well-known
  )
```

#### 步骤 2.2: 添加 SPA fallback 路由

**当前 `router.ex` 最后一行**:
```elixir
scope "/", KgEduWeb do
  pipe_through :browser
  get "/*path", PageController, :index
end
```

这个 catch-all 路由已经存在，会为所有未匹配的路径返回 `priv/static/index.html`。但需要确保 **LiveView 路由优先级高于 catch-all**。

**验证路由优先级** (当前 router.ex 顺序):

```
1. /api/*           (api pipeline)
2. /rpc/*           (api pipeline)  
3. /api/assistant/* (api pipeline)
4. /competency-graph/* (api pipeline)
5. /curriculum/*    (api pipeline)
6. /import*         (api pipeline)
7. /api/json/*      (api pipeline)
8. /webhooks/*      (api pipeline)
9. /api/curriculum/* (api pipeline)
10. /live/*          (browser pipeline, LiveView)
11. /dev/*           (browser pipeline, dev only)
12. /admin/*         (browser pipeline, dev only)
13. /*path           (browser pipeline, SPA fallback) ← 最后
```

**结论**: 当前路由顺序是正确的，SPA catch-all 在最末尾，不会与 API/LiveView 冲突。

#### 步骤 2.3: 优化 SPA 路由的 Controller

**文件**: `backend/kg_edu/lib/kg_edu_web/controllers/page_controller.ex`

```elixir
defmodule KgEduWeb.PageController do
  use KgEduWeb, :controller

  # SPA 入口 — 所有前端路由的 fallback
  def index(conn, _params) do
    conn
    |> put_resp_header("content-type", "text/html; charset=utf-8")
    |> put_resp_header("cache-control", "no-cache, no-store, must-revalidate")
    |> put_resp_header("pragma", "no-cache")
    |> put_resp_header("expires", "0")
    |> send_file(200, Application.app_dir(:kg_edu, "priv/static/index.html"))
  end
end
```

**为什么用 `send_file` 而不是 `render`**:
- Vite 构建的 `index.html` 包含 hashed 的 script/link 标签
- 不能通过 Phoenix 模板渲染，必须原样服务
- 设置 `no-cache` 确保浏览器在部署更新后获取最新的 index.html

#### 步骤 2.4: 处理静态资源路径

Vite 构建产物中的资源路径是**绝对路径**（如 `/assets/index-xxxx.js`），这与 Phoenix 的 `Plug.Static` 服务的路径完全兼容：

```
Vite dist/ 结构:               Phoenix priv/static/ 目录:
dist/                          priv/static/
├── index.html                 ├── index.html
├── assets/                    ├── assets/
│   ├── index-xxx.js           │   ├── index-xxx.js
│   ├── index-xxx.css          │   │   ... (Vite 产物)
│   └── ...                    │   └── ... (Phoenix esbuild 产物)
├── vite.svg                   ├── vite.svg
└── ...                        ├── favicon.ico
                               └── ...
```

**文件合并策略**: Vite 构建产物和 Phoenix esbuild 产物都放在 `assets/` 目录下。由于 Vite 使用内容哈希命名（`index-Slq6d9NM.js`），不会与 Phoenix 的文件冲突。

---

### Phase 3: 构建流程

#### 步骤 3.1: 自定义 Mix Task 构建前端

**新建文件**: `backend/kg_edu/lib/mix/tasks/build_frontend.ex`

```elixir
defmodule Mix.Tasks.BuildFrontend do
  use Mix.Task

  @shortdoc "Build React frontend and copy to priv/static"
  def run(_args) do
    frontend_dir = Path.expand("../../../kg-edu-vite-antd", __DIR__)

    Mix.shell().info("Installing frontend dependencies...")
    System.cmd("bun", ["install"], cd: frontend_dir)

    Mix.shell().info("Building frontend...")
    System.cmd("bun", ["run", "build"], cd: frontend_dir)

    Mix.shell().info("Copying dist to priv/static...")
    dist_dir = Path.join(frontend_dir, "dist")
    static_dir = Path.expand("priv/static", File.cwd!())

    # 清空 Vite 旧产物（保留 Phoenix 自身的 assets）
    Path.wildcard(Path.join(static_dir, "assets/*"))
    |> Enum.reject(&String.contains?(&1, "phx-"))  # 保留 Phoenix live 相关
    |> Enum.each(&File.rm!/1)

    # 复制 dist 内容
    File.cp_r!(dist_dir, static_dir)

    Mix.shell().info("Frontend built and copied successfully!")
  end
end
```

#### 步骤 3.2: 更新 Mix aliases

**文件**: `backend/kg_edu/mix.exs`

```elixir
defp aliases do
  [
    setup: ["deps.get", "ash.setup", "assets.setup", "assets.build", "run priv/repo/seeds.exs"],
    "ecto.setup": ["ecto.create", "ecto.migrate", "run priv/repo/seeds.exs"],
    "ecto.reset": ["ecto.drop", "ecto.setup"],
    test: ["ash.setup --quiet", "test"],
    "assets.setup": ["tailwind.install --if-missing", "esbuild.install --if-missing"],
    "assets.build": ["tailwind kg_edu", "esbuild kg_edu"],
    
    # === 新增 ===
    "assets.build_frontend": ["build_frontend"],      # 单独构建前端
    "assets.build_all": ["assets.build_frontend", "assets.build"],  # 构建所有静态资源
    "assets.deploy": [
      "assets.build_frontend",                         # 先构建 React
      "tailwind kg_edu --minify",
      "esbuild kg_edu --minify",
      "phx.digest"                                     # 最后 digest 所有静态文件
    ]
  ]
end
```

#### 步骤 3.3: 更新 Dockerfile

**文件**: `backend/kg_edu/Dockerfile`（修改版）

关键改动：在多阶段构建中增加前端构建步骤。

```dockerfile
# Stage 1: Frontend Build (Node.js)
FROM oven/bun:1-alpine AS frontend-builder
WORKDIR /frontend
COPY kg-edu-vite-antd/package.json kg-edu-vite-antd/bun.lock ./
RUN bun install --frozen-lockfile
COPY kg-edu-vite-antd/ ./
RUN bun run build

# Stage 2: Backend Build (Elixir)
FROM hexpm/elixir:1.17.3-erlang-27.1.2-ubuntu-jammy-20240808 AS backend-builder
# ... 现有的 Elixir 编译逻辑 ...

# Stage 3: Runtime
FROM ubuntu:jammy-20240808
# ... 现有的运行环境 ...
# 从 frontend-builder 复制 dist
COPY --from=frontend-builder /frontend/dist ./priv/static/
# 从 backend-builder 复制 release
COPY --from=backend-builder /app/_build/prod/rel/kg_edu ./
```

**注意**: 在实际实现中，更简单的做法是在 CI 中先构建前端，然后把 dist 复制到 backend 项目目录，再执行 Docker build。这样 Dockerfile 几乎不需要改动。

---

### Phase 4: Docker 部署简化

#### 步骤 4.1: CI/CD 构建脚本

```bash
#!/bin/bash
# build-and-deploy.sh — 一键构建和部署

set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/kg-edu-vite-antd"
BACKEND_DIR="$PROJECT_ROOT/backend/kg_edu"

echo "=== Step 1: Build Frontend ==="
cd "$FRONTEND_DIR"
bun install
bun run build

echo "=== Step 2: Copy dist to Phoenix ==="
rm -rf "$BACKEND_DIR/priv/static/assets/"*.js "$BACKEND_DIR/priv/static/assets/"*.css 2>/dev/null || true
cp -r "$FRONTEND_DIR/dist/"* "$BACKEND_DIR/priv/static/"

echo "=== Step 3: Build Phoenix Release ==="
cd "$BACKEND_DIR"
MIX_ENV=prod mix assets.deploy  # 这会先构建前端，再 digest
MIX_ENV=prod mix release

echo "=== Step 4: Build Docker Image ==="
docker build \
  -t registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest \
  -f Dockerfile \
  .

echo "=== Step 5: Push Image ==="
docker push registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest

echo "=== Done! ==="
echo "Deploy with: docker-compose -f docker-compose.prod.yml up -d"
```

#### 步骤 4.2: 简化后的 docker-compose.prod.yml

```yaml
version: '3.8'

services:
  db:
    image: postgres:16-alpine
    container_name: kg-edu-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: kg_edu_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - kg-edu-network

  backend:
    image: registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest
    container_name: kg-edu-backend
    restart: unless-stopped
    environment:
      - DATABASE_URL=ecto://postgres:postgres@db:5432/kg_edu_dev
      - SECRET_KEY_BASE=${SECRET_KEY_BASE}
      - TOKEN_SIGNING_SECRET=${TOKEN_SIGNING_SECRET}
      - PHX_HOST=localhost
      - PORT=4000
      - PHX_SERVER=true
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - QWEN_API_KEY=${QWEN_API_KEY}
    ports:
      - "4000:4000"  # 直接暴露，或通过 nginx 代理
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - backend_uploads:/app/priv/uploads
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - kg-edu-network

  # Nginx 可选 — 用于 TLS 终止、负载均衡
  nginx:
    image: nginx:alpine
    container_name: kg-edu-nginx
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - backend
    networks:
      - kg-edu-network

volumes:
  postgres_data:
    driver: local
  backend_uploads:
    driver: local

networks:
  kg-edu-network:
    driver: bridge
```

**变化**: 
- 移除 `ai-agent` 服务 ✅ (已在之前迁移中完成)
- 移除 `frontend` 服务 ← **本次迁移的目标**
- 移除 nginx 的复杂路径分发配置
- Phoenix 直接暴露 :4000 端口服务所有请求

#### 步骤 4.3: 简化 Nginx 配置

```nginx
# nginx/nginx.conf (简化版)

upstream backend {
    server backend:4000;
}

server {
    listen 80;
    server_name _;

    # 所有请求直接转发到 Phoenix
    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # SSE 支持
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
```

---

## 5. 路由冲突处理

### 5.1 Phoenix LiveView vs React SPA 路由

| 路径 | 处理方式 | 说明 |
|------|----------|------|
| `/live/*` | Phoenix LiveView | 管理后台 CRUD |
| `/dev/*` | Phoenix LiveDashboard | 仅开发环境 |
| `/admin/*` | AshAdmin | 仅开发环境 |
| `/api/*` | Phoenix API | REST/SSE 端点 |
| `/rpc/*` | Ash RPC | TypeScript 类型安全 API |
| `/*` (其他) | React SPA | index.html fallback |

**关键原则**: 所有 API/LiveView 路由必须在 `/*path` catch-all 之前定义。当前 router.ex 已满足此要求。

### 5.2 前端 Router (React Router) 路径

需要避免与 Phoenix 路由冲突的前端路径：

```
React Router 路径:
  /login                          ✅ 不冲突
  /login?role=student             ✅
  /dashboard                      ✅
  /courses/:id                    ✅
  /teacher/*                      ✅
  /student/*                      ✅
  /admin-portal/*                 ✅ (不是 /admin/)
  /micro-major/*                  ✅
```

**注意**: 前端管理后台路径是 `/admin-portal/`，不会与 Phoenix 的 `/admin/` (AshAdmin) 冲突。

---

## 6. 构建和部署

### 6.1 开发环境工作流（不变）

```bash
# 开发
./dev.sh start
# → Phoenix :4000 + Vite :8081, Vite 代理 API 到 :4000
# HMR 热更新工作中
# ash_rpc.ts 自动重新生成
```

### 6.2 生产构建工作流

```bash
# 完整构建
cd backend/kg_edu

# 方式 1: 使用 mix alias
MIX_ENV=prod mix assets.deploy
MIX_ENV=prod mix release

# 方式 2: 使用构建脚本
../../build-and-deploy.sh
```

### 6.3 生产环境验证清单

```bash
# 1. 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 2. 验证 Phoenix 健康
curl http://localhost:4000/health
# → {"status":"ok"}

# 3. 验证 SPA 入口
curl http://localhost:4000/
# → 返回 index.html (包含 <div id="root">)

# 4. 验证 SPA 路由 fallback
curl http://localhost:4000/login
# → 返回 index.html (同上)

# 5. 验证 API 端点
curl -X POST http://localhost:4000/rpc/run \
  -H "Content-Type: application/json" \
  -d '{"action":"sign_in_tenant","tenant":"org_xxx",...}'
# → 返回 JSON

# 6. 验证 LiveView
curl http://localhost:4000/live/users
# → 返回 HTML (LiveView 页面)

# 7. 验证静态资源
curl http://localhost:4000/assets/index-xxx.js
# → 返回 JavaScript (Vite 产物)
```

---

## 7. 测试验证方案

### 7.1 Phase 1 测试（Hook 鉴权）

#### 测试用例 H1: RPC 自动注入 token
```
前置: 已登录，sessionStorage 中有 jwt_access_token
操作: 调用 listCourses({ tenant, fields: [...] })（不传 headers）
验证: Network 面板中 Request Headers 包含 Authorization: Bearer <token>
```

#### 测试用例 H2: 未登录 RPC 调用
```
前置: 清除 sessionStorage
操作: 访问需要认证的页面
验证: 自动跳转到 /login
```

#### 测试用例 H3: Token 过期自动刷新
```
前置: 修改 sessionStorage 中 token 为已过期的 JWT
操作: 调用 listCourses()
验证: 
  1. 第一个请求返回 401
  2. afterRequest hook 检测到 401
  3. 自动调用 refresh_session
  4. 新 token 写入 sessionStorage
  5. fetch-interceptor 重试原始请求成功
```

#### 测试用例 H4: Token 刷新失败
```
前置: 后端 refresh_session 端点不可用
操作: 调用 listCourses()（已过期 token）
验证: 清除 sessionStorage，跳转到 /login
```

### 7.2 Phase 2 测试（静态文件服务）

#### 测试用例 S1: SPA 入口加载
```
操作: curl http://localhost:4000/
验证: 
  - HTTP 200
  - Content-Type: text/html; charset=utf-8
  - 返回内容包含 <div id="root"></div>
  - 返回内容包含 <script type="module" src="/assets/index-xxx.js">
```

#### 测试用例 S2: 静态资源访问
```
操作: curl http://localhost:4000/assets/index-xxx.js
验证: 
  - HTTP 200
  - Content-Type: application/javascript
  - 响应体为实际的 JavaScript 代码
```

#### 测试用例 S3: SPA 路由 fallback
```
操作: curl http://localhost:4000/dashboard
验证: 返回 index.html (与 S1 相同内容)

操作: curl http://localhost:4000/courses/any-id
验证: 返回 index.html
```

#### 测试用例 S4: LiveView 路由不被 SPA 覆盖
```
操作: curl http://localhost:4000/live/users
验证: 
  - 返回 LiveView HTML (不是 index.html)
  - 包含 phx-socket 等 LiveView 标记
```

#### 测试用例 S5: API 路由正常
```
操作: curl -X POST http://localhost:4000/rpc/run -d '{...}'
验证: 返回 JSON (不是 HTML)
```

### 7.3 端到端测试（E2E）

使用 Playwright 验证完整用户流程：

```typescript
// e2e/frontend-migration.spec.ts
import { test, expect } from '@playwright/test';

test.describe('前端迁移验证', () => {
  
  test('E1: 登录流程完整', async ({ page }) => {
    await page.goto('/login?role=teacher');
    await page.fill('[name="memberId"]', 'teacher1');
    await page.fill('[name="password"]', 'password123');
    await page.selectOption('[name="tenant"]', 'org_demo');
    await page.click('button[type="submit"]');
    
    // 验证跳转到 dashboard
    await page.waitForURL('/dashboard');
    // 验证 sessionStorage 中有 token
    const token = await page.evaluate(() => sessionStorage.getItem('jwt_access_token'));
    expect(token).toBeTruthy();
  });

  test('E2: 课程列表 RPC 调用使用 Hook 鉴权', async ({ page }) => {
    // 先登录
    await loginAsTeacher(page);
    
    // 拦截 RPC 请求
    const rpcRequest = page.waitForRequest(req => 
      req.url().includes('/rpc/run') && req.method() === 'POST'
    );
    
    await page.goto('/courses');
    const request = await rpcRequest;
    
    // 验证 Header 中有 Authorization
    const headers = request.headers();
    expect(headers['authorization']).toContain('Bearer ');
  });

  test('E3: SPA 路由刷新后正常工作', async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/courses/some-course-id');
    
    // 刷新页面
    await page.reload();
    
    // 验证仍然在课程详情页（不是 404）
    await expect(page).toHaveURL(/\/courses\//);
  });

  test('E4: Agent Chat SSE 正常工作', async ({ page }) => {
    await loginAsTeacher(page);
    await page.goto('/teacher/chat');
    
    // 输入消息
    await page.fill('[data-testid="chat-input"]', '列出所有课程');
    await page.click('[data-testid="chat-send"]');
    
    // 验证收到回复
    await expect(page.locator('[data-testid="chat-message"]')).toHaveCount(2, { timeout: 10000 });
  });

  test('E5: Token 过期自动刷新并重试', async ({ page }) => {
    await loginAsTeacher(page);
    
    // 注入过期 token
    await page.evaluate(() => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjEwMDAwMDAwMDAsInN1YiI6InRlc3QifQ.xxx';
      sessionStorage.setItem('jwt_access_token', expiredToken);
    });
    
    // 触发 API 调用
    await page.goto('/courses');
    
    // 验证能正常加载（说明 token 刷新成功）
    await expect(page.locator('.course-list')).toBeVisible({ timeout: 15000 });
  });

  test('E6: 直接访问 API 端点返回 JSON', async ({ request }) => {
    // 不需要认证的端点
    const response = await request.get('/api/health');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('ok');
  });
});
```

### 7.4 性能对比测试

| 指标 | 之前 (Nginx → 3 层) | 之后 (Nginx → Phoenix) | 测试方法 |
|------|---------------------|------------------------|----------|
| 首页加载时间 | ? | ? | Lighthouse / WebPageTest |
| RPC 响应延迟 | ~Nginx+Frontend+Backend | ~Nginx+Backend | curl -w "%{time_total}" |
| SSE 流延迟 | ? | ? | 首字节时间 |
| 静态资源加载 | ? | ? | Network 面板 waterfall |

---

## 8. 回滚方案

### 8.1 快速回滚（Phase 1 Hook 问题）

```bash
# 恢复 ash_rpc.ts 到迁移前版本
git checkout kg-edu-vite-antd/src/lib/ash_rpc.ts

# 注释掉 config.exs 中的 hook 配置
# 重启开发服务器
./dev.sh restart
```

### 8.2 完整回滚（Phase 2 静态文件服务）

```bash
# 恢复旧的 docker-compose.prod.yml
git checkout docker-compose.prod.yml

# 重新部署旧版本
docker-compose -f docker-compose.prod.yml up -d

# 检查服务
docker-compose ps
```

### 8.3 数据安全

- 本次迁移**不涉及数据库 schema 变更**
- 不修改任何后端 API 逻辑
- 仅改变静态文件服务方式和鉴权 header 注入方式
- JWT 签发/验证逻辑完全不变

---

## 9. 风险与缓解

| 风险 | 影响 | 概率 | 缓解方案 |
|------|------|------|----------|
| ash_typescript hook 与现有代码冲突 | RPC 调用失败 | 低 | Phase 1 先测试，不影响生产 |
| Vite dist 与 Phoenix assets 文件名冲突 | 静态资源 404 | 低 | Vite 使用 hash 命名，不会冲突 |
| React Router 与 LiveView 路由冲突 | 页面渲染错误 | 低 | 已分析路由顺序，无冲突 |
| 大文件 dist 复制导致 Docker 镜像过大 | 部署慢 | 中 | 使用多阶段构建 + .dockerignore |
| 开发环境与生产环境行为不一致 | 测试不通过 | 中 | 提供 `mix assets.build_frontend` 本地验证 |
| hook 的 401 处理与 fetch-interceptor 冲突 | 重复跳转登录 | 中 | hook 中跳过 refresh_session，依赖 fetch-interceptor 重试 |

---

## 附录 A: 文件改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/kg_edu/config/config.exs` | 修改 | 添加 ash_typescript hook 配置 |
| `kg-edu-vite-antd/src/lib/rpcHooks.ts` | **新建** | Hook 实现 |
| `kg-edu-vite-antd/src/lib/ash_rpc.ts` | 重新生成 | 混入 hook wiring |
| `kg-edu-vite-antd/src/lib/api-headers.ts` | **新建** | 统一非 RPC API 的 headers |
| `kg-edu-vite-antd/src/lib/auth.ts` | 可选删除 | 被 rpcHooks 替代 |
| `kg-edu-vite-antd/src/auth/auth-context.tsx` | 修改 | 移除 getAuthHeaders 调用 |
| `backend/kg_edu/lib/kg_edu_web.ex` | 修改 | 更新 static_paths |
| `backend/kg_edu/config/prod.exs` | 修改 | 更新 static_paths, endpoint 配置 |
| `backend/kg_edu/lib/kg_edu_web/controllers/page_controller.ex` | 修改 | SPA fallback 优化 |
| `backend/kg_edu/lib/mix/tasks/build_frontend.ex` | **新建** | 构建 task |
| `backend/kg_edu/mix.exs` | 修改 | 更新 aliases |
| `backend/kg_edu/Dockerfile` | 修改 | 多阶段构建 + 前端产物 |
| `docker-compose.prod.yml` | 修改 | 简化为 db + backend |
| `nginx/nginx.conf` | 简化 | 去掉前端/agent 分发规则 |
| `dev.sh` | 无需改动 | 开发流程不变 |
| `kg-edu-vite-antd/vite.config.ts` | 无需改动 | 开发代理配置不变 |

---

## 附录 B: ash_typescript Hook 配置参考

### 配置参数完整说明

```elixir
config :ash_typescript,
  # === Hook 函数引用 ===
  # 格式: "ModuleName.functionName"
  # ModuleName 对应 import_into_generated 中的 import_name
  # functionName 对应 rpcHooks.ts 中 export 的函数名

  # Action 请求前
  rpc_action_before_request_hook: "RpcHooks.beforeRequest",
  # Action 请求后
  rpc_action_after_request_hook: "RpcHooks.afterRequest",
  # Validation 请求前
  rpc_validation_before_request_hook: "RpcHooks.beforeValidationRequest",
  # Validation 请求后
  rpc_validation_after_request_hook: "RpcHooks.afterValidationRequest",

  # === 导入配置 ===
  import_into_generated: [
    %{
      import_name: "RpcHooks",           # TypeScript import 名称
      file: "./rpcHooks"                 # 相对于 ash_rpc.ts 的路径
    }
  ]
```

### 生成的 TypeScript 代码片段

```typescript
// ash_rpc.ts (生成的顶部)
import { RpcHooks } from "./rpcHooks";

// 每个 RPC 函数中（以 listCourses 为例）
export async function listCourses<Fields extends ListCoursesFields>(
  config: { ... }
): Promise<ListCoursesResult<Fields>> {
  // === Hook 注入 (自动生成) ===
  let processedConfig = await RpcHooks.beforeRequest("listCourses", config);
  // === 原本逻辑 ===
  const payload = { action: "list_courses", ... };
  const headers = { "Content-Type": "application/json", ...processedConfig.headers, ...config.headers };
  // ...
  // === Hook 注入 (自动生成) ===
  await RpcHooks.afterRequest("listCourses", response, result, processedConfig);
}
```

---

## 附录 C: 开发环境 vs 生产环境对比

| 方面 | 开发环境 | 生产环境 |
|------|----------|----------|
| 前端服务 | Vite dev server (:8081) | Phoenix 静态文件服务 (:4000) |
| HMR | ✅ Vite HMR | N/A |
| API 调用 | Vite proxy → :4000 | 同源 (no CORS needed) |
| 静态资源 | Vite 内存中 | priv/static/ (gzip + digest) |
| LiveView | 通过 :4000 直接访问 | 通过 :4000 直接访问 |
| auth token | sessionStorage | sessionStorage |
| 启动命令 | `./dev.sh start` | `docker-compose up -d` |
| 服务数 | 2 (Vite + Phoenix) | 1 (Phoenix) |
