/**
 * AI 智能体助手页面 - 学生端
 * 左侧：会话列表 + 右侧：AssistantChat（Pi Agent 直接流式）
 * 已从 CopilotKit 迁移到 Pi Agent
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { theme, Empty, List, Tag, message, Button, Tooltip, Dropdown, Modal, Input, Spin } from "antd";
import { PlusOutlined, DeleteOutlined, RobotOutlined, InfoCircleOutlined, DownOutlined, BookOutlined, BulbOutlined, ThunderboltOutlined, CodeOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listCommands } from "@/lib/ash_rpc";
import AssistantChat from "@/components/assistant-ui/AssistantChat";

const { useToken } = theme;

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
  aiCommand: AICommand | null;
  createdAt: Date;
}

interface KnowledgeResource {
  id: string;
  name: string;
  knowledgeType: string;
  description?: string | null;
}

export default function StudentAIChat() {
  const { token } = useToken();
  const { user } = useAuth();
  const [aiCommands, setAiCommands] = useState<AICommand[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const [learningModalOpen, setLearningModalOpen] = useState(false);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeResource[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  // Load AI commands
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

  // Restore from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("student_ai_assistant_conversations");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const convs = parsed.map((c: any) => ({
          ...c,
          threadId: c.threadId || null,
          createdAt: new Date(c.createdAt),
        }));
        setConversations(convs);
        const lastConversationId = localStorage.getItem("student_ai_assistant_current_conversation");
        if (lastConversationId) {
          const lastConv = convs.find((c: Conversation) => c.id === lastConversationId);
          if (lastConv) {
            setCurrentConversationId(lastConv.id);
            currentConversationIdRef.current = lastConv.id;
            setThreadId(lastConv.threadId);
          }
        }
      } catch (e) {
        console.error("加载会话失败:", e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("student_ai_assistant_conversations", JSON.stringify(conversations));
    }
    if (currentConversationId) {
      localStorage.setItem("student_ai_assistant_current_conversation", currentConversationId);
    }
  }, [conversations, currentConversationId]);

  const createConversation = (command?: AICommand | null) => {
    const newId = `conv-${Date.now()}`;
    const newThreadId = generateUUID();
    const title = command?.title ? `${command.title}` : `会话 ${conversations.length + 1}`;
    const newConv: Conversation = {
      id: newId,
      title,
      threadId: newThreadId,
      aiCommand: command || null,
      createdAt: new Date(),
    };
    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversationId(newId);
    currentConversationIdRef.current = newId;
    setThreadId(newThreadId);
  };

  const switchConversation = useCallback((convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      setCurrentConversationId(convId);
      currentConversationIdRef.current = convId;
      setThreadId(conv.threadId);
    }
  }, [conversations]);

  const deleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newConvs = conversations.filter((c) => c.id !== convId);
    setConversations(newConvs);
    if (convId === currentConversationId) {
      if (newConvs.length > 0) {
        const nextConv = newConvs[0];
        setCurrentConversationId(nextConv.id);
        currentConversationIdRef.current = nextConv.id;
        setThreadId(nextConv.threadId);
      } else {
        setCurrentConversationId(null);
        currentConversationIdRef.current = null;
        setThreadId(null);
        localStorage.removeItem("student_ai_assistant_conversations");
        localStorage.removeItem("student_ai_assistant_current_conversation");
      }
    }
  };

  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || currentTenant?.id || "";

  const loadKnowledgeList = async (keyword: string = "") => {
    if (!user || !tenant) return;
    setKnowledgeLoading(true);
    try {
      const response = await fetch(`/api/knowledge-resources?query=${encodeURIComponent(keyword)}&limit=50`, {
        headers: {
          ...getAuthHeaders(user),
        },
      });
      if (!response.ok) {
        throw new Error("Failed to fetch knowledge resources");
      }
      const data = await response.json();
      setKnowledgeList(data.results || data.data || []);
    } catch (error) {
      console.error("加载知识点列表失败:", error);
      message.error("加载知识点列表失败");
      setKnowledgeList([]);
    } finally {
      setKnowledgeLoading(false);
    }
  };

  const handleSearch = (value: string) => {
    loadKnowledgeList(value);
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 100px)", width: "100%" }}>
      {/* 左侧：会话列表 */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: `1px solid ${token.colorBorder}`,
          backgroundColor: "#fafafa",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ padding: 12, borderBottom: `1px solid ${token.colorBorder}`, display: "flex", alignItems: "center", gap: 8 }}>
          <Dropdown
            menu={{
              items: [
                {
                  key: "default",
                  label: (
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <RobotOutlined style={{ color: "#1890ff" }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>默认助手</div>
                        <div style={{ fontSize: 11, color: "#999" }}>通用学习助手</div>
                      </div>
                    </div>
                  ),
                  onClick: () => createConversation(null),
                },
                ...(aiCommands.length > 0 ? [
                  { type: 'divider' as const },
                  ...aiCommands.map(cmd => ({
                    key: cmd.id,
                    label: (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Tag color="blue" style={{ margin: 0 }}>{cmd.title || "未命名"}</Tag>
                      </div>
                    ),
                    onClick: () => createConversation(cmd),
                  }))
                ] : [])
              ],
            }}
            trigger={["click"]}
          >
            <Button type="primary" style={{ flex: 1 }}>
              <PlusOutlined /> 新建会话 <DownOutlined />
            </Button>
          </Dropdown>
          <Tooltip title="点击选择AI助手类型创建新会话，不同的助手有不同的专业能力">
            <InfoCircleOutlined style={{ color: "#999", fontSize: 14, cursor: "help" }} />
          </Tooltip>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {conversations.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无会话" style={{ marginTop: 40 }} />
          ) : (
            <List
              dataSource={conversations}
              renderItem={(conv: Conversation) => (
                <List.Item
                  onClick={() => switchConversation(conv.id)}
                  style={{
                    padding: "12px",
                    marginBottom: 4,
                    borderRadius: 8,
                    cursor: "pointer",
                    backgroundColor: conv.id === currentConversationId ? "#e6f7ff" : "transparent",
                    border: conv.id === currentConversationId ? "2px solid #1890ff" : "1px solid transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {conv.title}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 4 }}>
                        {conv.aiCommand ? (
                          <Tag color="blue" style={{ margin: 0, padding: "0 4px", fontSize: 10 }}>{conv.aiCommand.title}</Tag>
                        ) : (
                          <span>{conv.threadId ? "有历史消息" : "新会话"}</span>
                        )}
                      </div>
                    </div>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => deleteConversation(conv.id, e)} />
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>
      </div>

      {/* 右侧：聊天区域 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        {currentConversationId ? (
          <AssistantChat
            threadId={threadId}
            conversationId={currentConversationId}
            aiCommand={conversations.find(c => c.id === currentConversationId)?.aiCommand || null}
            hideToolCalls
          />
        ) : (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: token.colorTextSecondary, fontSize: 16 }}>
            <div style={{ textAlign: "center" }}>
              <RobotOutlined style={{ fontSize: 64, color: token.colorPrimary, marginBottom: 16 }} />
              <div>点击左侧"新建会话"开始对话</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
