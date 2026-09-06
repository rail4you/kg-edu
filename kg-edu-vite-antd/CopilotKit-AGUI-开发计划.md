# CopilotKit 对接 AG-UI Agent 开发计划

## 项目概况

| 项目 | 技术栈 | 端点 |
|------|--------|------|
| **后端 Agent** | F# + Microsoft.Agents.AI | `http://localhost:5001/agui` |
| **前端应用** | Vite + React + Ant Design | `http://localhost:8081` |
| **Hono 服务端** | Bun + Hono | `http://localhost:3000` |

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                    前端 (Vite + React)                       │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  CopilotKit Provider                                    ││
│  │  ┌─────────────────┐  ┌──────────────────────────────┐ ││
│  │  │ CopilotSidebar  │  │ useCopilotAction (工具渲染)  │ ││
│  │  │ (聊天UI组件)     │  │                              │ ││
│  │  └────────┬────────┘  └──────────────────────────────┘ ││
│  └───────────┼─────────────────────────────────────────────┘│
│              │  runtimeUrl="/api/copilotkit"                │
│              │  headers: { Authorization: "Bearer token" }  │
│              ▼                                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ HTTP
┌─────────────────────────────────────────────────────────────┐
│                 Hono 服务端 (Bun)                            │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  /api/copilotkit/* → CopilotRuntime                     ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │ CopilotRuntime + ExperimentalEmptyAdapter          │││
│  │  │ agents: { default: HttpAgent }                      │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼ AG-UI Protocol
┌─────────────────────────────────────────────────────────────┐
│                 后端 (F# + Microsoft.Agents.AI)              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  /agui endpoint → KgAgentAGUI                           ││
│  │  工具函数:                                              ││
│  │  • GetCourses / GetCoursesByMajor                      ││
│  │  • GetKnowledgeResources                               ││
│  │  • GenerateExercise / GenerateExam                     ││
│  │  • GeneratePPT / GenerateJupyter                       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## 认证流程

1. 前端从 sessionStorage 获取 JWT token (`jwt_access_token`)
2. 通过 `headers` prop 传递给 CopilotKit
3. Hono 服务端将请求转发到 CopilotRuntime
4. CopilotRuntime 通过 HttpAgent 连接 F# AG-UI 后端
5. 工具函数使用 orgSchema 进行多租户数据隔离

## 关键配置

| 配置项 | 前端值 | 服务端值 | 后端值 |
|--------|--------|----------|--------|
| Agent Name | `"KgEduAgent"` | `"KgEduAgent"` | `"KgEduAgent"` |
| CopilotKit 端点 | `/api/copilotkit` | `/api/copilotkit/*` | - |
| AG-UI 端点 | - | `http://localhost:5001/agui` | `/agui` |

**重要**: Agent Name 必须在三个地方保持一致：
1. 前端 `src/lib/copilotkit.ts` - `AGENT_NAME`
2. 服务端 `server.ts` - `CopilotRuntime.agents` 的 key
3. 后端 `ai-agent/KgAgent/Services/AGUIService.fs` - `CreateAIAgent(name = "KgEduAgent", ...)`

## 已完成的文件变更

### 前端文件

| 操作 | 文件路径 | 说明 | 状态 |
|------|----------|------|------|
| ✅ 新建 | `src/lib/copilotkit.ts` | CopilotKit 配置（认证 token 获取） | 完成 |
| ✅ 新建 | `src/pages/teacher/ai-assistant/index.tsx` | AI 助手页面（CopilotSidebar） | 完成 |
| ✅ 新建 | `src/styles/copilotkit.css` | CopilotKit 自定义样式 | 完成 |
| ✅ 修改 | `src/main.tsx` | 添加 CopilotKit Provider | 完成 |
| ✅ 修改 | `src/App.tsx` | 添加 `/teacher/dashboard/ai-assistant` 路由 | 完成 |

### 服务端文件

| 操作 | 文件路径 | 说明 | 状态 |
|------|----------|------|------|
| ✅ 修改 | `server.ts` | 添加 CopilotRuntime 端点 | 完成 |

### 后端文件（已配置）

| 操作 | 文件路径 | 说明 | 状态 |
|------|----------|------|------|
| ✅ 已有 | `ai-agent/KgAgent/Program.fs` | CORS 已配置为 AllowAll | 完成 |
| ✅ 已有 | `ai-agent/KgAgent/Services/AGUIService.fs` | AG-UI 服务实现 | 完成 |

## 开发进度

### 已完成任务

| 优先级 | 任务 | 状态 |
|--------|------|------|
| P0 | 安装 CopilotKit 依赖 | ✅ 已完成 |
| P0 | 配置 CopilotKit Provider | ✅ 已完成 |
| P0 | 添加 CopilotSidebar 组件 | ✅ 已完成 |
| P0 | 配置 Hono 服务端 CopilotRuntime | ✅ 已完成 |
| P0 | 后端 CORS 配置 | ✅ 已完成 |
| P0 | 修复 /info 端点路由问题 | ✅ 已完成 |
| P2 | 工具可视化渲染组件 | ✅ 基础完成 |
| P3 | 样式美化 | ✅ 基础完成 |

### 待测试

| 优先级 | 任务 | 状态 |
|--------|------|------|
| P1 | 前后端联调测试 | ⏳ 待完成 |

## 运行方式

1. **启动后端 F# Agent**:
   ```bash
   cd ai-agent/KgAgent
   dotnet run
   ```

2. **启动 Hono 服务端**:
   ```bash
   cd kg-edu-vite-antd
   bun run dev:server
   # 或者同时启动前端和服务端
   bun run dev:all
   ```

3. **启动前端开发服务器**:
   ```bash
   cd kg-edu-vite-antd
   npm run dev
   ```

## 访问路径

- **AI 助手页面**: `http://localhost:8081/teacher/dashboard/ai-assistant`
- **原有 Agent Chat**: `http://localhost:8081/teacher/dashboard/chat`
- **CopilotKit API**: `http://localhost:3000/api/copilotkit`
- **AG-UI 后端**: `http://localhost:5001/agui`

## 参考文档

- [CopilotKit + Microsoft Agent Framework](https://www.copilotkit.ai/blog/build-a-frontend-for-your-microsoft-agent-framework-agents-with-ag-ui)
- [CopilotKit Authentication](https://docs.copilotkit.ai/microsoft-agent-framework/auth)
