/**
 * AI 智能体助手
 * 左侧：会话列表（可重命名 / 删除，重命名为 inplace 编辑）。
 * 右侧：对话；提问框左侧可切换「AI 命令」，基于该命令的提示词进行问答。
 * 对话由 assistant-ui（AG-UI）驱动真实后端。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Select, message, Input, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, CloseOutlined } from "@ant-design/icons";
import AssistantChat from "@/components/assistant-ui/AssistantChat";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { AppPage, PageHead } from "@/components/proto";
import {
  listCommands,
  createConversation as rpcCreateConversation,
  listConversations as rpcListConversations,
  deleteConversation as rpcDeleteConversation,
} from "@/lib/ash_rpc";
import { updateConversation } from "@/lib/ai-conversation";
import "./ai-assistant.css";

function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface AICommand {
  id: string;
  title: string | null;
  user: string | null;
  system: string | null;
  assistant: string | null;
}

interface Conversation {
  id: string;
  title: string;
  threadId: string | null;
  aiCommandId?: string | null;
}

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [aiCommands, setAiCommands] = useState<AICommand[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [commandId, setCommandId] = useState<string | undefined>(undefined);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const currentConversationIdRef = useRef<string | null>(null);

  const headers = user ? (getAuthHeaders(user) as Record<string, string>) : {};

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
    loadAiCommands();
  }, [user]);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      const result = await rpcListConversations({
        input: { createdById: user.id },
        fields: ["id", "title", "threadId", "aiCommandId"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success && result.data) {
        const data = result.data as any;
        const convs: Conversation[] = (data.results || data || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          threadId: c.threadId || null,
          aiCommandId: c.aiCommandId || null,
        }));
        setConversations(convs);
        const lastConversationId = localStorage.getItem("ai_assistant_current_conversation");
        if (lastConversationId) {
          const lastConv = convs.find((c) => c.id === lastConversationId);
          if (lastConv) {
            setCurrentConversationId(lastConv.id);
            currentConversationIdRef.current = lastConv.id;
            setThreadId(lastConv.threadId);
            setCommandId(lastConv.aiCommandId || undefined);
          } else {
            localStorage.removeItem("ai_assistant_current_conversation");
          }
        }
      }
    } catch (error) {
      console.error("加载会话列表失败:", error);
    }
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem("ai_assistant_current_conversation", currentConversationId);
    }
  }, [currentConversationId]);

  const createConversation = useCallback(async () => {
    if (!user) return;
    const newThreadId = generateUUID();
    const title = `会话 ${conversations.length + 1}`;
    try {
      const result = await rpcCreateConversation({
        input: {
          title,
          threadId: newThreadId,
          createdById: user.id,
        },
        fields: ["id", "title", "threadId", "aiCommandId"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success && result.data) {
        const data = result.data as any;
        const newConv: Conversation = {
          id: data.id,
          title: data.title,
          threadId: data.threadId || null,
          aiCommandId: data.aiCommandId || null,
        };
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConversationId(data.id);
        currentConversationIdRef.current = data.id;
        setThreadId(newThreadId);
        setCommandId(undefined);
      } else {
        message.error("创建会话失败");
      }
    } catch (error) {
      console.error("创建会话失败:", error);
      message.error("创建会话失败");
    }
  }, [user, conversations.length]);

  const switchConversation = useCallback(
    (convId: string) => {
      const conv = conversations.find((c) => c.id === convId);
      if (conv) {
        setCurrentConversationId(convId);
        currentConversationIdRef.current = convId;
        setThreadId(conv.threadId);
        setCommandId(conv.aiCommandId || undefined);
      }
    },
    [conversations],
  );

  // 提问框左侧切换 AI 命令（并持久化到当前会话）
  const handleCommandChange = useCallback(
    async (id?: string) => {
      setCommandId(id);
      if (!currentConversationId) return;
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId ? { ...c, aiCommandId: id || null } : c,
        ),
      );
      await updateConversation({
        primaryKey: currentConversationId,
        input: { aiCommandId: id || null },
        headers,
      });
    },
    [currentConversationId, headers],
  );

  const startRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setDraftTitle(conv.title);
  };

  const saveRename = async (conv: Conversation) => {
    setEditingId(null);
    const title = draftTitle.trim();
    if (!title || title === conv.title) return;
    setConversations((prev) => prev.map((c) => (c.id === conv.id ? { ...c, title } : c)));
    const res = await updateConversation({ primaryKey: conv.id, input: { title }, headers });
    if (!res.success) {
      message.error("重命名失败");
      loadConversations();
    }
  };

  const removeConversation = async (conv: Conversation) => {
    const res = await rpcDeleteConversation({ primaryKey: conv.id, headers });
    if (res.success) {
      message.success("会话已删除");
      setConversations((prev) => prev.filter((c) => c.id !== conv.id));
      if (currentConversationId === conv.id) {
        setCurrentConversationId(null);
        setThreadId(null);
        setCommandId(undefined);
        localStorage.removeItem("ai_assistant_current_conversation");
      }
    } else {
      message.error("删除失败");
    }
  };

  const activeCommand = aiCommands.find((c) => c.id === commandId) || null;

  return (
    <AppPage
      fill
      className="ai-assistant-page"
      style={{ padding: 0 }}
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;AI智能体助手</>}
    >
      <div className="ai-assistant-inner">
        <PageHead
          title="AI 智能体助手"
          description="围绕课程内容，辅助备课、答疑与知识梳理。"
          actions={
            <Button type="primary" onClick={() => createConversation()}>
              <PlusOutlined /> 新建会话
            </Button>
          }
        />

        <div className="ai-split">
          <aside className="ai-card ai-tree">
            <h3>会话</h3>
            <div className="ai-tree__list ai-conv-list">
              {conversations.length === 0 ? (
                <div className="ai-note" style={{ margin: 0 }}>
                  暂无会话，点击右上角「新建会话」开始。
                </div>
              ) : (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={`ai-conv${conv.id === currentConversationId ? " is-active" : ""}`}
                    title={conv.title}
                    onClick={() => {
                      if (editingId !== conv.id) switchConversation(conv.id);
                    }}
                  >
                    {editingId === conv.id ? (
                      <Input
                        size="small"
                        autoFocus
                        value={draftTitle}
                        maxLength={100}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onPressEnter={() => saveRename(conv)}
                        onBlur={() => saveRename(conv)}
                      />
                    ) : (
                      <>
                        <span className="ai-conv__title">{conv.title}</span>
                        <span className="ai-conv__actions">
                          <EditOutlined
                            className="ai-conv__btn"
                            title="重命名"
                            onClick={(e) => {
                              e.stopPropagation();
                              startRename(conv);
                            }}
                          />
                          <Popconfirm
                            title="删除该会话？"
                            okText="删除"
                            cancelText="取消"
                            okButtonProps={{ danger: true }}
                            onConfirm={() => removeConversation(conv)}
                          >
                            <CloseOutlined
                              className="ai-conv__btn ai-conv__btn--danger"
                              title="删除"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </Popconfirm>
                        </span>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>

          <section className="ai-card ai-chat">
            <div className="ai-chat__header">
              <span className="ai-avatar">AI</span>
              <div>
                <h3>易课程智能助手</h3>
                <small>{activeCommand?.title || "通用课程教学助手"}</small>
              </div>
            </div>

            <div className="ai-chat__body">
              {currentConversationId ? (
                <AssistantChat
                  key={currentConversationId}
                  threadId={threadId}
                  conversationId={currentConversationId}
                  aiCommand={activeCommand}
                  leadingControl={
                    <Select
                      style={{ width: 160 }}
                      allowClear
                      placeholder="通用助手"
                      value={commandId || undefined}
                      onChange={(v) => handleCommandChange(v)}
                      options={aiCommands.map((c) => ({
                        value: c.id,
                        label: c.title || "未命名命令",
                      }))}
                    />
                  }
                />
              ) : (
                <div className="ai-chat__empty">
                  <div>
                    <span className="ai-avatar ai-avatar--lg">AI</span>
                    <p>点击右上角「新建会话」，开始与智能助手交流。</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppPage>
  );
}
