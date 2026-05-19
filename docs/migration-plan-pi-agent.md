# 迁移计划：从 .NET Agent Framework 迁移到 Pi Agent 工具调用

> 创建日期：2026-05-19
> 状态：规划中

## 1. 背景

### 1.1 当前架构

当前项目包含三个独立服务：

| 服务 | 技术栈 | 位置 |
|------|--------|------|
| 前端 | React + TypeScript + Ant Design | `kg-edu-vite-antd/` |
| 后端 | Elixir + Phoenix + Ash Framework | `backend/kg_edu/` |
| AI Agent | .NET 10 + Microsoft.Agents.AI + OpenAI SDK | `ai-agent/KgAgent/` |

### 1.2 当前 Agent 架构分析

.NET Agent 使用 `Microsoft.Agents.AI` 框架，核心组件：

```
KgAgent/
├── Program.cs                    # 启动入口，DI 注册，AG-UI 协议端点 /agui
├── Tools/
│   └── AgentTools.cs             # 17 个静态工具方法（课程/知识点/练习/试卷/文档/PPT）
├── Services/
│   ├── KgAgentAGUI.cs            # AG-UI 协议 Agent 工厂（创建 ChatClientAgent）
│   ├── ChatService.cs            # 对话管理，Agent 缓存，流式输出
│   ├── ToolService.cs            # 工具业务逻辑实现（732 行核心文件）
│   ├── CourseService.cs          # 课程数据库查询
│   ├── KnowledgeResourceService.cs # 知识资源数据库查询
│   ├── ExerciseService.cs        # 练习题数据库操作
│   ├── ExamService.cs            # 试卷数据库操作
│   ├── FileService.cs            # 文件记录管理
│   ├── OssUploadService.cs       # 阿里云 OSS 文件上传
│   ├── PandocService.cs          # Markdown → DOCX 转换
│   ├── PptxGeneratorService.cs   # PPTX 生成（通过 Node.js/Bun 子进程）
│   ├── FileContentExtractor.cs   # 文件内容提取
│   ├── ImportService.cs          # 数据导入（896 行）
│   ├── InterviewService.cs       # 面试管理
│   ├── CompetencyGraphService.cs # 能力图谱
│   ├── CurriculumDocxService.cs  # 课程大纲 DOCX 生成
│   ├── GradingService.cs         # 作文评分
│   └── ...                       # RequestContext, ThreadStore, MailService 等
├── Controllers/
│   ├── AgentController.cs        # SSE 聊天 + 文件上传 + 邮件 + 评分 + 报告生成
│   ├── PiSkillsController.cs     # Pi 技能端点（PPTX/DOCX 生成）
│   ├── ExamController.cs         # 试卷管理
│   ├── ImportController.cs       # 数据导入
│   ├── InterviewController.cs    # 面试管理
│   └── ...                       # 其他 REST 控制器
└── Data/
    └── KgEduContext.cs           # EF Core 数据上下文
```

**17 个 Agent 工具**（定义在 `AgentTools.cs`）：

| 工具 | 功能 | 类型 |
|------|------|------|
| `GetCourses` | 获取所有课程列表 | 读取 |
| `GetCoursesByMajor` | 按专业获取课程 | 读取 |
| `GetCoursesBySemester` | 按学期获取课程 | 读取 |
| `GetPublishedCourses` | 获取已发布课程 | 读取 |
| `GetKnowledgeResources` | 获取知识资源 | 读取 |
| `GetKnowledgeResourceById` | 获取单个知识资源 | 读取 |
| `GetExercises` | 获取练习题 | 读取 |
| `GetExerciseById` | 获取单个练习题 | 读取 |
| `GetExams` | 获取考试列表 | 读取 |
| `GetExamById` | 获取单个考试 | 读取 |
| `GetExamExercises` | 获取考试练习题 | 读取 |
| `CreateExercise` | 创建练习题 | 写入 |
| `SaveAsDocxAndUpload` | 生成 DOCX 并上传 OSS | 写入+生成 |
| `GenerateExercises` | AI 生成练习题 | 写入+AI |
| `GenerateExam` | AI 生成试卷 | 写入+AI |
| `GeneratePowerPointWithShapeCrawler` | AI 生成 PPTX | 写入+AI |
| `GenerateJupyterNotebookFromCourse` | AI 生成 Jupyter | 写入+AI |

### 1.3 前端集成方式

前端通过两种方式调用 Agent：

1. **AG-UI 协议**（`/agui`）：教师端 assistant-ui 组件、CopilotKit
2. **SSE 流式接口**（`/agent/chat`）：独立的 Agent 聊天页面
3. **REST API**（`/agent/*`）：各种功能端点（练习题生成、评分、导入等）

### 1.4 关键技术约束

- **多租户**：所有操作需要 `orgSchema`（租户数据库 schema），通过 HTTP Header `X-Org-Schema` 传递
- **LLM 提供商**：通义千问（`qwen-plus`），通过 OpenAI 兼容 API 调用
- **数据库**：PostgreSQL，通过 EF Core + 多 schema 实现租户隔离
- **文件存储**：阿里云 OSS
- **实时通知**：SignalR（文件生成完成通知）

---

## 2. 迁移目标

用 **Pi Agent 的自定义工具** 替换 .NET Agent 的工具调用和 LLM 编排层。

### 2.1 迁移后架构

```
前端 (React)
   │
   ├── /agui → Pi Agent Extension (Node.js/TypeScript)
   │                ├── 自定义工具（替换 AgentTools.cs）
   │                ├── 通过 HTTP 调用后端 Phoenix API
   │                └── LLM 由 Pi Agent 管理
   │
   ├── /agent/* → 保留 REST API 端点（逐步迁移到 Pi 工具）
   │
   └── 后端 (Elixir/Phoenix) ← 保持不变
```

### 2.2 迁移收益

| 维度 | 改进 |
|------|------|
| **代码量** | 消除 ~7600 行 C# Agent 代码 |
| **维护成本** | 不再需要维护 .NET 运行时和依赖 |
| **工具开发** | TypeScript 扩展开发效率高 |
| **LLM 灵活性** | Pi Agent 支持多模型切换，不绑定 qwen-plus |
| **调试** | Pi 的 TUI 界面和日志系统 |
| **功能扩展** | Pi Agent 的 skill/extension 生态 |

### 2.3 保留不变

- **后端** (Elixir/Phoenix/Ash)：所有业务逻辑和数据库操作保持不变
- **前端** (React)：UI 层保持不变，仅调整 API 调用路径
- **REST API 端点**：如 `/agent/generate_ai_exercise`、`/agent/exam/preview` 等保留为后端直接调用

---

## 3. 可行性分析

### 3.1 ✅ 可以替换的部分

| 组件 | 替换方案 |
|------|---------|
| `AgentTools.cs` (17 个工具) | Pi `pi.registerTool()` 注册同名工具 |
| `ChatService.cs` (LLM 编排) | Pi Agent 自带 LLM 调用能力 |
| `KgAgentAGUI.cs` (Agent 工厂) | Pi Extension 中配置 Agent |
| `ToolService.cs` (工具实现) | Pi 工具内通过 HTTP 调用 Phoenix API |
| `ThreadStore.cs` (会话管理) | Pi Agent 自带 Session 管理 |
| `RequestContext.cs` (租户上下文) | Pi Extension 的 `before_agent_start` 事件注入 |
| LLM 工具调用循环 | Pi Agent 原生支持 |

### 3.2 ⚠️ 需要适配的部分

| 组件 | 适配方案 |
|------|---------|
| 多租户 (orgSchema) | Pi 工具参数或 `before_agent_start` 注入 |
| OSS 文件上传 | 保留为 HTTP API，Pi 工具内 fetch 调用 |
| SignalR 实时通知 | Pi 工具内通过 WebSocket/SSE 推送 |
| PPTX/DOCX 生成 | 保留为后端 API，或迁移到 Node.js 脚本 |
| EF Core 数据访问 | 所有数据访问改走 Phoenix REST API |

### 3.3 ❌ 不替换的部分

| 组件 | 原因 |
|------|------|
| Phoenix 后端 | 已有完善的 Ash API，无需改动 |
| REST API 端点（非 Agent） | `ExamController`、`ImportController` 等直接被前端调用，不经过 Agent |
| 面试 WebSocket | 独立功能，不涉及 LLM |

---

## 4. 迁移步骤

### Phase 0: 准备工作 ✅

- [x] Git commit 当前所有项目代码
- [ ] 确认 Phoenix 后端 API 端点文档
- [ ] 列出所有前端对 Agent 的调用点

### Phase 1: 创建 Pi Agent Extension 骨架

**目标**：搭建 Pi Extension 基础框架，实现最简单的工具调用。

**文件结构**：
```
~/.pi/agent/extensions/kg-edu-agent/
├── index.ts              # Extension 入口，注册事件和工具
├── tools/
│   ├── course-tools.ts   # 课程相关工具
│   ├── knowledge-tools.ts # 知识资源工具
│   ├── exercise-tools.ts  # 练习题工具
│   ├── exam-tools.ts      # 试卷工具
│   ├── document-tools.ts  # 文档生成工具
│   └── pptx-tools.ts      # PPT 生成工具
├── lib/
│   ├── api-client.ts     # Phoenix API HTTP 客户端
│   ├── tenant-context.ts # 多租户上下文管理
│   └── config.ts         # 配置管理
└── package.json
```

**具体任务**：

1. 创建 `index.ts`，注册 `session_start` 事件读取 orgSchema
2. 创建 `api-client.ts`，封装对 `http://localhost:4000` 的 API 调用
3. 注册第一个工具 `GetCourses`，验证端到端可用
4. 在 Pi 中测试：启动 pi，调用 `GetCourses` 工具

**验证标准**：
- Pi Agent 能调用 `GetCourses` 工具并返回课程数据
- 多租户 orgSchema 正确传递

### Phase 2: 迁移读取类工具

**目标**：迁移所有只读数据查询工具。

| 工具 | 后端 API 映射 |
|------|-------------|
| `GetCourses` | `GET /api/courses` |
| `GetCoursesByMajor` | `GET /api/courses?filter[major]=xxx` |
| `GetCoursesBySemester` | `GET /api/courses?filter[semester]=xxx` |
| `GetPublishedCourses` | `GET /api/courses?filter[publish_status]=published` |
| `GetKnowledgeResources` | `GET /api/knowledge_resources` |
| `GetKnowledgeResourceById` | `GET /api/knowledge_resources/:id` |
| `GetExercises` | `GET /api/exercises` |
| `GetExerciseById` | `GET /api/exercises/:id` |
| `GetExams` | `GET /api/exams` |
| `GetExamById` | `GET /api/exams/:id` |
| `GetExamExercises` | `GET /api/exams/:id/exercises` |

**具体任务**：

1. 创建 `course-tools.ts`，注册 4 个课程查询工具
2. 创建 `knowledge-tools.ts`，注册 2 个知识资源工具
3. 创建 `exercise-tools.ts`，注册 2 个练习题工具
4. 创建 `exam-tools.ts`，注册 3 个考试工具
5. 每个工具实现 `promptSnippet` 和 `promptGuidelines`
6. 编写系统提示词（替换 `KgAgentAGUI.cs` 中的 `BaseInstructions`）

**验证标准**：
- 所有 11 个读取工具在 Pi 中可用
- 工具返回数据与原 .NET Agent 一致

### Phase 3: 迁移写入和生成类工具

**目标**：迁移需要写入数据库或调用 LLM 的工具。

| 工具 | 实现方式 |
|------|---------|
| `CreateExercise` | HTTP POST → Phoenix API |
| `SaveAsDocxAndUpload` | HTTP POST → Phoenix API (Pandoc + OSS) |
| `GenerateExercises` | HTTP POST → `/agent/generate_ai_exercise` 或 Pi LLM |
| `GenerateExam` | HTTP POST → `/agent/exam/generate` |
| `GeneratePowerPointWithShapeCrawler` | HTTP POST → `/agent/skills/generate-pptx` |
| `GenerateJupyterNotebookFromCourse` | HTTP POST → 后端 API |

**具体任务**：

1. 创建 `document-tools.ts`，注册 `SaveAsDocxAndUpload` 和 `GenerateJupyterNotebook`
2. 创建 `pptx-tools.ts`，注册 `GeneratePowerPointWithShapeCrawler`
3. 更新 `exercise-tools.ts`，添加 `CreateExercise` 和 `GenerateExercises`
4. 更新 `exam-tools.ts`，添加 `GenerateExam`
5. 配置 `promptGuidelines`（如 PPT 生成规则）

**关键决策**：
- 生成类操作仍调用 .NET 后端的 REST API（Phase 3 保留 .NET 服务运行）
- 后续 Phase 6 考虑将生成逻辑也迁移到 Node.js

**验证标准**：
- 所有 6 个写入/生成工具在 Pi 中可用
- DOCX/PPTX 文件能正确生成并上传 OSS

### Phase 4: 前端集成 — 替换 AG-UI 端点

**目标**：前端 Agent 聊天功能从 .NET `/agui` 切换到 Pi Agent。

**方案 A（推荐）：Pi Agent 作为后端 Agent 服务**
- Pi Agent 运行在后台，通过 Extension 暴露 HTTP API
- 前端 `chat.tsx` 调用 Pi 的 HTTP 端点
- 需要开发一个 Pi Extension 来暴露 HTTP API

**方案 B：保留现有 AG-UI 协议**
- 在 Pi Extension 中实现 AG-UI 兼容的 SSE 端点
- 前端无需改动

**具体任务**：

1. 在 Pi Extension 中注册一个 HTTP 端点（或使用 `pi.exec` 启动一个轻量 HTTP 服务）
2. 实现流式响应（SSE），兼容前端 `chat.tsx` 的解析逻辑
3. 保留 `X-Org-Schema`、`X-Thread-Id` 等 Header 传递
4. 更新前端 `copilotkit.ts` 和 `agui-assistant.ts` 的 URL 配置
5. 测试前端 Agent 聊天功能

**验证标准**：
- 前端 Agent 聊天页面能正常对话
- 工具调用在对话中正确触发
- 文件上传和附件功能正常

### Phase 5: 迁移非 Agent 的 REST API

**目标**：将前端直接调用的 Agent REST API 迁移到 Phoenix 后端或 Pi Extension。

| 端点 | 迁移方案 |
|------|---------|
| `POST /agent/generate_ai_exercise` | → Phoenix API（已有 `ExerciseService` 基础） |
| `POST /agent/update_answer_explanation` | → Phoenix API |
| `POST /agent/grade` | → Phoenix API |
| `POST /agent/generate-report` | → Phoenix API |
| `POST /agent/knowledge/generate` | → 已有 Phoenix API |
| `POST /agent/competency-graph/generate` | → 已有 Phoenix API |
| `POST /agent/curriculum/generate-docx` | → 已有 Phoenix API |
| `POST /agent/exam/preview` | → Phoenix API |
| `POST /agent/skills/generate-pptx` | → Phoenix API 或 Pi 工具 |
| `POST /agent/skills/generate-docx` | → Phoenix API 或 Pi 工具 |

**具体任务**：

1. 审计前端所有 `/agent/*` 调用
2. 将 AI 生成类逻辑迁移到 Phoenix（使用 Elixir 的 HTTP 客户端调用 qwen API）
3. 更新前端 API 路径
4. 确保后端 CORS 和认证正确配置

**验证标准**：
- 所有前端功能在 .NET Agent 停止后仍正常工作

### Phase 6: 清理和优化

**目标**：移除 .NET Agent，优化架构。

**具体任务**：

1. 停止 .NET Agent 服务
2. 从 `dev.sh` 中移除 `agent` 服务管理
3. 清理 `nginx` 配置中 .NET Agent 相关的代理规则
4. 考虑将 PPTX/DOCX 生成逻辑从 .NET 迁移到 Node.js（利用已有的 Bun 脚本）
5. 更新 `AGENTS.md` 文档
6. 更新 `docker-compose.yml` 或部署配置

**验证标准**：
- `./dev.sh status` 只显示 frontend 和 backend
- 所有 AI 功能通过 Pi Agent 正常工作

---

## 5. 风险和缓解

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| AG-UI 协议兼容性 | 前端 assistant-ui 组件可能无法连接 Pi | Phase 4 保留 SSE 兼容层 |
| LLM 响应质量差异 | Pi 使用的模型可能与 qwen-plus 响应不同 | 配置 Pi 使用相同的 qwen-plus 模型 |
| PPTX/DOCX 生成 | 当前依赖 .NET 的 Pandoc 和 ShapeCrawler | 保留 .NET REST API 作为过渡，后续迁移到 Node.js |
| SignalR 通知 | 文件生成通知依赖 .NET SignalR | 改用 WebSocket 或 SSE 直接从 Pi 推送 |
| 多租户隔离 | orgSchema 在 Pi 工具间的传递 | 通过 `before_agent_start` 事件注入 |

## 6. 时间估算

| Phase | 预计工时 | 依赖 |
|-------|---------|------|
| Phase 0: 准备 | 1 天 | - |
| Phase 1: 骨架 | 1-2 天 | Phase 0 |
| Phase 2: 读取工具 | 2-3 天 | Phase 1 |
| Phase 3: 写入/生成工具 | 2-3 天 | Phase 2 |
| Phase 4: 前端集成 | 2-3 天 | Phase 3 |
| Phase 5: REST API 迁移 | 3-5 天 | Phase 4 |
| Phase 6: 清理优化 | 1-2 天 | Phase 5 |
| **总计** | **12-19 天** | |

## 7. 下一步行动

1. **确认 Phoenix API 端点**：列出所有可用的 Ash JSON API 端点
2. **配置 Pi 使用 qwen-plus 模型**：通过 `pi.registerProvider()` 或 settings
3. **创建 Extension 骨架**：开始 Phase 1

---

## 附录 A：工具参数对照表

### GetCourses
```typescript
// .NET: AgentTools.GetCourses()
// Pi:
pi.registerTool({
  name: "GetCourses",
  label: "获取课程列表",
  description: "获取所有课程列表。当用户询问任何关于课程的内容时，必须首先调用此工具。",
  promptSnippet: "获取所有可用课程列表",
  promptGuidelines: ["用户询问课程时必须先调用此工具获取课程ID"],
  parameters: Type.Object({}),
  async execute(_id, _params, _signal, _onUpdate, ctx) {
    const orgSchema = ctx.sessionManager.getCustomData("orgSchema");
    const response = await fetch(`http://localhost:4000/api/courses?tenant=${orgSchema}`);
    const data = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(data.data) }] };
  }
});
```

### SaveAsDocxAndUpload
```typescript
// .NET: AgentTools.SaveAsDocxAndUpload(content, fileName, userId, courseId, orgSchema)
// Pi:
pi.registerTool({
  name: "SaveAsDocxAndUpload",
  label: "生成DOCX文档",
  description: "创建DOCX文档（如教案）并上传到云存储。必需参数：content、courseId。",
  parameters: Type.Object({
    content: Type.String({ description: "Markdown 格式的文档内容" }),
    courseId: Type.String({ description: "课程ID（必需，先调用GetCourses获取）" }),
    fileName: Type.Optional(Type.String({ description: "文件名" })),
  }),
  async execute(_id, params, _signal, _onUpdate, ctx) {
    const orgSchema = ctx.sessionManager.getCustomData("orgSchema");
    const response = await fetch("http://localhost:5000/agent/skills/generate-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Org-Schema": orgSchema },
      body: JSON.stringify(params),
    });
    const data = await response.json();
    return { content: [{ type: "text", text: JSON.stringify(data) }] };
  }
});
```

## 附录 B：Pi Agent 配置参考

```typescript
// ~/.pi/agent/extensions/kg-edu-agent/index.ts
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

export default function (pi: ExtensionAPI) {
  // 注入系统提示词
  pi.on("before_agent_start", async (event, ctx) => {
    const orgSchema = /* 从 session 恢复 */;
    return {
      message: {
        customType: "kg-edu-context",
        content: `你是KgEdu平台的教育AI助手。\n当前租户: ${orgSchema}\n...`,
        display: false,
      },
    };
  });

  // 恢复租户上下文
  pi.on("session_start", async (_event, ctx) => {
    // 从 session entries 恢复 orgSchema
  });

  // 注册所有工具
  registerCourseTools(pi);
  registerKnowledgeTools(pi);
  registerExerciseTools(pi);
  registerExamTools(pi);
  registerDocumentTools(pi);
  registerPptxTools(pi);
}
```
