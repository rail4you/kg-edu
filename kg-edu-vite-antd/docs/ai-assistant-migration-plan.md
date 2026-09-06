# 教师 AI 助手迁移方案

## 2026-05-12 实施记录
- 目标
  - 修复 `/teacher/dashboard/ai-assistant` 当前页面运行错误。
  - 用 `assistant-ui + AG-UI` 替换教师页旧聊天 UI，为后续切到 `pi agent` 保留前端协议层。

- 本次完成的前端迁移
  - 教师页聊天主组件统一切到 `src/components/assistant-ui/AssistantChat.tsx`。
  - 保留现有会话元数据存储方式：
    - `ai_assistant_conversations`
    - `ai_assistant_current_conversation`
  - 继续走稳定代理入口：
    - `/api/assistant/ag-ui`

- 本次修复的实际问题
  - `assistant-ui` 组件实现混用了旧示例 API 和当前安装版本 `@assistant-ui/react@0.14` 的 API。
  - 原实现在渲染期调用 `setState` 判断消息角色，会触发 React 运行时错误风险。
  - `MessagePartPrimitive.Root/If` 等 API 在当前版本并不存在，导致组件无法通过类型检查，也会在页面模块编译时失败。
  - `@ag-ui/client` 在项目根和 `@assistant-ui/react-ag-ui` 内部存在不同版本，直接把根包 `HttpAgent` 传给 `useAgUiRuntime` 会出现类型不兼容。
  - 教师页虽然支持选择 `AI Command` 创建会话，但迁移后的 `assistant-ui` 版本没有把 `systemPrompt/userPrompt/assistantExample` 继续传到 AG-UI 后端，导致助手类型失效。

- 具体处理
  - 重写 `AssistantChat.tsx`，改为当前库支持的 primitives 组合方式：
    - `ThreadPrimitive.Root`
    - `ThreadPrimitive.Viewport`
    - `ThreadPrimitive.Messages`
    - `MessagePrimitive.Parts`
    - `ComposerPrimitive.Root/Input/Send/Cancel`
  - 删除基于渲染副作用的角色判断，改为从 `ThreadPrimitive.Messages` 提供的 `message.role` 直接决定消息布局。
  - 使用 `useComposerRuntime().setRunConfig({ custom: ... })` 同步 `aiCommand`：
    - `aiCommandId`
    - `systemPrompt`
    - `userPrompt`
    - `assistantExample`
  - 利用 `@assistant-ui/react-ag-ui` 内部对 `runConfig.custom -> forwardedProps.runConfig` 的映射，把 prompt 覆盖继续送到 AG-UI 链路。
  - 重新整理 `assistant-ui.css`，补齐消息气泡、工具调用状态、输入区和空状态样式。

- 验证结果
  - Vite 已能成功编译并返回：
    - `src/components/assistant-ui/AssistantChat.tsx`
    - `src/pages/teacher/ai-assistant/index.tsx`
  - 组件级 TypeScript 校验通过：
    - `AssistantChat.tsx`
    - `agui-assistant.ts`
  - `POST /api/assistant/ag-ui` 已用最小请求实际验证，能返回 AG-UI SSE 流：
    - `RUN_STARTED`
    - `TEXT_MESSAGE_START/CONTENT/END`
    - `RUN_FINISHED`

- 环境备注
  - 本地 `8081` 已有现成前端服务在运行。
  - `3000` 端口也已有 Bun 服务在运行，所以 `./dev.sh start frontend` 会退化成：
    - Vite 临时改跑 `8082`
    - API 代理因 `3000` 被占用而失败
  - 这属于当前开发环境端口占用问题，不是本次聊天页代码引起的。

- 对后续切换 `pi agent` 的意义
  - 现在教师页 UI 已经和 CopilotKit 页面解耦。
  - 后续只要把 `/api/assistant/ag-ui` 从当前 .NET AG-UI 转发，替换成 `pi agent gateway` 的 AG-UI 兼容实现，前端页可以不再大改。

## Summary
- 现状确认
  - 教师页 `src/pages/teacher/ai-assistant/index.tsx` 直接使用 `CopilotKit + CopilotChat`。
  - 全局 `src/main.tsx` 还包了一层 `CopilotKit` Provider。
  - `server.ts` 通过 `CopilotRuntime + HttpAgent` 把前端请求转到 `ai-agent/KgAgent` 的 `/agui`。
  - `ai-agent/KgAgent/Program.cs` 使用 `AddAGUI()` 和 `MapAGUI("/agui", agent)`，核心依赖 `Microsoft.Agents.AI*`。
- 迁移策略
  - 采用两阶段替换。
  - 第一阶段只替换教师页 UI 到 `assistant-ui`，浏览器侧协议先继续使用 AG-UI，保证功能不变。
  - 第二阶段把 agent 编排从 Microsoft Agent Framework 迁到 `Pi Coding Agent`，同时保留 .NET 现有业务能力作为 Pi 的工具后端。
- 技术判断
  - `assistant-ui` 官方支持 AG-UI runtime，适合先接现有 `/agui`。
  - `assistant-ui` 的 thread list adapter 仍是 experimental，因此当前会话列表继续沿用现有本地状态，不把线程管理托付给它。
  - `Pi Coding Agent` 是 TypeScript SDK / RPC runtime，不是现成的 HTTP AG-UI agent；因此后端替换必须增加一层 Pi 适配网关，不能直接等价替换 `MapAGUI`。

## Implementation Changes
- 前端 UI 层
  - 在教师页引入本地 `AssistantRuntimeProvider`，不再依赖全局 `CopilotKit` Provider。
  - 使用 `@assistant-ui/react` primitives 组合现有 Ant Design 布局，不引入 shadcn 风格组件。
  - 保留现有三块功能不变：
    - 左侧会话列表
    - 基于 `threadId` 的会话切换与恢复
    - `AI Command` 模板注入（`systemPrompt` / `userPrompt` / `assistantExample`）
  - 本地存储键保持不变：继续使用 `ai_assistant_conversations` 和 `ai_assistant_current_conversation`，避免教师历史会话入口丢失。
  - 仅教师页切换到 assistant-ui；学生页和其他未迁移页面暂时继续走 CopilotKit。

- 前端运行时与网关
  - 新增一个稳定的浏览器侧聊天入口，例如 `/api/assistant/ag-ui/*`。
  - 第一阶段：该入口仅做转发，目标仍是现有 .NET `/agui`。
  - 第二阶段：同一路径切到新的 Pi 网关，对前端保持协议不变，避免 UI 再改一轮。
  - 不再让教师页直接依赖 `/api/copilotkit`；`/api/copilotkit` 只为未迁移页面保留过渡期兼容。

- Pi agent 替换方案
  - 在 Bun/TS 侧新增 Pi agent gateway，放在前端服务端层而不是 .NET 内部。
  - Pi gateway 负责：
    - 用 `@earendil-works/pi-coding-agent` 创建/恢复 `AgentSession`
    - 以现有 `threadId` 作为 session key
    - 注入租户、用户、AI Command prompt 覆盖
    - 把 Pi 事件流转换成 AG-UI 事件，继续喂给 assistant-ui
  - Pi 不启用默认 coding tools（`bash/edit/write/read` 等）；只注册业务自定义工具，避免把编码能力暴露给教师助手场景。
  - Pi 的业务工具全部通过 HTTP 调用现有 .NET/后端服务，不直接访问数据库。

- .NET agent 后端收敛
  - 保留现有 .NET 业务服务和通知链路，尤其是文件生成、PPT、试卷、练习题、`SignalR` 通知。
  - 把当前只存在于 MAF tool 内部、但 Pi 仍需要的能力整理成显式 HTTP 工具接口；已有控制器可直接复用的继续复用，缺失的补为普通 API。
  - 目标是把 .NET 从“Agent Runtime + Tool 实现”收敛为“Business Tool API + Notification API”。
  - 在 Pi 功能对齐后，再删除：
    - `Microsoft.Agents.AI*` 包引用
    - `AddAGUI()` / `MapAGUI()`
    - `KgAgentAGUI.cs`
    - 仅为 AG-UI/MAF 服务的 request-context 注入逻辑

## Public Interfaces / Contracts
- 新增稳定聊天入口
  - `POST /api/assistant/ag-ui/...`
  - 阶段 1 转发到现有 .NET AG-UI agent
  - 阶段 2 由 Pi gateway 直接响应
- 保留并继续使用的上下文契约
  - `Authorization`
  - `X-Org-Schema`
  - `X-User-Id`
  - AI Command prompt 覆盖字段
- .NET 侧需要补齐的工具 API
  - 知识点/资源查询
  - 练习题查询与创建
  - 试卷查询与生成
  - 文档/PPT/Jupyter 生成
  - 文件列表/删除与生成通知
- 不引入 Assistant Cloud
  - 会话列表继续由本地状态管理
  - agent thread/session 继续由自托管服务管理

## Test Plan
- 教师页功能回归
  - 打开 `/teacher/dashboard/ai-assistant` 能正常渲染新 UI。
  - 新建默认会话、切换会话、删除会话、刷新后恢复会话都正常。
  - 选择不同 `AI Command` 创建会话后，prompt 覆盖仍生效。
- 聊天与流式输出
  - 普通问答能持续流式返回。
  - 切换旧会话后，agent 能延续原上下文。
  - 错误态、空会话态、无权限态能正常显示。
- 业务工具回归
  - 课程查询、练习题生成、试卷生成、PPT/文档生成功能结果不变。
  - 文件生成后 `agentfiles` 列表可见，现有 SignalR 通知仍可触发。
- 兼容性
  - 未迁移的学生聊天页继续可用。
  - 过渡期内 `/api/copilotkit` 与新 `/api/assistant/ag-ui` 可并存。
- 最终清理验证
  - 移除 `Microsoft.Agents.AI*` 后，教师页功能无回退。
  - `bun run build`、.NET 构建、教师页核心联调均通过。

## Assumptions
- `pi agent` 以 `Pi Coding Agent / pi.dev` 为准，不是 Pipecat。
- 首批迁移范围以教师页为主，但设计必须允许后续把学生聊天页复用到同一 assistant-ui + Pi runtime。
- 会话持久化维持当前级别即可：前端本地保存会话元数据，服务端保存 thread/session；本次不引入新的云持久化服务。
- 浏览器侧协议默认继续保留 AG-UI，直到 Pi gateway 完成事件映射，这样可以把 UI 替换和 agent 替换解耦。
