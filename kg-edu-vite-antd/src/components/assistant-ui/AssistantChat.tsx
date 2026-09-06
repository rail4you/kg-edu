/**
 * 自定义聊天组件 - 直接使用 Pi Agent 流式响应
 * 不依赖 AG-UI 协议，直接消费 SSE 事件
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Avatar } from "antd";
import { LoadingOutlined, RobotOutlined, SendOutlined, UserOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { useAuth } from "@/auth/auth-context";

// ─── Types ───────────────────────────────────────────────────────────

type SseEvent = {
  type: string;
  [key: string]: unknown;
};

interface KnowledgeItem {
  id: string;
  name: string;
  description: string;
  importance_level?: string;
}

interface CustomUIState {
  uiType: string;
  title: string;
  description: string;
  items: KnowledgeItem[];
  selectedIds: Set<string>;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  thinkingContent?: string;
  toolCalls?: ToolCallInfo[];
  isStreaming?: boolean;
  isComplete?: boolean;
  interrupted?: boolean;
  customUI?: CustomUIState;
}

// ─── Tool Name Map ───────────────────────────────────────────────────

const TOOL_NAME_MAP: Record<string, string> = {
  kg_get_courses: "获取课程列表",
  kg_get_knowledge_resources: "获取知识点",
  kg_count_knowledge_resources: "统计知识点",
  kg_generate_pptx: "生成PPT课件",
  kg_generate_docx: "生成Word文档",
  kg_list_ai_generated_files_by_course: "查询AI生成文件",
  GetCourses: "获取课程列表",
  GetCoursesByMajor: "按专业获取课程",
  GetCoursesBySemester: "按学期获取课程",
  GetPublishedCourses: "获取已发布课程",
  GetKnowledgeResources: "获取知识资源",
  GetKnowledgeResourceById: "获取知识资源详情",
  GetExercises: "获取练习题",
  CreateExercise: "创建练习题",
  GenerateExercises: "批量生成练习题",
  GenerateExam: "生成试卷",
  GeneratePowerPointWithShapeCrawler: "生成PPT课件",
  SaveAsDocxAndUpload: "生成Word文档",
  GenerateLessonPlan: "生成教案",
};

function getToolDisplayName(toolName: string): string {
  return TOOL_NAME_MAP[toolName] || toolName;
}

// ─── Helper: generate UUID ───────────────────────────────────────────

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Message History Storage ─────────────────────────────────────────
//
// History is persisted progressively while a run is streaming so that
// switching conversations / navigating away never loses visible output.
// `partial: true` marks an assistant message whose run did not finish
// (user left the page / stream was interrupted).

interface ToolCallInfo {
  toolCallId: string;
  toolName: string;
  status: "running" | "complete" | "error";
  preview?: string;
}

interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCallInfo[];
  partial?: boolean;
  canceled?: boolean;
  ts?: number;
}

function getStorageKey(conversationId: string) {
  return `pi_chat_history_${conversationId}`;
}

function loadHistory(conversationId: string): StoredMessage[] {
  try {
    const raw = localStorage.getItem(getStorageKey(conversationId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveHistory(conversationId: string, messages: StoredMessage[]) {
  try {
    localStorage.setItem(getStorageKey(conversationId), JSON.stringify(messages));
  } catch (e) {
    console.error("[ChatHistory] save failed:", e);
  }
}

// ─── Cross-conversation run registry ────────────────────────────────────
//
// Streams are NOT aborted when the user switches conversations/pages — the
// run keeps generating in the background and persists its progress. The
// module-level registry lets any AssistantChat instance cancel the background
// run of the conversation it is currently viewing.

const runControllers = new Map<string, AbortController>();

function getRunController(conversationId: string): AbortController | null {
  return runControllers.get(conversationId) || null;
}

function cancelBackgroundRun(conversationId: string) {
  runControllers.get(conversationId)?.abort();
}

// ─── Pre-render a single message ─────────────────────────────────────

function MessageBubble({
  msg,
  onSelectKnowledge,
  onToggleKnowledge,
  disabled,
  hideToolCalls = false,
}: {
  msg: Message;
  onSelectKnowledge?: (ids: string[]) => void;
  onToggleKnowledge?: (msgId: string, knowledgeId: string) => void;
  disabled?: boolean;
  hideToolCalls?: boolean;
}) {
  const isUser = msg.role === "user";

  return (
    <div className={`aui-message-row ${isUser ? "aui-message-row-user" : "aui-message-row-assistant"}`}>
      <Avatar
        size={36}
        icon={isUser ? <UserOutlined /> : <RobotOutlined />}
        style={{
          backgroundColor: isUser ? "#1677ff" : "#f0f0f0",
          color: isUser ? "#fff" : "#333",
          flexShrink: 0,
        }}
      />
      <div className={`aui-message-column ${isUser ? "aui-message-column-user" : "aui-message-column-assistant"}`}>
        {/* Tool calls — hidden on the student side so only the final result shows */}
        {!hideToolCalls && msg.toolCalls && msg.toolCalls.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 }}>
            {msg.toolCalls.map((tc) => (
              <div
                key={tc.toolCallId}
                className={`aui-tool-call ${tc.status === "complete" ? "aui-tool-call-complete" : "aui-tool-call-running"}`}
                style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #e8e8e8", background: tc.status === "complete" ? "#f6ffed" : "#fafafa" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {tc.status === "running" && <LoadingOutlined />}
                  <span>{tc.status === "complete" ? "✓ 工具调用完成" : "正在调用工具"}</span>
                  <span className="aui-tool-call-name" style={{ fontWeight: 500 }}>{getToolDisplayName(tc.toolName)}</span>
                </div>
                {/* Live preview of what the tool is composing (e.g. PPT/教案 content) */}
                {tc.preview && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: "#8c8c8c",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      maxHeight: 120,
                      overflow: "hidden",
                      lineHeight: 1.5,
                    }}
                  >
                    {tc.preview.length > 400 ? tc.preview.slice(0, 400) + " …" : tc.preview}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Interrupted run notice */}
        {msg.interrupted && (
          <div
            style={{
              fontSize: 12,
              color: "#d46b08",
              background: "#fff7e6",
              border: "1px solid #ffd591",
              borderRadius: 6,
              padding: "4px 10px",
              marginBottom: 6,
              display: "inline-block",
            }}
          >
            ⚠️ 上次生成未完成（可能因切换页面/会话中断）。可再次发送指令重新生成。
          </div>
        )}

        {/* Thinking indicator */}
        {msg.isStreaming && !msg.content && (hideToolCalls || !msg.toolCalls || msg.toolCalls.length === 0) && (
          <div className="aui-message-bubble aui-message-bubble-text" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <LoadingOutlined />
            <span>思考中...</span>
          </div>
        )}

        {/* Text content */}
        {(msg.content || (isUser)) && (
          <div className="aui-message-bubble aui-message-bubble-text">
            <div className="aui-markdown-content">
              {isUser ? (
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
              ) : msg.isStreaming && !msg.isComplete ? (
                <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {msg.content}
                  <span className="aui-cursor-blink" style={{ display: "inline-block", width: 2, height: 16, backgroundColor: "#1677ff", marginLeft: 2, verticalAlign: "text-bottom", animation: "blink 1s step-end infinite" }} />
                </div>
              ) : (
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
              )}
            </div>
          </div>
        )}

        {/* Custom UI: Knowledge Selector */}
        {msg.customUI && msg.customUI.uiType === "knowledge_selector" && (
          <div className="aui-message-bubble aui-message-bubble-text" style={{ marginTop: 8 }}>
            <KnowledgeSelector
              title={msg.customUI.title}
              description={msg.customUI.description}
              items={msg.customUI.items}
              selectedIds={msg.customUI.selectedIds}
              onToggle={(id) => {
                onToggleKnowledge?.(msg.id, id);
              }}
              onConfirm={() => {
                const ids = Array.from(msg.customUI!.selectedIds);
                const names = ids
                  .map((id) => msg.customUI!.items.find((item) => item.id === id)?.name)
                  .filter(Boolean);
                onSelectKnowledge?.(ids);
              }}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Knowledge Selector Component ────────────────────────────────────

function KnowledgeSelector({
  title,
  description,
  items,
  selectedIds,
  onToggle,
  onConfirm,
  disabled,
}: {
  title: string;
  description: string;
  items: KnowledgeItem[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  return (
    <div className="knowledge-selector">
      <div className="knowledge-selector-header">
        <strong>{title}</strong>
        {description && <p className="knowledge-selector-desc">{description}</p>}
      </div>

      <div className="knowledge-selector-actions">
        <label style={{ cursor: "pointer", fontSize: 13, color: "#1677ff" }}>
          <input
            type="checkbox"
            checked={allSelected}
            onChange={() => {
              items.forEach((item) => {
                const isSelected = selectedIds.has(item.id);
                if (allSelected) {
                  onToggle(item.id); // deselect all
                } else if (!isSelected) {
                  onToggle(item.id); // select missing
                }
              });
            }}
            style={{ marginRight: 4 }}
            disabled={disabled}
          />
          全选 / 取消全选
        </label>
      </div>

      <div className="knowledge-selector-list">
        {items.map((item) => (
          <label
            key={item.id}
            className={`knowledge-selector-item ${selectedIds.has(item.id) ? "selected" : ""}`}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 6,
              cursor: disabled ? "default" : "pointer",
              backgroundColor: selectedIds.has(item.id) ? "#e6f4ff" : "transparent",
              border: selectedIds.has(item.id) ? "1px solid #91caff" : "1px solid #f0f0f0",
              transition: "all 0.2s",
            }}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(item.id)}
              onChange={() => onToggle(item.id)}
              disabled={disabled}
              style={{ marginTop: 2 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</div>
              {item.description && (
                <div style={{ fontSize: 12, color: "#8c8c8c", marginTop: 2 }}>
                  {item.description}
                </div>
              )}
            </div>
            {item.importance_level && item.importance_level === "important" && (
              <span
                style={{
                  fontSize: 11,
                  color: "#fa8c16",
                  background: "#fff7e6",
                  padding: "1px 6px",
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                重点
              </span>
            )}
          </label>
        ))}
      </div>

      <div style={{ marginTop: 12, textAlign: "right" }}>
        <button
          className="aui-composer-send"
          onClick={onConfirm}
          disabled={disabled || selectedIds.size === 0}
          style={{
            padding: "6px 20px",
            borderRadius: 6,
            border: "none",
            backgroundColor: selectedIds.size > 0 ? "#1677ff" : "#d9d9d9",
            color: "#fff",
            cursor: selectedIds.size > 0 && !disabled ? "pointer" : "default",
            fontSize: 14,
          }}
        >
          确认生成 ({selectedIds.size})
        </button>
      </div>

      <style>{`
        .knowledge-selector {
          border: 1px solid #e8e8e8;
          border-radius: 8px;
          padding: 12px;
          background: #fafafa;
          max-width: 100%;
        }
        .knowledge-selector-header strong {
          font-size: 14px;
          color: #1a1a1a;
        }
        .knowledge-selector-desc {
          margin: 4px 0 0;
          font-size: 12px;
          color: #8c8c8c;
        }
        .knowledge-selector-actions {
          margin: 8px 0;
        }
        .knowledge-selector-list {
          display: flex;
          flex-direction: column;
          gap: 4px;
          max-height: 300px;
          overflow-y: auto;
        }
        .knowledge-selector-item:hover {
          background-color: #f5f5f5 !important;
        }
        .knowledge-selector-item.selected:hover {
          background-color: #d6edff !important;
        }
      `}</style>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

interface AssistantChatProps {
  threadId: string | null;
  conversationId: string;
  aiCommand?: {
    id: string;
    title?: string | null;
    system?: string | null;
    user?: string | null;
    assistant?: string | null;
  } | null;
  /** Hide tool-call chips / args preview — used on the student side so the
   *  chat only shows clean Q&A (the final result). */
  hideToolCalls?: boolean;
}

export default function AssistantChat({
  threadId,
  conversationId,
  aiCommand,
  hideToolCalls = false,
}: AssistantChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  // Periodic re-render so the composer reflects the module-level run registry
  // (the source of truth for whether a run is in flight) even if a React state
  // update from a background/terminated async was lost.
  const [, setRegistryTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setRegistryTick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, []);
  const abortRef = useRef<AbortController | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Whether a background run (from a previous visit to this conversation) is
  // still generating — the view keeps watching its persisted progress.
  const [observedRunning, setObservedRunning] = useState(false);
  const isRunningRef = useRef(false);
  isRunningRef.current = isRunning;
  // The conversation whose run this component instance is currently driving.
  const runConversationRef = useRef<string | null>(null);

  // Throttled progressive persistence so switching convs/pages never loses output
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef<(() => StoredMessage[]) | null>(null);

  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current) return;
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      const build = pendingSaveRef.current;
      pendingSaveRef.current = null;
      if (build) {
        const data = build();
        if (data) saveHistory(conversationId, data);
      }
    }, 400);
  }, [conversationId]);

  const scheduleProgressSave = useCallback(
    (build: () => StoredMessage[]) => {
      pendingSaveRef.current = build;
      flushPendingSave();
    },
    [flushPendingSave]
  );

  // Convert persisted messages to view messages.
  // `observeLive: false` is used when the run for this conversation lives in
  // THIS component instance — its own state updates drive the view, so we must
  // not flag it as an observed background run (which would stick `busy` true).
  const storedToMessages = useCallback(
    (stored: StoredMessage[], observeLive = true): Message[] => {
      const last = stored[stored.length - 1];
      // A partial assistant message is "live" while the background run keeps
      // heartbeating its persisted snapshot; it becomes "interrupted" once the
      // heartbeats stop (canceled / page reload) without completing.
      let live = false;
      if (observeLive && last && last.role === "assistant" && last.partial) {
        live = !last.canceled && !!last.ts && Date.now() - last.ts < 4000;
      }
      setObservedRunning(live);
      return stored.map((m) => ({
        ...m,
        isStreaming: false,
        isComplete: true,
        interrupted: observeLive ? !!m.partial && m.id === last?.id && !live : false,
        toolCalls: (m.toolCalls || []).map((tc) => ({ ...tc })),
      }));
    },
    []
  );

  // Load / observe a conversation's history.
  // - If a background run (from an unmounted/other instance) is still streaming
  //   (partial snapshot with fresh ts), keep polling its persisted state and
  //   show it live.
  // - If the run for this conversation is being driven by THIS instance, its own
  //   state updates already drive the view — no observation needed.
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stored = loadHistory(conversationId);
    const last = stored[stored.length - 1];
    const runIsMine =
      isRunningRef.current && runConversationRef.current === conversationId;
    const maybeLive =
      !runIsMine &&
      !!last && last.role === "assistant" && last.partial && !last.canceled && !!last.ts &&
      Date.now() - last.ts < 4000;

    setMessages(storedToMessages(stored, !runIsMine));

    if (maybeLive) {
      // Watch the background run's persisted progress until it completes,
      // gets canceled, or its heartbeats stop.
      let staleChecks = 0;
      const tick = () => {
        if (disposed || isRunningRef.current) return;
        const latest = loadHistory(conversationId);
        const l = latest[latest.length - 1];
        if (!l || !l.partial || l.role !== "assistant") {
          if (l && !l.partial) setMessages(storedToMessages(latest));
          if (timer) clearInterval(timer);
          return;
        }
        if (l.canceled) {
          setMessages(storedToMessages(latest));
          if (timer) clearInterval(timer);
          return;
        }
        const fresh = !!l.ts && Date.now() - l.ts < 4000;
        if (fresh) {
          staleChecks = 0;
          setMessages(storedToMessages(latest));
        } else {
          staleChecks += 1;
          // Heartbeats stopped — the background run died. Mark interrupted.
          if (staleChecks >= 2) {
            setMessages(storedToMessages(latest));
            if (timer) clearInterval(timer);
          }
        }
      };
      timer = setInterval(tick, 700);
    }

    return () => {
      disposed = true;
      if (timer) clearInterval(timer);
    };
  }, [conversationId, storedToMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (viewportRef.current) {
      viewportRef.current.scrollTop = viewportRef.current.scrollHeight;
    }
  }, [messages]);

  // Send message
  const sendMessage = useCallback(
    async (userText: string) => {
      if (!userText.trim() || isRunning) return;
      // The conversation's background run is still generating — wait until it
      // finishes to avoid two overlapping runs in one conversation.
      if (getRunController(conversationId)) return;

      const userMsgId = `msg-${Date.now()}-user`;
      const assistantMsgId = `msg-${Date.now()}-ai`;

      const userMsg: Message = {
        id: userMsgId,
        role: "user",
        content: userText,
        isStreaming: false,
        isComplete: true,
        toolCalls: [],
      };

      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
        isComplete: false,
        toolCalls: [],
      };

      const newMessages = [...messages, userMsg, assistantMsg];
      setMessages(newMessages);
      setInput("");
      setIsRunning(true);
      setObservedRunning(false);
      runConversationRef.current = conversationId;

      // Build message history for API
      const historyForApi = [...messages, userMsg]
        .filter((m) => m.isComplete)
        .map((m) => ({ role: m.role, content: m.content }));
      // Same history but with ids — used for progressive persistence
      const persistedHistory: StoredMessage[] = messages
        .filter((m) => m.isComplete)
        .map((m) => ({ id: m.id, role: m.role, content: m.content }));

      const currentTenant = getCurrentTenant();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...getAuthHeaders(user),
      };
      if (currentTenant?.schemaName) {
        headers["X-Org-Schema"] = currentTenant.schemaName;
      }
      if (user?.id) {
        headers["X-User-Id"] = user.id;
      }

      const body: Record<string, unknown> = {
        threadId: threadId || generateUUID(),
        messages: historyForApi,
        forwardedProps: {
          orgSchema: currentTenant?.schemaName || "",
          userId: user?.id,
          ...(aiCommand
            ? {
                runConfig: {
                  aiCommandId: aiCommand.id,
                  systemPrompt: aiCommand.system || "",
                  userPrompt: aiCommand.user || "",
                  assistantExample: aiCommand.assistant || "",
                },
              }
            : {}),
        },
      };

      const controller = new AbortController();
      abortRef.current = controller;
      runControllers.set(conversationId, controller);

      // ── Run-scoped state (hoisted OUT of `try` because `finally`/`catch` are
      // separate blocks and cannot see `let`/`const` declared inside `try`).
      let accumulatedText = "";
      let hasError = false;
      let runCanceled = false;
      let runFinished = false;
      const toolCallMap = new Map<string, ToolCallInfo>();
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let lineBuffer = "";
      let sseEvent = "";
      let sseData = "";

      // Persist the current in-progress state (throttled) so that leaving the
      // page / switching conversations does not lose visible output. `ts` is a
      // heartbeat used by the observer to tell "still generating" from dead.
      // Once the run finishes, no further partial writes are allowed (they
      // would overwrite the final history written by the finalize step).
      const persistProgress = () => {
        scheduleProgressSave(() => {
          if (runFinished) return null;
          return [
            ...persistedHistory,
            userMsg,
            {
              id: assistantMsgId,
              role: "assistant",
              content: accumulatedText,
              toolCalls: [...toolCallMap.values()].map((tc) => ({ ...tc })),
              partial: true,
              canceled: runCanceled || undefined,
              ts: Date.now(),
            },
          ];
        });
      };

      try {
        const response = await fetch("/api/assistant/ag-ui", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.body) {
          throw new Error("No response body");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Heartbeat: keep the persisted progress "alive" even while the backend
        // is silently working on a long tool call (no SSE events flowing).
        heartbeat = setInterval(persistProgress, 2000);

        // Line-based SSE parser — no split("\n\n") buffering

        function flushCurrentEvent() {
          if (!sseData) return;
          try {
            const parsed = JSON.parse(sseData);
            const evt = parsed.type ? parsed : { type: sseEvent, ...parsed };
            handleSseEvent(evt);
          } catch {
            if (sseEvent) {
              handleSseEvent({ type: sseEvent, data: sseData });
            }
          }
          sseEvent = "";
          sseData = "";
        }

        function handleSseEvent(event: SseEvent) {
          switch (event.type) {
            case "RUN_STARTED":
              break;

            case "THINKING_START":
            case "THINKING_TEXT_MESSAGE_START":
              break;

            case "THINKING_TEXT_MESSAGE_CONTENT": {
              const delta = typeof event.delta === "string" ? event.delta : "";
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, thinkingContent: (m.thinkingContent || "") + delta }
                    : m
                )
              );
              break;
            }

            case "THINKING_TEXT_MESSAGE_END":
            case "THINKING_END":
              break;

            case "TEXT_MESSAGE_START":
              break;

            case "TEXT_MESSAGE_CONTENT": {
              const delta = typeof event.delta === "string" ? event.delta : "";
              accumulatedText += delta;
              const currentText = accumulatedText;
              const currentToolCalls = [...toolCallMap.values()];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: currentText, toolCalls: currentToolCalls, isStreaming: true }
                    : m
                )
              );
              persistProgress();
              break;
            }

            case "TEXT_MESSAGE_END":
              break;

            case "TOOL_CALL_START": {
              const toolCallId = (event.toolCallId as string) || generateUUID();
              const toolName = (event.toolCallName as string) || "unknown";
              toolCallMap.set(toolCallId, { toolCallId, toolName, status: "running" });
              const currentToolCalls = [...toolCallMap.values()];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, toolCalls: currentToolCalls }
                    : m
                )
              );
              persistProgress();
              break;
            }

            case "TOOL_CALL_ARGS": {
              // Live preview of the arguments the tool received (e.g. the lesson
              // plan content being composed) so the user sees generation progress.
              const toolCallId = (event.toolCallId as string) || "";
              const delta = typeof event.delta === "string" ? event.delta : "";
              if (toolCallId && toolCallMap.has(toolCallId) && delta.trim()) {
                const existing = toolCallMap.get(toolCallId)!;
                toolCallMap.set(toolCallId, { ...existing, preview: delta.slice(0, 600) });
              }
              const currentToolCalls = [...toolCallMap.values()];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, toolCalls: currentToolCalls }
                    : m
                )
              );
              persistProgress();
              break;
            }

            case "TOOL_CALL_END": {
              const toolCallId = (event.toolCallId as string) || "";
              if (toolCallId && toolCallMap.has(toolCallId)) {
                const existing = toolCallMap.get(toolCallId)!;
                toolCallMap.set(toolCallId, { ...existing, status: "complete" });
              }
              const currentToolCalls = [...toolCallMap.values()];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, toolCalls: currentToolCalls }
                    : m
                )
              );
              break;
            }

            case "TOOL_CALL_RESULT":
              break;

            case "RUN_FINISHED":
              // The backend signals the end of the run. Signal the reader loop to
              // break cleanly (checking the flag at the loop top) so the finalize
              // step always runs — including for runs that continue in the
              // background after switching conversations/pages. Do NOT call
              // reader.cancel() here: canceling rejects a pending read() with an
              // AbortError, which would skip the finalize block entirely.
              runFinished = true;
              if (heartbeat) clearInterval(heartbeat);
              break;

            case "RUN_ERROR": {
              hasError = true;
              const errMsg = typeof event.message === "string" ? event.message : "未知错误";
              accumulatedText += `\n\n❌ 错误: ${errMsg}`;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: accumulatedText, isStreaming: false, isComplete: true }
                    : m
                )
              );
              persistProgress();
              break;
            }

            case "CUSTOM_UI": {
              const uiType = typeof event.uiType === "string" ? event.uiType : "";
              const items = Array.isArray(event.items) ? event.items as KnowledgeItem[] : [];
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? {
                        ...m,
                        isStreaming: false,
                        customUI: {
                          uiType,
                          title: (typeof event.title === "string" ? event.title : ""),
                          description: (typeof event.description === "string" ? event.description : ""),
                          items,
                          selectedIds: new Set<string>(),
                        },
                      }
                    : m
                )
              );
              break;
            }

            default:
              break;
          }
        }

        while (true) {
          if (runFinished) break;
          const { done, value } = await reader.read();
          if (done) break;

          lineBuffer += decoder.decode(value, { stream: true });

          // Process complete lines only
          const lines = lineBuffer.split("\n");
          // Keep the last (possibly incomplete) line in buffer
          lineBuffer = lines.pop()!;

          for (const line of lines) {
            if (line.startsWith("event: ")) {
              sseEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              sseData = line.slice(6).trimEnd();
            } else if (line === "") {
              // Empty line = event boundary
              flushCurrentEvent();
            }
          }
        }

        // Process any remaining buffered line
        if (lineBuffer.trim()) {
          if (lineBuffer.startsWith("event: ")) {
            sseEvent = lineBuffer.slice(7).trim();
          } else if (lineBuffer.startsWith("data: ")) {
            sseData = lineBuffer.slice(6).trimEnd();
          }
        }
        // Flush the last event if pending
        flushCurrentEvent();

        // Finalize the assistant message
        const finalText = accumulatedText;
        const finalToolCalls = [...toolCallMap.values()].map((tc) => ({
          ...tc,
          status: "complete" as const,
        }));
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, content: finalText, toolCalls: finalToolCalls, isStreaming: false, isComplete: true }
              : m
          )
        );

        // Save history (final, non-partial when the run completed cleanly)
        const completedCleanly = runFinished && !runCanceled;
        const completedMessages: StoredMessage[] = newMessages
          .filter((m) => m.isComplete || m.role === "user")
          .map((m) => ({ id: m.id, role: m.role, content: m.content }));
        completedMessages.push({
          id: assistantMsgId,
          role: "assistant",
          content: finalText,
          toolCalls: finalToolCalls.map((tc) => ({ ...tc })),
          partial: hasError || !completedCleanly,
        });
        saveHistory(conversationId, completedMessages);
        // Drop any throttled partial-save that would overwrite this final history
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        pendingSaveRef.current = null;
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          // User canceled the run — keep the partial progress visible & interrupted
          runCanceled = true;
          persistProgress();
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, isStreaming: false, isComplete: true, interrupted: true } : m
            )
          );
        } else {
          console.error("[AssistantChat] Error:", error);
          const errMsg = error instanceof Error ? error.message : "未知错误";
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: `抱歉，发生了错误: ${errMsg}`, isStreaming: false, isComplete: true, interrupted: true }
                : m
            )
          );
          runCanceled = true;
          persistProgress();
        }
      } finally {
        if (heartbeat) clearInterval(heartbeat);
        runFinished = true;
        setIsRunning(false);
        setObservedRunning(false);
        runConversationRef.current = null;
        // Only clear the registry entry if it still belongs to this run
        if (runControllers.get(conversationId) === controller) {
          runControllers.delete(conversationId);
        }
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [messages, threadId, conversationId, aiCommand, user, isRunning, scheduleProgressSave]
  );

  const handleToggleKnowledge = useCallback(
    (msgId: string, knowledgeId: string) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== msgId || !m.customUI) return m;
          const newSelected = new Set(m.customUI.selectedIds);
          if (newSelected.has(knowledgeId)) {
            newSelected.delete(knowledgeId);
          } else {
            newSelected.add(knowledgeId);
          }
          return { ...m, customUI: { ...m.customUI, selectedIds: newSelected } };
        })
      );
    },
    []
  );

  const handleSelectKnowledge = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      // Find the message that has the customUI to get item names
      const msg = messages.find((m) => m.customUI?.uiType === "knowledge_selector");
      const items = msg?.customUI?.items || [];
      const selectedItems = items.filter((item) => ids.includes(item.id));
      const names = selectedItems.map((item) => item.name);
      const idsStr = selectedItems.map((item) => item.id).join(",");
      const selectionText = `已选择知识点 (${names.length}个): ${names.join(", ")}\n\n请为以上知识点生成PPT课件。知识资源ID: ${idsStr}`;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg?.id
            ? { ...m, customUI: undefined }
            : m
        )
      );
      sendMessage(selectionText);
    },
    [messages, sendMessage]
  );

  const handleSend = () => {
    if (!input.trim() || isRunning || observedRunning) return;
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCancel = () => {
    // Cancel the local run, or the background run still generating for this
    // conversation (started in a previous visit and continued after switching).
    abortRef.current?.abort();
    cancelBackgroundRun(conversationId);
  };

  const busy = runControllers.has(conversationId) || observedRunning || isRunning;

  const hasMessages = messages.length > 0;

  return (
    <div className="aui-thread-root">
      <div className="aui-thread-header">{aiCommand?.title || "AI 智能体助手"}</div>

      {/* Message viewport */}
      <div ref={viewportRef} className="aui-thread-viewport">
        {!hasMessages && (
          <div className="aui-empty-state">
            <RobotOutlined style={{ fontSize: 48, color: "#1677ff" }} />
            <span style={{ fontSize: 16 }}>
              {aiCommand?.title
                ? `你好！我是${aiCommand.title}，有什么可以帮助你的吗？`
                : "你好！我是 AI 教学助手，有什么可以帮助你的吗？"}
            </span>
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            msg={msg}
            onSelectKnowledge={handleSelectKnowledge}
            onToggleKnowledge={handleToggleKnowledge}
            disabled={busy}
            hideToolCalls={hideToolCalls}
          />
        ))}
      </div>

      {/* Composer */}
      <div className="aui-composer-root">
        <div className="aui-composer-shell">
          <textarea
            ref={inputRef as any}
            className="aui-composer-input"
            placeholder="输入您的问题..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={busy}
            rows={1}
          />
          {!busy ? (
            <button
              className="aui-composer-action aui-composer-send"
              onClick={handleSend}
              disabled={!input.trim()}
              style={{ opacity: input.trim() ? 1 : 0.5 }}
            >
              <SendOutlined />
            </button>
          ) : (
            <button className="aui-composer-action aui-composer-cancel" onClick={handleCancel}>
              <LoadingOutlined />
            </button>
          )}
        </div>
      </div>

      {/* Blink animation style */}
      <style>{`
        @keyframes blink {
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
