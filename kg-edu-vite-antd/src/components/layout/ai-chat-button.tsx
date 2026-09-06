import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Tooltip, theme, Tag, Button, message } from "antd";
import { MessageOutlined, CloseOutlined, RobotOutlined, PlusOutlined, SendOutlined, LoadingOutlined, UserOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listCommands } from "@/lib/ash_rpc";
import { themeColors as colors } from "@/styles/theme";

const { useToken } = theme;

interface AICommand {
  id: string;
  title: string | null;
  user: string | null;
  system: string | null;
  assistant: string | null;
}

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

export function AIChatButton({ variant }: { variant?: "default" | "inline" | "fab" }) {
  const [open, setOpen] = useState(false);
  const [switchMenuOpen, setSwitchMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const switchButtonRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const { authenticated, user } = useAuth();
  const { token } = useToken();

  const [aiCommands, setAiCommands] = useState<AICommand[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<AICommand | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const loadAiCommands = async () => {
      if (!user) return;
      try {
        const result = await listCommands({
          fields: ["id", "title", "user", "system", "assistant"] as any,
          headers: getAuthHeaders(user) as Record<string, string>,
        });
        if (result.success && result.data) {
          const data = result.data as any;
          setAiCommands(Array.isArray(data) ? data : data.results || []);
        }
      } catch (error) {
        console.error("加载AI命令失败:", error);
      }
    };
    if (open) {
      loadAiCommands();
    }
  }, [open, user]);

  // Close switch menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (switchMenuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        if (switchButtonRef.current && !switchButtonRef.current.contains(e.target as Node)) {
          setSwitchMenuOpen(false);
        }
      }
    };
    if (switchMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [switchMenuOpen]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectCommand = (command: AICommand | null) => {
    setSelectedCommand(command);
    setMessages([]);
    setSwitchMenuOpen(false);
  };

  const toggleSwitchMenu = () => {
    if (!switchMenuOpen && switchButtonRef.current) {
      const rect = switchButtonRef.current.getBoundingClientRect();
      setMenuPosition({
        top: rect.bottom + 8,
        left: rect.right - 240,
      });
    }
    setSwitchMenuOpen(!switchMenuOpen);
  };

  const handleClose = () => {
    abortRef.current?.abort();
    setOpen(false);
  };

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const userMsgId = `msg-${Date.now()}-user`;
    const assistantMsgId = `msg-${Date.now()}-ai`;

    const userMsg: ChatMessage = { id: userMsgId, role: "user", content: userText };
    const assistantMsg: ChatMessage = { id: assistantMsgId, role: "assistant", content: "", isStreaming: true };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    const currentTenant = getCurrentTenant();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...getAuthHeaders(user),
    };
    if (currentTenant?.schemaName) headers["X-Org-Schema"] = currentTenant.schemaName;
    if (user?.id) headers["X-User-Id"] = user.id;

    const body: Record<string, unknown> = {
      threadId: generateUUID(),
      messages: [userMsg].map(m => ({ role: m.role, content: m.content })),
      forwardedProps: {
        orgSchema: currentTenant?.schemaName || "",
        userId: user?.id,
        ...(selectedCommand ? {
          runConfig: {
            aiCommandId: selectedCommand.id,
            systemPrompt: selectedCommand.system || "",
            userPrompt: selectedCommand.user || "",
            assistantExample: selectedCommand.assistant || "",
          },
        } : {}),
      },
    };

    abortRef.current = new AbortController();

    try {
      const response = await fetch("/api/assistant/ag-ui", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedText = "";
      let lineBuffer = "";
      let sseEvent = "";
      let sseData = "";

      function flushEvent() {
        if (!sseData) return;
        try {
          const parsed = JSON.parse(sseData);
          const evt = parsed.type ? parsed : { type: sseEvent, ...parsed };
          if (evt.type === "TEXT_MESSAGE_CONTENT") {
            const delta = typeof evt.delta === "string" ? evt.delta : "";
            accumulatedText += delta;
            const currentText = accumulatedText;
            setMessages((prev) =>
              prev.map((m) => m.id === assistantMsgId ? { ...m, content: currentText } : m)
            );
          } else if (evt.type === "RUN_ERROR") {
            const errMsg = typeof evt.message === "string" ? evt.message : "未知错误";
            accumulatedText += `\n\n❌ 错误: ${errMsg}`;
            setMessages((prev) =>
              prev.map((m) => m.id === assistantMsgId ? { ...m, content: accumulatedText } : m)
            );
          }
        } catch {
          // Ignore parse errors
        }
        sseEvent = "";
        sseData = "";
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        lineBuffer += decoder.decode(value, { stream: true });
        const lines = lineBuffer.split("\n");
        lineBuffer = lines.pop()!;

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            sseEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            sseData = line.slice(6).trimEnd();
          } else if (line === "") {
            flushEvent();
          }
        }
      }
      if (lineBuffer.trim()) {
        if (lineBuffer.startsWith("event: ")) sseEvent = lineBuffer.slice(7).trim();
        else if (lineBuffer.startsWith("data: ")) sseData = lineBuffer.slice(6).trimEnd();
      }
      flushEvent();

      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsgId ? { ...m, isStreaming: false } : m)
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsgId ? { ...m, isStreaming: false } : m)
        );
      } else {
        console.error("[AIChatButton] Error:", error);
        const errMsg = error instanceof Error ? error.message : "未知错误";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId ? { ...m, content: `错误: ${errMsg}`, isStreaming: false } : m
          )
        );
      }
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [isLoading, user, selectedCommand]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!authenticated) return null;

  const isInline = variant === "inline";
  const isFab = variant === "fab";

  return (
    <>
      {isFab ? (
        <Tooltip title="AI 助手" placement="left">
          <div
            onClick={() => { setOpen(true); setMessages([]); }}
            style={{
              position: "fixed",
              bottom: 24,
              right: 24,
              width: 52,
              height: 52,
              borderRadius: 16,
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primary}CC 100%)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: `0 2px 12px ${colors.primary}44, 0 6px 24px ${colors.primary}22`,
              transition: "all 0.2s ease",
              zIndex: 999,
              backdropFilter: "blur(8px)",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(-2px)";
              el.style.boxShadow = `0 4px 20px ${colors.primary}55, 0 8px 32px ${colors.primary}33`;
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLDivElement;
              el.style.transform = "translateY(0)";
              el.style.boxShadow = `0 2px 12px ${colors.primary}44, 0 6px 24px ${colors.primary}22`;
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              <circle cx="9" cy="10" r="1" fill="white" />
              <circle cx="15" cy="10" r="1" fill="white" />
              <path d="M9 14c.7.7 1.8 1 3 1s2.3-.3 3-1" />
            </svg>
          </div>
        </Tooltip>
      ) : isInline ? (
        <div
          style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
          onClick={() => { setOpen(true); setMessages([]); }}
        >
          <div style={{
            width: 22, height: 22, borderRadius: 11,
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight || colors.primary + '99'} 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <RobotOutlined style={{ fontSize: 12, color: "#fff" }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 500 }}>AI 助手</span>
        </div>
      ) : (
        <Tooltip title="AI 智能助手">
          <div
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, borderRadius: 18,
              background: "rgba(255,255,255,0.2)", border: "1px solid rgba(255,255,255,0.3)",
              cursor: "pointer", transition: "all 0.2s ease",
            }}
            onClick={() => { setOpen(true); setMessages([]); }}
          >
            <MessageOutlined style={{ color: "#fff", fontSize: 15 }} />
          </div>
        </Tooltip>
      )}

      {open && createPortal(
        <>
          {/* Overlay */}
          <div
            style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.3)", zIndex: 10000 }}
            onClick={handleClose}
          />

          {/* Sidebar Chat */}
          <div
            style={{
              position: "fixed", top: 0, right: 0,
              width: 420, maxWidth: "100vw", height: "100vh",
              background: "#fff", boxShadow: "-4px 0 20px rgba(0,0,0,0.15)",
              zIndex: 10001, display: "flex", flexDirection: "column", overflow: "hidden",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 16px", borderBottom: "1px solid #f0f0f0",
                background: colors.primary,
                color: "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <RobotOutlined />
                <span style={{ fontWeight: 600, fontSize: 15 }}>{selectedCommand?.title || "AI 智能助手"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div ref={switchButtonRef} onClick={toggleSwitchMenu} style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px", background: "rgba(255,255,255,0.2)", borderRadius: 4, cursor: "pointer", fontSize: 12, userSelect: "none" }}>
                  <PlusOutlined />
                  <span>切换助手</span>
                </div>
                <CloseOutlined style={{ cursor: "pointer", fontSize: 16 }} onClick={handleClose} />
              </div>
            </div>

            {/* Command hint */}
            {selectedCommand && (
              <div style={{ padding: "8px 16px", background: `${colors.primary}08`, borderBottom: `1px solid ${colors.primary}20`, fontSize: 12, color: colors.primary }}>
                正在使用：{selectedCommand.title || "未命名助手"}
              </div>
            )}

            {/* Messages */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: "center", color: "#9ca3af", paddingTop: 60 }}>
                  <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                  <div>{selectedCommand?.user || "你好！有什么学习上的问题可以问我？"}</div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start", marginBottom: 12 }}>
                    {msg.role === "assistant" && (
                      <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#f0f0f0", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 }}>
                        <RobotOutlined style={{ color: "#333", fontSize: 14 }} />
                      </div>
                    )}
                    <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: 12, backgroundColor: msg.role === "user" ? colors.primary : "#f3f4f6", color: msg.role === "user" ? "#fff" : "#374151" }}>
                      {msg.role === "user" ? (
                        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{msg.content}</div>
                      ) : msg.content ? (
                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        </div>
                      ) : msg.isStreaming ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                          <LoadingOutlined />
                          <span>思考中...</span>
                        </div>
                      ) : null}
                    </div>
                    {msg.role === "user" && (
                      <div style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "#10b981", display: "flex", alignItems: "center", justifyContent: "center", marginLeft: 8, flexShrink: 0 }}>
                        <UserOutlined style={{ color: "#fff", fontSize: 14 }} />
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div style={{ padding: "12px 16px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                ref={inputRef as any}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="输入您的问题..."
                disabled={isLoading}
                rows={1}
                style={{
                  flex: 1, border: "1px solid #d9d9d9", borderRadius: 8, padding: "8px 12px",
                  fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit",
                }}
              />
              {isLoading ? (
                <div
                  onClick={() => abortRef.current?.abort()}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: '#f5f5f5', border: '1px solid #d9d9d9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  <LoadingOutlined style={{ color: '#666' }} />
                </div>
              ) : (
                <div
                  onClick={handleSend}
                  style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: input.trim() ? colors.primary : '#d9d9d9',
                    border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: input.trim() ? 'pointer' : 'not-allowed',
                    flexShrink: 0,
                    transition: 'background 0.2s',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#fff' : '#999'} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13" />
                    <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Switch command menu */}
          {switchMenuOpen && menuPosition && createPortal(
            <div ref={menuRef} style={{
              position: "fixed", top: menuPosition.top, left: Math.max(8, menuPosition.left),
              width: 240, background: "#fff", borderRadius: 8,
              boxShadow: "0 6px 16px rgba(0, 0, 0, 0.12), 0 3px 6px rgba(0, 0, 0, 0.08)",
              border: "1px solid #f0f0f0", zIndex: 10002, padding: 4,
              animation: "fadeIn 0.15s ease-out",
            }}>
              <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
              
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", borderRadius: 6, background: !selectedCommand ? `${colors.primary}10` : "transparent", transition: "background 0.15s" }}
                onClick={() => handleSelectCommand(null)}
                onMouseEnter={(e) => { if (selectedCommand) (e.currentTarget as HTMLDivElement).style.background = "#f5f5f5"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = !selectedCommand ? `${colors.primary}10` : "transparent"; }}
              >
                <RobotOutlined style={{ color: colors.primary }} />
                <div>
                  <div style={{ fontWeight: 500 }}>默认助手</div>
                  <div style={{ fontSize: 11, color: "#999" }}>通用学习助手</div>
                </div>
              </div>

              {aiCommands.length > 0 && (
                <>
                  <div style={{ height: 1, background: "#f0f0f0", margin: "4px 0" }} />
                  {aiCommands.map((cmd) => (
                    <div key={cmd.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", cursor: "pointer", borderRadius: 6, background: selectedCommand?.id === cmd.id ? `${colors.primary}10` : "transparent", transition: "background 0.15s" }}
                      onClick={() => handleSelectCommand(cmd)}
                      onMouseEnter={(e) => { if (selectedCommand?.id !== cmd.id) (e.currentTarget as HTMLDivElement).style.background = "#f5f5f5"; }}
                      onMouseLeave={(e) => { if (selectedCommand?.id !== cmd.id) (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <Tag color="blue" style={{ margin: 0 }}>{cmd.title || "未命名"}</Tag>
                    </div>
                  ))}
                </>
              )}
            </div>,
            document.body
          )}
        </>,
        document.body
      )}
    </>
  );
}
