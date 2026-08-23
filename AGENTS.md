# Agent 开发指南

本文档为 AI Agent 提供项目结构和开发工具的使用说明。

## 项目结构

本项目包含两个服务（原三个服务已整合）：

### 1. 前端 (Frontend)
- **路径**: `kg-edu-vite-antd/`
- **技术栈**: React + TypeScript + Vite + Ant Design
- **端口**: 
  - Vite Dev Server: `http://localhost:8081` (开发环境)
  - 生产环境: Phoenix 直接服务 dist 静态文件

### 2. 后端 (Backend)
- **路径**: `backend/kg_edu/`
- **技术栈**: Elixir + Phoenix + Ash Framework
- **端口**: `http://localhost:4000`
- **包含功能**:
  - Ash CRUD API (REST + RPC)
  - JWT 认证 + 多租户
  - AI Chat Agent (替代原 agent-server :5050)
  - 文件上传 OSS (替代原 Express :3000)
  - PPTX/DOCX 生成
  - AI 练习题/能力图谱/课程体系生成
  - React SPA 静态文件服务 (生产环境)

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

## PID 文件

服务进程 ID 存储在 `.dev-pids/` 目录下：
- `.dev-pids/frontend.pid`
- `.dev-pids/backend.pid`

## 开发注意事项

1. **不要重复启动服务** - 使用 `./dev.sh status` 先检查服务状态
2. **使用 codegen 生成 API** - 后端资源变更后使用 `./dev.sh codegen <task>` 生成迁移
3. **数据库迁移** - 资源变更后执行 `./dev.sh migrate` 更新数据库
4. **查看日志排错** - 服务异常时使用 `./dev.sh logs <service>` 查看日志
5. **依赖补丁** - `backend/kg_edu/patches/` 下有对第三方依赖源码的修复（如 jido_ai 流式工具参数丢失重试），`deps/` 被 gitignore，`mix deps.get` 后会自动应用，也可手动 `mix patch_deps` 或 `./backend/kg_edu/patches/apply.sh`；修改依赖源码后应重新生成补丁入库

## 网络架构与端口映射

### 开发环境

开发环境通过 Vite proxy 做路径分发，所有前端请求经过 `:8081`：

```
Browser → :8081 (Vite) → proxy 分发
  ├─ /rpc                  → :4000 (Phoenix Backend)
  ├─ /api                  → :4000 (Phoenix Backend)
  ├─ /api/upload           → :4000
  ├─ /api/sts-token        → :4000
  ├─ /api/assistant        → :4000
  ├─ /agent  [rewrite]     → :4000 (去掉 /agent 前缀)
  ├─ /competency-graph     → :4000
  └─ /curriculum           → :4000
```

### 生产环境

生产环境所有服务统一在 Phoenix 后端一个容器中：

```
Browser → :80 (Nginx, 可选) → :4000 (Phoenix Backend)
  ├─ /                     → index.html (React SPA)
  ├─ /assets/*             → 静态 JS/CSS (Vite 构建 + digest)
  ├─ /rpc/*                → Ash RPC API
  ├─ /api/*                → REST API (chat, upload, generation 等)
  ├─ /live/*               → Phoenix LiveView (管理后台)
  └─ /*path                → SPA fallback (React Router)
```

**Docker 部署**: 仅需 2 个容器 (db + backend)，nginx 可选

### 服务端口对照表

| 服务 | 开发端口 | 生产容器 | 生产端口 |
|------|----------|----------|----------|
| Vite Dev Server | 8081 | - | - |
| Phoenix Backend | 4000 | backend | 4000 |
| PostgreSQL | 5433 (dev) / 5432 | db | 5432 |
| Nginx | - | nginx (可选) | 80 |

**已停用端口**: `:3000` (Express), `:5050` (Pi SDK Agent) — 功能已迁移到 Phoenix

### 验证端点连通性

```bash
# 开发环境 — 通过 Vite proxy 验证
curl http://localhost:8081/api/health
# 预期: {"status":"ok"}

# Phoenix 直接访问
curl http://localhost:4000/
# 预期: 返回 index.html (开发环境可能提示未构建前端)

# 生产环境 — Phoenix 服务所有请求
curl http://localhost:4000/health
# 预期: {"status":"ok"}

# 生产环境 — 检查 AI 练习 API
curl -X POST http://localhost:4000/api/generate_ai_exercise \
  -H 'Content-Type: application/json' -d '{}'
# 预期: {"success":false,"error":"未设置租户上下文"}
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
==========================================
```
