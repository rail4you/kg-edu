# Pi Agent SDK 集成指南

> 用于 KgEdu 项目，替代 .NET Agent 的 HTTP 服务层

## 核心概念

Pi SDK (`@mariozechner/pi-coding-agent`) 允许在 Node.js 进程中直接创建 Agent Session，
注册自定义工具，订阅流式事件，完全替代 .NET Agent 的 LLM 编排和工具调用。

## 快速开始

```typescript
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

// 1. 创建自定义工具
const getCoursesTool = defineTool({
  name: "GetCourses",
  label: "获取课程列表",
  description: "获取所有课程列表",
  parameters: Type.Object({}),
  execute: async () => {
    const courses = await fetch("http://localhost:4000/rpc/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get_all_courses",
        fields: ["id", "title", "major", "semester"],
        tenant: "org_xxx",
      }),
    }).then(r => r.json());
    return { content: [{ type: "text", text: JSON.stringify(courses.data) }], details: {} };
  },
});

// 2. 创建 Agent Session
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

const loader = new DefaultResourceLoader({
  systemPromptOverride: () => "你是 KgEdu 教育平台的 AI 助手。",
});
await loader.reload();

const { session } = await createAgentSession({
  model: modelRegistry.find("openai", "qwen-plus"),  // 或其他模型
  authStorage,
  modelRegistry,
  sessionManager: SessionManager.inMemory(),
  resourceLoader: loader,
  noTools: "builtin",        // 禁用内置工具 (read/bash/edit 等)
  customTools: [getCoursesTool],  // 只用自定义工具
});

// 3. 订阅流式事件
session.subscribe((event) => {
  switch (event.type) {
    case "message_update":
      if (event.assistantMessageEvent.type === "text_delta") {
        process.stdout.write(event.assistantMessageEvent.delta);
      }
      break;
    case "agent_end":
      console.log("\n完成");
      break;
  }
});

// 4. 发送消息
await session.prompt("列出所有课程");
```

## HTTP 服务器模式（替代 .NET Agent）

```typescript
import express from "express";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";

const app = express();
app.use(express.json());

// 为每个请求创建 agent session（或用 session 缓存）
app.post("/api/chat", async (req, res) => {
  const { message, orgSchema, threadId } = req.body;

  // 创建 session
  const { session } = await createAgentSession({
    sessionManager: SessionManager.inMemory(),
    authStorage: AuthStorage.create(),
    modelRegistry: ModelRegistry.create(AuthStorage.create()),
    noTools: "builtin",
    customTools: [/* 所有 KgEdu 工具 */],
    resourceLoader: new DefaultResourceLoader({
      systemPromptOverride: () => `你是 KgEdu 平台的教育 AI 助手。\n当前租户: ${orgSchema}`,
    }),
  });

  // SSE 流式响应
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  session.subscribe((event) => {
    if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
      res.write(`event: message\ndata: ${JSON.stringify({ text: event.assistantMessageEvent.delta })}\n\n`);
    }
    if (event.type === "agent_end") {
      res.write("event: done\ndata: [DONE]\n\n");
      res.end();
    }
  });

  await session.prompt(message);
});
```

## 关键 API

### createAgentSession(options)

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | `Model` | LLM 模型 |
| `authStorage` | `AuthStorage` | API Key 管理 |
| `modelRegistry` | `ModelRegistry` | 模型注册表 |
| `sessionManager` | `SessionManager` | 会话持久化 |
| `tools` | `string[]` | 启用的内置工具名 |
| `noTools` | `"all" \| "builtin"` | 禁用工具 |
| `customTools` | `ToolDefinition[]` | 自定义工具数组 |
| `resourceLoader` | `ResourceLoader` | 扩展/技能/提示词加载 |
| `settingsManager` | `SettingsManager` | 设置管理 |
| `thinkingLevel` | `ThinkingLevel` | 思考深度 |

### AgentSession 方法

| 方法 | 说明 |
|------|------|
| `prompt(text, options?)` | 发送消息并等待完成 |
| `subscribe(listener)` | 订阅流式事件 |
| `steer(text)` | 流式中插入指令 |
| `followUp(text)` | 流式结束后追加消息 |
| `abort()` | 中止当前操作 |
| `dispose()` | 清理资源 |

### AgentSessionEvent 类型

| event.type | 说明 |
|------------|------|
| `message_update` | 流式文本 (text_delta / thinking_delta) |
| `message_start` / `message_end` | 消息生命周期 |
| `tool_execution_start` / `tool_execution_end` | 工具执行 |
| `agent_start` / `agent_end` | Agent 生命周期 |
| `turn_start` / `turn_end` | 单轮对话 (LLM 响应 + 工具调用) |

### defineTool(options)

```typescript
const myTool = defineTool({
  name: "tool_name",
  label: "Tool Label",
  description: "工具描述（LLM 可见）",
  parameters: Type.Object({
    param1: Type.String({ description: "参数说明" }),
  }),
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    // onUpdate 流式更新
    onUpdate?.({ content: [{ type: "text", text: "处理中..." }] });

    return {
      content: [{ type: "text", text: "结果" }],
      details: {},  // 元数据
    };
  },
});
```

### SessionManager 工厂方法

| 方法 | 说明 |
|------|------|
| `SessionManager.inMemory(cwd?)` | 内存中，不持久化 |
| `SessionManager.create(cwd)` | 新建持久化 session |
| `SessionManager.continueRecent(cwd)` | 恢复最近 session |
| `SessionManager.open(path)` | 打开指定 session 文件 |
| `SessionManager.list(cwd)` | 列出项目 sessions |
| `SessionManager.listAll(cwd)` | 列出所有 sessions |

### ModelRegistry

```typescript
const authStorage = AuthStorage.create();
const modelRegistry = ModelRegistry.create(authStorage);

// 注册自定义提供商（如通义千问）
// 通过 ~/.pi/agent/models.json 配置，或：
authStorage.setRuntimeApiKey("openai", process.env.QWEN_API_KEY!);

// 查找模型
const model = modelRegistry.find("openai", "qwen-plus");
```

## 依赖安装

```bash
npm install @mariozechner/pi-coding-agent typebox
# 或
bun add @mariozechner/pi-coding-agent typebox
```
