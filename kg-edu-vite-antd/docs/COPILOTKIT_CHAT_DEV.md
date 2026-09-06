# CopilotKit 智能体聊天界面开发方案

## 一、调研结果

### 1. API端点

**Agent Chat API (`/agent/chat`)**

- 位置: `ai-agent/KgAgent/Controllers/AgentController.fs:160-320`
- 请求方式: POST (SSE流式响应)
- 请求体 (ChatRequest):

```typescript
interface ChatRequest {
  message: string;                    // 用户消息
  fileUrls?: Array<{                 // 附件文件URL
    url: string;
    type: string;                     // "pdf" | "docx"
  }>;
  threadId?: string;                  // 对话线程ID（用于多轮对话）
  orgSchema?: string;                 // 租户schema
  userId?: string;                    // 用户ID
  systemPrompt?: string;              // 系统提示词
  assistantExample?: string;           // 助手示例
}
```

- 响应: SSE流式返回，包含:
  - `event: message` - AI回复内容
  - `event: thread_id` - 线程ID
  - `event: done` - 结束标记

### 2. AI智能指令 (AI Command)

- 获取列表: `ash_rpc.listCommands()`
- 字段: `id`, `title`, `user`, `system`, `assistant`
- CRUD: createCommand, updateCommand, deleteCommand, getCommand

### 3. 文件API

- 获取文件列表: `ash_rpc.listFiles()`
- 上传文件: `POST /agent/upload/file`
- 已有实现参考: `src/pages/teacher/chat.tsx:677-860`

### 4. 现有实现参考

| 项目 | 路径 | 说明 |
|------|------|------|
| 当前聊天实现 | `src/pages/teacher/chat.tsx` | 自定义UI，已对接/agent/chat |
| minimal-vite-ts参考 | `minimal-vite-ts/src/pages/teacher/dashboard/chat-copilot.tsx` | CopilotKit示例 |

---

## 二、开发计划

### 第一步：安装CopilotKit依赖

```bash
npm install @copilotkit/react-ui @copilotkit/react-core
# 当前已安装 @copilotkit/runtime@^1.51.4
```

### 第二步：配置CopilotKit Provider

创建 `src/components/copilot-provider.tsx`:

```tsx
import { CopilotKit } from "@copilotkit/react-core";

export function CopilotProvider({ children }) {
  return (
    <CopilotKit
      runtimeUrl="/agent/chat"  // 对接F#后端
    >
      {children}
    </CopilotKit>
  );
}
```

**注意**: CopilotKit 1.5的runtimeUrl期望的是CopilotKit runtime endpoint，需要创建中间层转换。

### 第三步：实现自定义Edge Runtime

由于F#后端的SSE格式与CopilotKit期望的格式不同，需要创建中间层:

```
前端 -> CopilotKit Runtime (Edge) -> /agent/chat (F#)
```

或在Provider中使用 `forwardToUrl` + 自定义处理。

### 第四步：构建对话界面

使用CopilotKit UI组件:
- `CopilotChat` - 完整聊天界面
- `CopilotSidebar` - 侧边栏形式
- `useCopilotChat` - 自定义UI

### 第五步：实现文件附件功能

- 实现文件选择对话框（复用chat.tsx中的listFiles逻辑）
- 实现文件上传（调用/agent/upload/file）
- 在消息中显示附件

### 第六步：实现AI Command选择

- 新建对话时显示AI Command下拉选择
- 将选中的command参数传递给/agent/chat

---

## 三、关键技术决策

| 问题 | 方案 |
|------|------|
| SSE格式不匹配 | 创建Edge Function中间层转换 |
| Session管理 | 使用threadId维护多轮对话 |
| 文件上传 | 复用现有/agent/upload/file |
| UI定制 | 使用CopilotKit CSS变量覆盖样式 |

---

## 四、需要开发的文件

1. `src/components/copilot-provider.tsx` - Provider配置
2. `src/pages/teacher/ai-agent-chat.tsx` - 对话主组件
3. 修改路由配置添加新页面

---

## 五、开发进度

- [x] 创建开发文档 (本文档)
- [x] 安装CopilotKit依赖
- [ ] 配置CopilotKit Provider (简化方案：直接使用自定义UI)
- [ ] 创建Edge Runtime中间层 (简化方案：直接调用后端API)
- [x] 实现聊天界面
- [x] 实现文件附件功能
- [x] 实现AI Command选择
- [x] 添加路由和菜单

## 六、已创建文件

1. `src/pages/teacher/ai-agent-chat.tsx` - 智能体聊天主组件
2. `docs/COPILOTKIT_CHAT_DEV.md` - 开发文档

## 七、技术实现说明

由于CopilotKit的runtime URL期望特定的SSE格式，而F#后端使用了不同的SSE格式（`event: message\ndata: ...`），本实现采用了简化的方案：

- 直接使用Ant Design组件构建UI
- 通过fetch直接调用`/agent/chat` API
- 自己处理SSE流解析
- 使用localStorage存储会话历史

这样可以避免复杂的格式转换，同时保持与现有chat.tsx类似的用户体验。

## 八、页面路径

- 菜单路径：`/teacher/ai-workspace/智能体聊天` / `CopilotKit聊天`
- 路由路径：
  - `/teacher/dashboard/ai-agent-chat` - 自定义UI版本
  - `/teacher/dashboard/copilotkit-chat` - CopilotKit UI版本

## 九、F#后端兼容性说明

F#后端已经实现了AG-UI协议：
- 端点位置：`/agui` (在 `Program.fs` 中配置)
- 使用 `KgAgentAGUI` 类实现agent逻辑
- 支持工具调用（课程查询、练习题生成等）

Vite代理配置：
```typescript
"/api/copilotkit": {
  target: "http://localhost:5001/agui",
  rewrite: (path) => path.replace(/^\/api\/copilotkit/, ""),
}
```

CopilotKit UI通过代理转发到F#后端的AG-UI端点，实现完整的CopilotKit体验。
