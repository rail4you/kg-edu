import { promises as fs } from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

type AssistantRequestContext = {
  orgSchema: string;
  userId?: string;
  authorization?: string;
  headers: Headers;
  systemPrompt?: string;
  userPrompt?: string;
  assistantExample?: string;
};

type AssistantRunBody = {
  threadId?: string;
  runId?: string;
  messages?: unknown[];
  forwardedProps?: Record<string, unknown>;
  context?: Array<{ description?: string; value?: unknown }>;
};

type SseController = ReadableStreamDefaultController<Uint8Array>;

type PiModules = {
  createAgentSession: any;
  DefaultResourceLoader: any;
  SessionManager: any;
  defineTool: any;
  AuthStorage: any;
  ModelRegistry: any;
  Type: any;
  getModel?: any;
};

type ThreadMap = Record<string, string>;

const moduleImporter = new Function(
  "specifier",
  "return import(specifier);",
) as (specifier: string) => Promise<any>;

const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(serverDir, "..");
const defaultAgentDir = path.join(repoRoot, ".pi");
const agentDir = process.env.PI_AGENT_DIR || defaultAgentDir;
const defaultSessionDir = path.join(agentDir, "assistant-sessions");
const sessionDir = process.env.PI_AGENT_SESSION_DIR || defaultSessionDir;
const threadMapPath = path.join(sessionDir, "thread-map.json");

function stripAgUiSuffix(url: string) {
  return url.replace(/\/agui$/, "");
}

const backendBaseUrl =
  process.env.KG_EDU_BACKEND_URL ||
  process.env.BACKEND_URL ||
  "http://127.0.0.1:4000";
const backendRpcUrl =
  process.env.KG_EDU_RPC_RUN_URL || `${backendBaseUrl}/rpc/run`;
const legacyAgentUrl = process.env.AGENT_URL || "http://127.0.0.1:5001/agui";
const agentApiBaseUrl =
  process.env.KG_EDU_AGENT_API_BASE_URL || stripAgUiSuffix(legacyAgentUrl);
const defaultThinkingLevel = process.env.PI_AGENT_THINKING_LEVEL || "medium";

let piModulesPromise: Promise<PiModules> | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function jsonText(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

async function ensureSessionDir() {
  await fs.mkdir(sessionDir, { recursive: true });
}

async function readThreadMap(): Promise<ThreadMap> {
  await ensureSessionDir();
  try {
    const raw = await fs.readFile(threadMapPath, "utf8");
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? (parsed as ThreadMap) : {};
  } catch (error) {
    return {};
  }
}

async function writeThreadMap(map: ThreadMap) {
  await ensureSessionDir();
  await fs.writeFile(threadMapPath, JSON.stringify(map, null, 2), "utf8");
}

async function loadPiModules(): Promise<PiModules> {
  if (!piModulesPromise) {
    piModulesPromise = (async () => {
      let piAgent: any;
      let typebox: any;
      let piAi: any;

      try {
        [piAgent, typebox, piAi] = await Promise.all([
          moduleImporter("@earendil-works/pi-coding-agent"),
          moduleImporter("typebox"),
          moduleImporter("@earendil-works/pi-ai").catch(() => null),
        ]);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        throw new Error(
          `Pi 运行时依赖未就绪，请在 kg-edu-vite-antd 下安装 @earendil-works/pi-coding-agent、@earendil-works/pi-ai 和 typebox。原始错误: ${message}`,
        );
      }

      return {
        ...piAgent,
        Type: typebox.Type,
        getModel: piAi?.getModel,
      };
    })();
  }

  return piModulesPromise;
}

function buildSystemPrompt(context: AssistantRequestContext) {
  const sections = [
    "你是 KgEdu 教师端 AI 助手，运行在 Pi agent 网关后面。",
    "你的目标是稳定调用系统工具，而不是凭空编造课程、知识点、文件地址或数据库结果。",
    "规则：",
    "1. 用户提到课程、知识点、PPT、DOCX、教学文档时，优先调用对应工具。",
    "2. 生成 PPTX 或 DOCX 前，必须先确认课程，并尽量确认知识点。",
    "3. 生成成功后，回答里必须返回文件外链 URL。",
    "4. 不要展示内部 UUID，除非工具失败排查绝对需要。",
    "5. 所有回复使用中文。",
  ];

  if (context.systemPrompt) {
    sections.push("附加系统要求：", context.systemPrompt);
  }

  if (context.userPrompt) {
    sections.push("附加用户模板：", context.userPrompt);
  }

  if (context.assistantExample) {
    sections.push("回答风格参考：", context.assistantExample);
  }

  return sections.join("\n");
}

function extractRunConfig(body: AssistantRunBody) {
  const forwardedProps = isRecord(body.forwardedProps) ? body.forwardedProps : {};
  const nestedRunConfig = isRecord(forwardedProps.runConfig)
    ? forwardedProps.runConfig
    : {};

  return {
    systemPrompt:
      getString(nestedRunConfig, "systemPrompt") ||
      getString(forwardedProps, "systemPrompt"),
    userPrompt:
      getString(nestedRunConfig, "userPrompt") ||
      getString(forwardedProps, "userPrompt"),
    assistantExample:
      getString(nestedRunConfig, "assistantExample") ||
      getString(forwardedProps, "assistantExample"),
  };
}

function extractTextFromContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (!isRecord(part)) return "";
      if (part.type === "text" && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function extractLatestUserText(messages: unknown[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!isRecord(message) || message.role !== "user") continue;
    return extractTextFromContent(message.content);
  }

  return "";
}

function extractAssistantTextFromPiMessage(message: unknown): string {
  if (!isRecord(message)) return "";
  const content = message.content;

  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";

  return content
    .map((part) => {
      if (!isRecord(part)) return "";
      if (typeof part.text === "string") return part.text;
      if (part.type === "text" && typeof part.value === "string") return part.value;
      return "";
    })
    .filter(Boolean)
    .join("");
}

function sseWrite(controller: SseController, payload: Record<string, unknown>) {
  const encoder = new TextEncoder();
  controller.enqueue(
    encoder.encode(`event: message\ndata: ${JSON.stringify(payload)}\n\n`),
  );
}

function buildForwardHeaders(context: AssistantRequestContext): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (context.authorization) {
    headers.Authorization = context.authorization;
  }

  const csrfToken = context.headers.get("x-csrf-token");
  if (csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  return headers;
}

async function postRpc(
  context: AssistantRequestContext,
  payload: Record<string, unknown>,
) {
  const response = await fetch(backendRpcUrl, {
    method: "POST",
    headers: buildForwardHeaders(context),
    body: JSON.stringify({
      ...payload,
      tenant: context.orgSchema,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RPC ${payload.action} failed: ${response.status} ${text}`);
  }

  return response.json();
}

async function postAgentSkill(
  context: AssistantRequestContext,
  route: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${agentApiBaseUrl}${route}`, {
    method: "POST",
    headers: buildForwardHeaders(context),
    body: JSON.stringify(payload),
  });

  const result = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      `Agent skill ${route} failed: ${response.status} ${jsonText(result)}`,
    );
  }

  return result;
}

function createToolResult(text: string, details: Record<string, unknown> = {}) {
  return {
    content: [{ type: "text", text }],
    details,
  };
}

async function createPiTools(context: AssistantRequestContext) {
  const { defineTool, Type } = await loadPiModules();

  return [
    defineTool({
      name: "kg_get_courses",
      label: "获取课程",
      description: "查询当前租户下可用课程列表。生成 PPT/DOCX 前优先使用。",
      parameters: Type.Object({}),
      execute: async () => {
        const result = await postRpc(context, {
          action: "get_all_courses",
          fields: [
            "id",
            "title",
            "description",
            "major",
            "semester",
            "knowledgeResourcesCount",
          ],
        });
        return createToolResult(jsonText(result));
      },
    }),
    defineTool({
      name: "kg_get_knowledge_resources",
      label: "获取知识点",
      description: "按课程查询知识点列表，也可直接统计知识点数量。",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程 UUID" }),
      }),
      execute: async (_toolCallId: string, params: { courseId: string }) => {
        const result = await postRpc(context, {
          action: "list_knowledges",
          fields: [
            "id",
            "name",
            "knowledgeType",
            "description",
            "importanceLevel",
            "courseId",
          ],
          filter: {
            courseId: { eq: params.courseId },
          },
          page: {
            limit: 1000,
          },
        });
        return createToolResult(jsonText(result));
      },
    }),
    defineTool({
      name: "kg_count_knowledge_resources",
      label: "统计知识点",
      description: "统计某个课程下的知识点数量，用于校验课程知识点总数。",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程 UUID" }),
      }),
      execute: async (_toolCallId: string, params: { courseId: string }) => {
        const result = await postRpc(context, {
          action: "list_knowledges",
          fields: ["id"],
          filter: {
            courseId: { eq: params.courseId },
          },
          page: {
            limit: 1000,
          },
        });

        const rows = Array.isArray(result?.data)
          ? result.data
          : Array.isArray(result?.results)
            ? result.results
            : [];

        return createToolResult(
          jsonText({
            success: true,
            courseId: params.courseId,
            count: rows.length,
          }),
        );
      },
    }),
    defineTool({
      name: "kg_generate_pptx",
      label: "生成 PPTX",
      description:
        "为课程或知识点生成 PPTX，并保留 OSS 外链与数据库记录。必须尽量传 courseId，知识点场景尽量传 knowledgeResourceId。",
      parameters: Type.Object({
        courseName: Type.String({ description: "课程名称" }),
        courseId: Type.Optional(Type.String({ description: "课程 UUID" })),
        knowledgeName: Type.Optional(Type.String({ description: "知识点名称" })),
        knowledgeResourceId: Type.Optional(
          Type.String({ description: "知识点 UUID" }),
        ),
        userRequirements: Type.Optional(
          Type.String({ description: "额外生成要求" }),
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: {
          courseName: string;
          courseId?: string;
          knowledgeName?: string;
          knowledgeResourceId?: string;
          userRequirements?: string;
        },
      ) => {
        const result = await postAgentSkill(context, "/agent/skills/generate-pptx", {
          orgSchema: context.orgSchema,
          userId: context.userId,
          courseName: params.courseName,
          courseId: params.courseId,
          knowledgeName: params.knowledgeName,
          knowledgeResourceId: params.knowledgeResourceId,
          userRequirements: params.userRequirements,
        });
        return createToolResult(jsonText(result));
      },
    }),
    defineTool({
      name: "kg_generate_docx",
      label: "生成 DOCX",
      description:
        "根据已准备好的教学文档内容生成 DOCX，并保留 OSS 外链与数据库记录。",
      parameters: Type.Object({
        content: Type.String({ description: "要写入 DOCX 的 markdown/纯文本内容" }),
        fileName: Type.Optional(Type.String({ description: "文件名" })),
        courseId: Type.String({ description: "课程 UUID" }),
        courseName: Type.Optional(Type.String({ description: "课程名称" })),
        knowledgeName: Type.Optional(Type.String({ description: "知识点名称" })),
        knowledgeResourceId: Type.Optional(
          Type.String({ description: "知识点 UUID" }),
        ),
      }),
      execute: async (
        _toolCallId: string,
        params: {
          content: string;
          fileName?: string;
          courseId: string;
          courseName?: string;
          knowledgeName?: string;
          knowledgeResourceId?: string;
        },
      ) => {
        const result = await postAgentSkill(context, "/agent/skills/generate-docx", {
          orgSchema: context.orgSchema,
          userId: context.userId,
          content: params.content,
          fileName: params.fileName,
          courseId: params.courseId,
          courseName: params.courseName,
          knowledgeName: params.knowledgeName,
          knowledgeResourceId: params.knowledgeResourceId,
        });
        return createToolResult(jsonText(result));
      },
    }),
    defineTool({
      name: "kg_list_ai_generated_files_by_course",
      label: "查询 AI 文件",
      description: "查询某个课程下 AI 生成文件，确认 PPTX/DOCX 是否已经落库。",
      parameters: Type.Object({
        courseId: Type.String({ description: "课程 UUID" }),
      }),
      execute: async (_toolCallId: string, params: { courseId: string }) => {
        const result = await postRpc(context, {
          action: "list_ai_generated_files_by_course",
          input: {
            courseId: params.courseId,
          },
          fields: [
            "id",
            "filename",
            "fileType",
            "path",
            "size",
            "source",
            "courseId",
            "knowledgeResourceId",
          ],
        });
        return createToolResult(jsonText(result));
      },
    }),
  ];
}

async function buildPiSession(threadId: string, context: AssistantRequestContext) {
  const modules = await loadPiModules();
  const {
    createAgentSession,
    DefaultResourceLoader,
    SessionManager,
    AuthStorage,
    ModelRegistry,
    getModel,
  } = modules;

  const threadMap = await readThreadMap();
  const knownSessionPath = threadMap[threadId];
  let sessionManager: any;

  if (knownSessionPath) {
    try {
      await fs.access(knownSessionPath);
      sessionManager = SessionManager.open(knownSessionPath, sessionDir);
    } catch {
      sessionManager = SessionManager.create(repoRoot, sessionDir);
    }
  } else {
    sessionManager = SessionManager.create(repoRoot, sessionDir);
  }

  const loader = new DefaultResourceLoader({
    cwd: repoRoot,
    agentDir,
    systemPromptOverride: () => buildSystemPrompt(context),
  });
  await loader.reload();

  const authStorage = AuthStorage.create();
  const modelRegistry = ModelRegistry.create(authStorage);

  await modelRegistry.refresh();

  const provider =
    process.env.PI_AGENT_MODEL_PROVIDER || "qwen";
  const modelId =
    process.env.PI_AGENT_MODEL_ID || "qwen-plus";
  const model =
    typeof getModel === "function"
      ? getModel(provider, modelId) || modelRegistry.find(provider, modelId)
      : modelRegistry.find(provider, modelId);

  if (!model) {
    throw new Error(
      `Pi agent model not found: ${provider}/${modelId}. Check ~/.pi/agent/models.json or set PI_AGENT_MODEL_PROVIDER/PI_AGENT_MODEL_ID.`,
    );
  }
  console.log(
    `[PiGateway] Using model: ${model.id} (provider: ${model.provider}, baseUrl: ${model.baseUrl})`,
  );

  const customTools = await createPiTools(context);

  const sessionResult = await createAgentSession({
    cwd: repoRoot,
    agentDir,
    sessionManager,
    resourceLoader: loader,
    authStorage,
    modelRegistry,
    ...(model ? { model } : {}),
    thinkingLevel: defaultThinkingLevel,
    noTools: "builtin",
    customTools,
  });

  const session = sessionResult.session;
  const sessionFile =
    typeof sessionManager.getSessionFile === "function"
      ? sessionManager.getSessionFile()
      : undefined;

  if (sessionFile && threadMap[threadId] !== sessionFile) {
    threadMap[threadId] = sessionFile;
    await writeThreadMap(threadMap);
  }

  return session;
}

function getToolCallId(
  event: Record<string, unknown>,
  fallbackName: string,
  activeToolIds: Map<string, string[]>,
) {
  const directId =
    getString(event, "toolCallId") ||
    getString(event, "tool_call_id") ||
    getString(event, "id");

  if (directId) return directId;

  const stack = activeToolIds.get(fallbackName) || [];
  if (stack.length > 0) {
    return stack[stack.length - 1]!;
  }

  const generated = randomUUID();
  activeToolIds.set(fallbackName, [...stack, generated]);
  return generated;
}

export async function runPiAgentAsAgUi(
  requestHeaders: Headers,
  body: AssistantRunBody,
) {
  const threadId = body.threadId || "main";
  const runId = body.runId || randomUUID();
  const prompt = extractLatestUserText(body.messages || []);
  const runConfig = extractRunConfig(body);
  const forwardedProps = isRecord(body.forwardedProps) ? body.forwardedProps : {};

  const context: AssistantRequestContext = {
    orgSchema:
      requestHeaders.get("x-org-schema") ||
      requestHeaders.get("orgschema") ||
      getString(forwardedProps, "orgSchema") ||
      "",
    userId: requestHeaders.get("x-user-id") || undefined,
    authorization: requestHeaders.get("authorization") || undefined,
    headers: requestHeaders,
    ...runConfig,
  };

  if (!context.orgSchema) {
    throw new Error("缺少 X-Org-Schema，Pi agent 无法确定租户。");
  }

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const activeToolIds = new Map<string, string[]>();
      let textMessageId = randomUUID();
      let textStarted = false;
      let thinkingStarted = false;
      let thinkingMessageStarted = false;
      let thinkingMessageId = randomUUID();

      function closeThinking() {
        if (thinkingMessageStarted) {
          sseWrite(controller, {
            type: "THINKING_TEXT_MESSAGE_END",
            messageId: thinkingMessageId,
          });
          thinkingMessageStarted = false;
        }
        if (thinkingStarted) {
          sseWrite(controller, { type: "THINKING_END" });
          thinkingStarted = false;
        }
      }

      try {
        const session = await buildPiSession(threadId, context);

        sseWrite(controller, { type: "RUN_STARTED", runId });

        const unsubscribe =
          typeof session.subscribe === "function"
            ? session.subscribe((event: any) => {
                if (!event || typeof event !== "object") return;

                if (event.type === "message_update") {
                  const assistantEvent = event.assistantMessageEvent;
                  if (!assistantEvent || typeof assistantEvent !== "object") return;

                  if (assistantEvent.type === "thinking_delta") {
                    if (!thinkingStarted) {
                      closeThinking();
                      thinkingStarted = true;
                      thinkingMessageId = randomUUID();
                      sseWrite(controller, { type: "THINKING_START" });
                      sseWrite(controller, {
                        type: "THINKING_TEXT_MESSAGE_START",
                        messageId: thinkingMessageId,
                      });
                      thinkingMessageStarted = true;
                    }

                    sseWrite(controller, {
                      type: "THINKING_TEXT_MESSAGE_CONTENT",
                      messageId: thinkingMessageId,
                      delta: assistantEvent.delta || "",
                    });
                  }

                  if (assistantEvent.type === "text_delta") {
                    // Close thinking section before text starts
                    if (thinkingStarted) {
                      closeThinking();
                    }

                    if (!textStarted) {
                      textStarted = true;
                      sseWrite(controller, {
                        type: "TEXT_MESSAGE_START",
                        messageId: textMessageId,
                      });
                    }

                    sseWrite(controller, {
                      type: "TEXT_MESSAGE_CONTENT",
                      messageId: textMessageId,
                      delta: assistantEvent.delta || "",
                    });
                  }
                }

                if (event.type === "tool_execution_start") {
                  // Close thinking before tool call
                  if (thinkingStarted) {
                    closeThinking();
                  }

                  const toolName =
                    event.toolName || event.name || event.tool?.name || "tool";
                  const toolCallId = getToolCallId(
                    event,
                    toolName,
                    activeToolIds,
                  );

                  activeToolIds.set(toolName, [
                    ...(activeToolIds.get(toolName) || []),
                    toolCallId,
                  ]);

                  sseWrite(controller, {
                    type: "TOOL_CALL_START",
                    toolCallId,
                    toolCallName: toolName,
                    parentMessageId: textMessageId,
                  });
                }

                if (event.type === "tool_execution_end") {
                  const toolName =
                    event.toolName || event.name || event.tool?.name || "tool";
                  const toolCallId = getToolCallId(
                    event,
                    toolName,
                    activeToolIds,
                  );

                  sseWrite(controller, {
                    type: "TOOL_CALL_END",
                    toolCallId,
                  });

                  const resultText =
                    typeof event.result === "string"
                      ? event.result
                      : event.result !== undefined
                        ? jsonText(event.result)
                        : typeof event.output === "string"
                          ? event.output
                          : event.output !== undefined
                            ? jsonText(event.output)
                            : "";

                  if (resultText) {
                    sseWrite(controller, {
                      type: "TOOL_CALL_RESULT",
                      toolCallId,
                      content: resultText,
                      role: "tool",
                    });
                  }

                  const stack = [...(activeToolIds.get(toolName) || [])];
                  stack.pop();
                  activeToolIds.set(toolName, stack);
                }
              })
            : undefined;

        await session.prompt(prompt, {
          source: "user",
        });

        await session.agent.waitForIdle();

        // Close any remaining thinking section
        closeThinking();

        const lastMessage = session.agent.state?.messages?.at?.(-1);
        const fallbackText = extractAssistantTextFromPiMessage(lastMessage);

        if (!textStarted && fallbackText) {
          textStarted = true;
          sseWrite(controller, {
            type: "TEXT_MESSAGE_START",
            messageId: textMessageId,
          });
          sseWrite(controller, {
            type: "TEXT_MESSAGE_CONTENT",
            messageId: textMessageId,
            delta: fallbackText,
          });
        }

        if (textStarted) {
          sseWrite(controller, {
            type: "TEXT_MESSAGE_END",
            messageId: textMessageId,
          });
        }

        sseWrite(controller, { type: "RUN_FINISHED", runId });
        unsubscribe?.();
        controller.close();
      } catch (error) {
        sseWrite(controller, {
          type: "RUN_ERROR",
          message: error instanceof Error ? error.message : String(error),
        });
        sseWrite(controller, { type: "RUN_FINISHED", runId });
        controller.close();
      }
    },
  });
}
