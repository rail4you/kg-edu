# Agent 服务迁移总结

> 将 Express API Server (port 3000) 和 Pi SDK Agent (port 5050) 全部迁移到 Elixir Phoenix (port 4000)

**日期**: 2026-06-20 ~ 2026-06-21  
**涉及提交**: `fa31c3f` ~ `f267c2b` (22 个提交)  
**分支**: `uat`

---

## 架构变化

```
Before:                          After:
┌─────────────┐                 ┌─────────────┐
│ Vite :8081   │                 │ Vite :8081   │
├─────────────┤                 ├─────────────┤
│ Express :3000│ (API Upload)   │             │
├─────────────┤                 │   (proxy)   │
│ Pi SDK :5050 │ (Chat Agent)   │             │
├─────────────┤                 ├─────────────┤
│ Phoenix :4000│ (Ash CRUD)     │ Phoenix :4000│ (ALL)
└─────────────┘                 └─────────────┘
```

**已停用的端口**: `:3000` (Express), `:5050` (Pi SDK Agent)

---

## 一、AI 聊天 Agent

替代原 `agent-server/src/server.ts` 的 Pi SDK Agent。

| 组件 | 文件 |
|------|------|
| Chat Controller | `lib/kg_edu_web/controllers/chat_controller.ex` |
| Chat Config | `lib/kg_edu/chat.ex` |
| Agent Tools | `lib/kg_edu/agent/tools/*.ex` (11 个 Jido.Action 工具) |
| Data Access | `lib/kg_edu/agent/data_access.ex` (直接 Ash 调用) |
| Session Context | `lib/kg_edu/agent/session_context.ex` (租户/用户传递) |
| Script Tool Factory | `lib/kg_edu/jido_agents/script_tool_factory.ex` (动态生成 JS/Python Action) |

**端点**: `POST /api/assistant/ag-ui`

**事件类型**: `RUN_STARTED`, `TEXT_MESSAGE_START/CONTENT/END`, `TOOL_CALL_START/ARGS/END`, `RUN_FINISHED/ERROR`, `CUSTOM_UI`

**11 个 Agent 工具**:
- `GetCourses`, `GetCoursesByMajor`, `GetCoursesBySemester` — 课程查询
- `GetKnowledgeResources` — 知识点查询
- `GetExercises`, `GenerateExercises` — 习题
- `GetExams` — 试卷
- `GeneratePowerPointWithShapeCrawler` — PPTX 生成
- `SaveAsDocxAndUpload` — DOCX 生成
- `GenerateCompetencyGraph`, `GenerateCurriculum` — AI 生成

**兼容性处理**:
- 支持 `{messages: [{role, content}]}` 和 `{message: "..."}` 两种前端格式
- 过滤 Qwen 模型误输出的工具名文本
- 处理 `\\n` 字面量转义

---

## 二、PPTX 课件生成

替代原 `agent-server/src/lib/pptx.ts`。

| 组件 | 文件 |
|------|------|
| JS 脚本 | `priv/skills/document/tools/generate_pptx.js` |
| Schema | `priv/skills/document/tools/generate_pptx.schema.json` |
| Document Tools | `lib/kg_edu/agent/tools/document_tools.ex` |

**技术栈**: pptxgenjs (和旧 agent 同一套 JS 库)

**功能**:
- 深蓝主题：标题页 + 内容页 + 感谢页
- Header bar、页码、accent 装饰线
- Microsoft YaHei 字体，16:9 宽屏
- LLM 生成内容按 `\n\n` 段拆分为多张幻灯片，首行为标题
- 文件名格式: `课程名-知识点名.pptx`

**上传**: OSS HTTP Basic Auth，中文文件名 URL 编码

**入库**: `source: "ai_generated"`，关联 `course_id` 和 `knowledge_resource_id`

---

## 三、DOCX 教案生成

替代原 `agent-server/src/lib/docx.ts`。

| 组件 | 文件 |
|------|------|
| JS 脚本 | `priv/skills/document/tools/generate_docx.js` |

**技术栈**: pandoc（和旧 agent 一致，Markdown → DOCX）

**知识库内容增强**: 查询知识资源的 `description` 和 `teaching_goal` 字段

---

## 四、知识点选择交互 UI（新增）

**流程**:
```
用户: "平面构成生成pptx"
  → 后端检测到 PPTX 请求
  → 从消息中提取关键词（如"平面构成"）
  → 查询知识库，按课程分组，选匹配最多的课程
  → 返回 CUSTOM_UI 事件（10 条最相关知识点，重要程度排序）
  → 前端渲染 checkbox 选择器
  → 用户勾选知识点，点击"确认生成"
  → 前端发送 "已选择知识点: xxx" → Agent 生成 PPTX
```

**实现**:
- 后端: `ChatController.is_knowledge_selection_needed?/3` + `fetch_knowledge_list/3`
- 前端: `AssistantChat.tsx` — `KnowledgeSelector` 组件，支持全选、重要标记、确认按钮

---

## 五、文件上传

替代原 Express `POST /api/upload` 和 `POST /api/sts-token`。

| 功能 | 端点 | 文件 |
|------|------|------|
| 文件上传 OSS | `POST /api/upload` | `lib/kg_edu_web/controllers/file_upload_controller.ex` |
| STS Token | `POST /api/sts-token` | 同上 |
| OSS 客户端 | — | `lib/kg_edu/agent/oss_upload.ex` |

**技术栈**: HTTP Basic Auth (弃用 ExAws S3/HMAC-SHA1)

---

## 六、AI 生成能力

| 功能 | 端点 | 文件 |
|------|------|------|
| 练习题生成 | `POST /api/generate_ai_exercise` | `lib/kg_edu_web/controllers/generation_controller.ex` |
| 能力图谱 | `POST /competency-graph/generate` | `lib/kg_edu/agent/tools/competency_tools.ex` |
| 课程体系 | `POST /curriculum/generate` | `lib/kg_edu/agent/tools/curriculum_tools.ex` |
| 异步 Job | `POST /api/curriculum/jobs` | `lib/kg_edu/agent/job_manager.ex` |
| Job 状态 | `GET /api/curriculum/jobs/:id` | ETS 存储，支持 queued/running/succeeded/failed |

---

## 七、Excel 导入

| 功能 | 端点 | 文件 |
|------|------|------|
| 知识资源导入 | `POST /import` | `lib/kg_edu_web/controllers/import_controller.ex` |
| 章节导入 | `POST /import-chapters` | 同上 |
| 课程文档上传 | `POST /api/curriculum/upload` | `lib/kg_edu_web/controllers/generation_controller.ex` |

---

## 八、基础设施变更

| 改动 | 说明 |
|------|------|
| Vite proxy | `/api/upload`, `/api/sts-token`, `/api/health`, `/agent`, `/api/assistant`, `/competency-graph`, `/curriculum` 全部指向 `:4000` |
| Frontend | `oss-upload.ts` 改用相对 URL（走 Vite proxy） |
| dev.sh | 移除 agent-server 和 Express API Server，只管理 Vite + Phoenix |
| `OssUpload` | 从 HMAC-SHA1 → ExAws S3 → HTTP Basic Auth |
| `JobManager` | ETS 实现的异步任务队列 |
| `ScriptToolFactory` | 支持 `.js` (node) 和 `.py` (python3) 运行时 |
