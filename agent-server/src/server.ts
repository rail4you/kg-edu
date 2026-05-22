/**
 * KgEdu Agent Server
 *
 * 使用 Pi SDK 创建 HTTP API 服务器，替代 .NET Agent。
 * 前端通过 SSE 流式接口与 Agent 交互。
 *
 * 端口：5050（默认）
 *
 * 接口：
 *   POST /api/chat       - SSE 流式聊天（替代 /agui 和 /agent/chat）
 *   POST /api/skills/generate-pptx  - 生成 PPT
 *   POST /api/skills/generate-docx  - 生成 DOCX
 *   GET  /health         - 健康检查
 */

import express from "express";
import {
  AuthStorage,
  createAgentSession,
  DefaultResourceLoader,
  ModelRegistry,
  SessionManager,
} from "@mariozechner/pi-coding-agent";
import { allTools } from "./tools/index.js";
import { extractTenantContext } from "./lib/jwt.js";
import { setTenantContext, getOrgSchema } from "./lib/api-client.js";

const PORT = parseInt(process.env.AGENT_PORT || "5050", 10);
const BACKEND_URL = process.env.KG_EDU_BACKEND_URL || "http://localhost:4000";

// ============================================================
// 系统提示词
// ============================================================

const SYSTEM_PROMPT = `你是KgEdu平台的教育AI助手。

你的职责：
- 管理课程和教学资源
- 创建和管理练习题与试卷
- 生成教学材料（PPT/PPTX课件、DOCX教案文档）

重要规则：
1. 用户询问课程时，必须先调用GetCourses获取课程列表。
2. 创建文档（如教案）时，必须先获取courseId。没有courseId无法保存。
3. 用户提到PPT/PPTX/幻灯片/课件时，必须调用GeneratePowerPointWithShapeCrawler工具。绝不要只是文字描述PPT内容。
4. 如果用户没明确说课程名，先调用GetCourses获取列表后再操作。
5. 【禁止展示ID】内部工具返回的数据中包含id、courseId、parentKnowledgeResourceId等ID字段，这些是系统内部标识符。在向用户展示时，绝对不要显示任何ID字段（如UUID），只展示名称、描述等有意义的信息。你可以内部使用ID来调用其他工具，但回答用户时不要包含任何ID。
6. 回答简洁，直接给出结果，无需多余解释。`;

// ============================================================
// Express App
// ============================================================

const app = express();
app.use(express.json({ limit: "10mb" }));

// CORS
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Org-Schema, X-User-Id, X-Thread-Id");
  if (_req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "kg-edu-agent-server", version: "0.1.0" });
});

// Agent info (兼容原 /info 端点)
app.get("/info", (_req, res) => {
  res.json({
    availableAgents: {
      agents: [{ name: "KgEduAgent", id: "KgEduAgent", description: "教育知识管理助手" }],
    },
  });
});
app.post("/info", (_req, res) => {
  res.json({
    availableAgents: {
      agents: [{ name: "KgEduAgent", id: "KgEduAgent", description: "教育知识管理助手" }],
    },
  });
});

// ============================================================
// Session 缓存（简单内存缓存，按 threadId 存储）
// ============================================================

interface CachedSession {
  session: Awaited<ReturnType<typeof createAgentSession>>["session"];
  orgSchema: string;
  createdAt: number;
}

const sessionCache = new Map<string, CachedSession>();

async function getOrCreateSession(threadId: string, orgSchema: string, userId: string) {
  const cached = sessionCache.get(threadId);
  if (cached) {
    // 更新租户上下文
    setTenantContext(orgSchema, userId);
    return cached.session;
  }

  // 设置租户上下文
  setTenantContext(orgSchema, userId);

  // 动态生成系统提示词
  const loader = new DefaultResourceLoader({
    systemPromptOverride: () =>
      SYSTEM_PROMPT + `\n\n当前租户: ${orgSchema}\n当调用工具需要 orgSchema 时，使用: ${orgSchema}` +
        (userId ? `\n当前用户ID: ${userId}` : ""),
  });
  await loader.reload();

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    sessionManager: SessionManager.inMemory(),
    resourceLoader: loader,
    noTools: "builtin",
    customTools: allTools,
  });

  sessionCache.set(threadId, { session, orgSchema, createdAt: Date.now() });

  // 清理过期 session（超过 30 分钟）
  for (const [key, value] of sessionCache) {
    if (Date.now() - value.createdAt > 30 * 60 * 1000) {
      sessionCache.delete(key);
    }
  }

  return session;
}

// ============================================================
// POST /api/chat - SSE 流式聊天
// ============================================================

app.post("/api/chat", async (req, res) => {
  const { orgSchema, userId } = extractTenantContext(req as any);
  const body = req.body as {
    message?: string;
    messages?: Array<{ role: string; content: string }>;
    threadId?: string;
    forwardedProps?: Record<string, string>;
    systemPrompt?: string;
    userPrompt?: string;
    fileUrls?: Array<{ url: string; type: string }>;
  };

  if (!orgSchema) {
    res.status(400).json({ error: "orgSchema is required (via X-Org-Schema header, JWT token, or request body)" });
    return;
  }

  // 提取用户消息
  const userMessage = body.message ||
    (body.messages?.length ? body.messages[body.messages.length - 1]?.content : "");

  if (!userMessage) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const threadId = body.threadId || body.forwardedProps?.threadId || `thread-${Date.now()}`;

  try {
    const session = await getOrCreateSession(threadId, orgSchema, userId);

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    let fullResponse = "";

    session.subscribe((event) => {
      switch (event.type) {
        case "message_update":
          if (event.assistantMessageEvent.type === "text_delta") {
            const delta = event.assistantMessageEvent.delta;
            fullResponse += delta;
            res.write(`event: message\ndata: ${JSON.stringify({ text: delta })}\n\n`);
          }
          break;

        case "tool_execution_start":
          res.write(`event: tool_start\ndata: ${JSON.stringify({ toolName: event.toolName })}\n\n`);
          break;

        case "tool_execution_end":
          res.write(`event: tool_end\ndata: ${JSON.stringify({ toolName: event.toolName, isError: event.isError })}\n\n`);
          break;

        case "agent_end":
          res.write(`event: thread_id\ndata: ${threadId}\n\n`);
          res.write(`event: done\ndata: [DONE]\n\n`);
          res.end();
          break;

        case "message_end": {
          // 检查是否有错误
          if (event.message && event.message.role === "assistant" && event.message.errorMessage) {
            res.write(`event: error\ndata: ${JSON.stringify({ error: event.message.errorMessage })}\n\n`);
          }
          break;
        }
      }
    });

    // 如果有自定义 system prompt（来自 AI Command）
    let effectiveMessage = userMessage;
    if (body.systemPrompt || body.userPrompt) {
      effectiveMessage = userMessage;
    }

    await session.prompt(effectiveMessage);
  } catch (err: any) {
    console.error("[agent-server] Chat error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// ============================================================
// POST /api/skills/generate-pptx
// ============================================================

app.post("/api/skills/generate-pptx", async (req, res) => {
  const { orgSchema } = extractTenantContext(req as any);
  const body = req.body as {
    orgSchema?: string;
    courseName: string;
    knowledgeName?: string;
    courseId?: string;
    knowledgeResourceId?: string;
    author?: string;
    userRequirements?: string;
    userId?: string;
  };

  const effectiveSchema = body.orgSchema || orgSchema;
  if (!effectiveSchema || !body.courseName) {
    res.status(400).json({ success: false, error: "orgSchema and courseName are required" });
    return;
  }

  setTenantContext(effectiveSchema, body.userId);
  try {
    const { generatePptxAndUpload } = await import("./lib/pptx.js");
    const result = await generatePptxAndUpload(
      {
        courseName: body.courseName,
        knowledgePoints: body.knowledgeName ? [body.knowledgeName] : [body.courseName],
        slides: [{ title: body.courseName, content: body.userRequirements || `关于${body.courseName}的教学内容` }],
        author: body.author,
      },
      effectiveSchema, body.userId, body.courseId, body.knowledgeResourceId
    );
    res.json(result);
  } catch (err: any) {
    console.error("[agent-server] PPTX error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/skills/generate-docx
// ============================================================

app.post("/api/skills/generate-docx", async (req, res) => {
  const { orgSchema } = extractTenantContext(req as any);
  const body = req.body as {
    orgSchema?: string;
    content: string;
    courseId: string;
    fileName?: string;
    userId?: string;
    knowledgeResourceId?: string;
  };

  const effectiveSchema = body.orgSchema || orgSchema;
  if (!effectiveSchema || !body.content || !body.courseId) {
    res.status(400).json({ success: false, error: "orgSchema, content, and courseId are required" });
    return;
  }

  setTenantContext(effectiveSchema, body.userId);
  try {
    const { generateDocxAndUpload } = await import("./lib/docx.js");
    const result = await generateDocxAndUpload(
      body.content, effectiveSchema, body.courseId, body.fileName, body.userId, body.knowledgeResourceId
    );
    res.json(result);
  } catch (err: any) {
    console.error("[agent-server] DOCX error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /competency-graph/generate - AI 生成能力图谱
// ============================================================

app.post("/competency-graph/generate", async (req, res) => {
  const { orgSchema } = extractTenantContext(req as any);
  const body = req.body as {
    orgSchema?: string;
    majorId: string;
    customPrompt?: string;
  };

  const effectiveSchema = body.orgSchema || orgSchema;
  if (!effectiveSchema || !body.majorId) {
    res.status(400).json({ success: false, message: "orgSchema and majorId are required" });
    return;
  }

  setTenantContext(effectiveSchema);
  try {
    const { generateCompetencyGraph } = await import("./lib/competency-graph.js");
    const result = await generateCompetencyGraph(
      { orgSchema: effectiveSchema, majorId: body.majorId, customPrompt: body.customPrompt },
      effectiveSchema,
    );
    res.json(result);
  } catch (err: any) {
    console.error("[agent-server] Competency graph error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// POST /api/curriculum/jobs - 创建课程体系生成任务
// ============================================================

app.post("/api/curriculum/jobs", async (req, res) => {
  const { orgSchema } = extractTenantContext(req as any);
  const body = req.body as {
    orgSchema?: string;
    majorId: string;
    customPrompt?: string;
    userId?: string;
  };

  const effectiveSchema = body.orgSchema || orgSchema;
  if (!effectiveSchema || !body.majorId) {
    res.status(400).json({ success: false, message: "orgSchema and majorId are required" });
    return;
  }

  // 创建 Job
  const { createJob } = await import("./lib/curriculum-job.js");
  const jobId = createJob(effectiveSchema, body.majorId);

  // 异步执行生成（不阻塞响应）
  setTenantContext(effectiveSchema, body.userId);
  const { generateCurriculumGraph } = await import("./lib/curriculum-graph.js");
  const { updateJob } = await import("./lib/curriculum-job.js");
  
  // 更新状态为运行中
  updateJob(jobId, { status: "running", message: "正在生成课程体系..." });
  
  // 异步执行
  generateCurriculumGraph(
    { orgSchema: effectiveSchema, majorId: body.majorId, customPrompt: body.customPrompt, userId: body.userId },
    effectiveSchema,
  ).then((result) => {
    if (result.success && result.data) {
      updateJob(jobId, {
        status: "succeeded",
        message: result.message || "课程体系生成成功",
        result: result.data,
      });
    } else {
      updateJob(jobId, {
        status: "failed",
        message: result.message || "生成失败",
        error: result.message,
      });
    }
  }).catch((err: any) => {
    updateJob(jobId, {
      status: "failed",
      message: err.message || "生成失败",
      error: err.message,
    });
  });

  res.json({
    success: true,
    message: "课程体系生成任务已创建",
    data: { jobId, status: "queued" },
  });
});

// ============================================================
// GET /api/curriculum/jobs/:jobId - 查询任务状态
// ============================================================

app.get("/api/curriculum/jobs/:jobId", async (req, res) => {
  const { jobId } = req.params;
  const { getJob } = await import("./lib/curriculum-job.js");
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ success: false, message: "任务不存在或已过期" });
    return;
  }

  res.json({
    success: true,
    data: job,
  });
});

// ============================================================
// POST /curriculum/generate - 直接生成（同步，保留兼容性）
// ============================================================

app.post("/curriculum/generate", async (req, res) => {
  const { orgSchema } = extractTenantContext(req as any);
  const body = req.body as {
    orgSchema?: string;
    majorId: string;
    customPrompt?: string;
    userId?: string;
  };

  const effectiveSchema = body.orgSchema || orgSchema;
  if (!effectiveSchema || !body.majorId) {
    res.status(400).json({ success: false, message: "orgSchema and majorId are required" });
    return;
  }

  setTenantContext(effectiveSchema, body.userId);
  try {
    const { generateCurriculumGraph } = await import("./lib/curriculum-graph.js");
    const result = await generateCurriculumGraph(
      { orgSchema: effectiveSchema, majorId: body.majorId, customPrompt: body.customPrompt, userId: body.userId },
      effectiveSchema,
    );
    res.json(result);
  } catch (err: any) {
    console.error("[agent-server] Curriculum graph error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// 兼容旧 .NET Agent 的端点（透传）
// ============================================================

app.post("/api/generate_ai_exercise", async (req, res) => {
  const { orgSchema } = extractTenantContext(req as any);
  const tenant = req.body.tenant || orgSchema;
  setTenantContext(tenant);
  try {
    const { generateExercises } = await import("./lib/exercise.js");
    const result = await generateExercises(req.body.input, tenant);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================================================
// POST /api/curriculum/upload - 上传课程体系文档
// ============================================================

app.post("/api/curriculum/upload", async (req, res) => {
  const { orgSchema } = extractTenantContext(req as any);
  
  // Handle multipart form data
  const tenant = req.body.tenant || orgSchema;
  const id = req.body.id;
  const file = req.files?.file || req.body.file;
  
  if (!id) {
    res.status(400).json({ success: false, message: "缺少文档 ID" });
    return;
  }
  
  // Handle file - could be base64 or multipart
  let fileBuffer: Buffer | null = null;
  let fileName = "curriculum_document.docx";
  
  if (req.body.file_data) {
    // Base64 encoded file
    try {
      const base64Data = req.body.file_data.replace(/^data:.*?;base64,/, "");
      fileBuffer = Buffer.from(base64Data, "base64");
      fileName = req.body.file_name || fileName;
    } catch (err: any) {
      res.status(400).json({ success: false, message: "文件解析失败" });
      return;
    }
  } else if (file && typeof file === "object" && file.buffer) {
    // Multipart file
    fileBuffer = file.buffer;
    fileName = file.name || fileName;
  }
  
  if (!fileBuffer) {
    res.status(400).json({ success: false, message: "缺少文件内容" });
    return;
  }
  
  setTenantContext(tenant);
  
  try {
    const { uploadFileToOss } = await import("./lib/oss.js");
    const { callRpc } = await import("./lib/api-client.js");
    
    // Save temp file
    const tmpFileName = `${Date.now()}_${fileName}`;
    const tmpPath = `/tmp/${tmpFileName}`;
    await fs.promises.writeFile(tmpPath, fileBuffer);
    
    // Upload to OSS
    const ossUrl = await uploadFileToOss(tmpPath);
    
    // Clean up temp file
    await fs.promises.unlink(tmpPath).catch(() => {});
    
    if (!ossUrl) {
      res.status(500).json({ success: false, message: "文件上传失败" });
      return;
    }
    
    // Update curriculum design record
    const updateResult = await callRpc("update_curriculum_design", {
      tenant,
      input: { id, file_url: ossUrl },
      fields: ["id", "file_url"],
    });
    
    res.json({ success: true, message: "文档上传成功", data: { file_url: ossUrl } });
  } catch (err: any) {
    console.error("[agent-server] Curriculum upload error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ============================================================
// Start Server
// ============================================================

app.listen(PORT, () => {
  console.log(`🚀 KgEdu Agent Server running on http://localhost:${PORT}`);
  console.log(`   Backend: ${BACKEND_URL}`);
  console.log(`   Endpoints:`);
  console.log(`     POST /api/chat              - SSE 流式聊天`);
  console.log(`     POST /api/skills/generate-pptx - 生成 PPT`);
  console.log(`     POST /api/skills/generate-docx - 生成 DOCX`);
  console.log(`     GET  /health                - 健康检查`);
});
