# Agent 开发指南

本文档为 AI Agent 提供项目结构和开发工具的使用说明。

## 项目结构

本项目包含三个独立的服务：

### 1. 前端 (Frontend)
- **路径**: `kg-edu-vite-antd/`
- **技术栈**: React + TypeScript + Vite + Ant Design
- **端口**: 
  - Vite Dev Server: `http://localhost:8081`
  - API Server: `http://localhost:3000`
- **启动命令**: `bun run dev:all`

### 2. 后端 (Backend)
- **路径**: `backend/kg_edu/`
- **技术栈**: Elixir + Phoenix + Ash Framework
- **端口**: `http://localhost:4000`
- **启动命令**: `mix phx.server`
- **数据库迁移**: `mix ash.migrate && mix ash.migrate --tenants`
- **API 生成**: `mix ash.codegen <task>`

### 3. AI Agent
- **路径**: `agent-server/`
- **技术栈**: Node.js + Pi SDK (TypeScript) + Express
- **端口**: `http://localhost:5050`
- **启动命令**: `bun run src/server.ts`
- **依赖**: Phoenix 后端 (RPC), .NET Agent (PPTX/DOCX 生成过渡期)

## 服务管理 (dev.sh)

**重要**: Agent 必须通过 `dev.sh` 脚本与服务交互，**不要自己启动服务**。

### 基本用法

```bash
./dev.sh <command> [service] [options]
```

### 命令列表

| 命令 | 说明 | 示例 |
|------|------|------|
| `start [service]` | 启动服务 | `./dev.sh start frontend` |
| `stop [service]` | 停止服务 | `./dev.sh stop all` |
| `restart [service]` | 重启服务 | `./dev.sh restart backend` |
| `status` | 查看所有服务状态 | `./dev.sh status` |
| `logs <service>` | 查看服务日志 | `./dev.sh logs backend` |
| `codegen <task>` | 生成 Ash API 代码 | `./dev.sh codegen user` |
| `migrate` | 执行数据库迁移 | `./dev.sh migrate` |

### 服务名称

- `frontend` - 前端服务
- `backend` - 后端服务
- `agent` - AI Agent 服务
- `all` - 所有服务

### 常用操作示例

```bash
# 启动所有服务
./dev.sh start

# 只启动前端服务
./dev.sh start frontend

# 停止所有服务
./dev.sh stop all

# 查看服务状态
./dev.sh status

# 查看后端日志 (实时)
./dev.sh logs backend

# 生成 Ash API 代码
./dev.sh codegen add_user_feature

# 执行数据库迁移
./dev.sh migrate
```

## 日志文件

服务日志存储在 `.dev-logs/` 目录下：
- `.dev-logs/frontend.log` - 前端服务日志
- `.dev-logs/backend.log` - 后端服务日志
- `.dev-logs/agent.log` - AI Agent 服务日志

## PID 文件

服务进程 ID 存储在 `.dev-pids/` 目录下：
- `.dev-pids/frontend.pid`
- `.dev-pids/backend.pid`
- `.dev-pids/agent.pid`

## 开发注意事项

1. **不要重复启动服务** - 使用 `./dev.sh status` 先检查服务状态
2. **使用 codegen 生成 API** - 后端资源变更后使用 `./dev.sh codegen <task>` 生成迁移
3. **数据库迁移** - 资源变更后执行 `./dev.sh migrate` 更新数据库
4. **查看日志排错** - 服务异常时使用 `./dev.sh logs <service>` 查看日志

## 网络架构与端口映射

### 开发环境

开发环境通过 Vite proxy 做路径分发，所有前端请求经过 `:8081`：

```
Browser → :8081 (Vite) → proxy 分发
  ├─ /rpc                  → :4000 (Phoenix Backend)
  ├─ /api                  → :4000 (Phoenix Backend)
  ├─ /api/upload           → :3000 (Express API Server)
  ├─ /api/sts-token        → :3000
  ├─ /api/ag-ui            → :3000
  ├─ /api/assistant        → :3000 → Pi Agent (port 5050)
  ├─ /api/copilotkit       → :3000 (已废弃)
  ├─ /agent  [rewrite]     → :5050 (Pi Agent, 去掉 /agent 前缀)
  ├─ /competency-graph     → :5050
  └─ /curriculum           → :5050
```

**关键**: `/agent` 路径通过 `rewrite` 去掉前缀再转发：
- 前端请求: `/agent/api/chat`
- Vite 重写为: `/api/chat`
- 转发到 Pi Agent: `http://localhost:5050/api/chat`

### 生产环境

生产环境通过 Nginx 反向代理分发到 Docker 容器：

```
Browser → :80 (Nginx) → Docker 内部路由
  ├─ /agent/  [rewrite]    → ai-agent:5050 (Pi Agent, 路径去 /agent/ 前缀)
  ├─ /api/                 → frontend:3000 (Express API Server)
  ├─ /rpc/                 → backend:4000 (Phoenix)
  └─ /                     → frontend:3000 (Vite SPA)
```

**Nginx 关键配置** (`/root/kg_edu/nginx.conf`):

```nginx
# 上游定义
upstream ai-agent {
    server ai-agent:5050;   # Pi Agent 容器端口
}

# Agent 路由 — 去掉 /agent/ 前缀
location /agent/ {
    proxy_pass http://ai-agent/;   # ← 此处末尾的 / 表示去掉 /agent/
    proxy_http_version 1.1;
    proxy_buffering off;           # SSE 流式支持
    proxy_read_timeout 300s;
}
```

**关键**: `proxy_pass http://ai-agent/;` 末尾 `/` 会让 Nginx 把 `/agent/api/chat` 重写为 `/api/chat` 再转发。

### 服务端口对照表

| 服务 | 开发端口 | 生产容器 | 生产端口 |
|------|----------|----------|----------|
| Vite Dev Server | 8081 | frontend | 3000 (Vite preview) |
| Express API Server | 3000 | frontend | 3000 |
| Phoenix Backend | 4000 | backend | 4000 |
| Pi Agent Server | 5050 | ai-agent | 5050 |
| PostgreSQL | 5432 | db | 5432 |
| Nginx | - | nginx | 80 |

### 验证端点连通性

```bash
# 开发环境 — 检查 Pi Agent 是否可达
curl http://localhost:5050/health

# 开发环境 — 通过 Vite proxy 验证
curl http://localhost:8081/agent/health

# 生产环境 — 服务器上检查
curl http://localhost/agent/health
# 预期: {"status":"ok","service":"kg-edu-agent-server"}

# 生产环境 — 检查 AI 练习 API
curl -X POST http://localhost/agent/api/generate_ai_exercise \
  -H 'Content-Type: application/json' -d '{}'
# 预期: {"success":false,"error":"未设置租户上下文"}  (非 502)
```

## 快速启动开发环境

```bash
# 首次启动所有服务
./dev.sh start

# 检查服务状态
./dev.sh status
```

预期输出：
```
==========================================
           服务状态
==========================================
前端 (Frontend): 运行中 (PID: xxxxx)
后端 (Backend): 运行中 (PID: xxxxx)
AI Agent: 运行中 (PID: xxxxx)
==========================================
```
