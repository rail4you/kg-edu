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
- **路径**: `ai-agent/KgAgent/`
- **技术栈**: .NET (C#)
- **端口**: `http://localhost:5000` 或 `http://localhost:5001`
- **启动命令**: `dotnet run --project KgAgent.csproj`

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
