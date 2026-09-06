/**
 * AI 智能体助手页面
 * 左侧：会话列表 + 右侧：assistant-ui 聊天
 * 已从 CopilotKit/CopilotChat 迁移到 assistant-ui + AG-UI
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card, theme, Modal, Input, Spin, Empty, List, Tag, message, Button, Tooltip, Dropdown, Drawer } from "antd";
import { BookOutlined, FileTextOutlined, FormOutlined, AuditOutlined, ExperimentOutlined, PlusOutlined, DeleteOutlined, RobotOutlined, InfoCircleOutlined, DownOutlined, ArrowLeftOutlined, MenuOutlined } from "@ant-design/icons";
import KnowledgeResourcePanel from "@/components/KnowledgeResourcePanel";
import AssistantChat from "@/components/assistant-ui/AssistantChat";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listCommands, createConversation as rpcCreateConversation, listConversations as rpcListConversations, deleteConversation as rpcDeleteConversation } from "@/lib/ash_rpc";

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

interface KnowledgeResource {
  id: string;
  name: string;
  knowledgeType: string;
  description?: string | null;
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
  userId: string;
  userName?: string;
  aiCommandId?: string | null;
}

const features = [
  {
    icon: <BookOutlined style={{ fontSize: 24, color: "#1890ff" }} />,
    title: "课程管理",
    description: "创建、编辑和管理课程内容，支持章节、知识点组织",
  },
  {
    icon: <FormOutlined style={{ fontSize: 24, color: "#52c41a" }} />,
    title: "练习题生成",
    description: "根据课程内容自动生成多种题型的练习题",
  },
  {
    icon: <FileTextOutlined style={{ fontSize: 24, color: "#faad14" }} />,
    title: "试卷生成",
    description: "智能组卷，支持自定义题型、难度和知识点覆盖",
  },
  {
    icon: <AuditOutlined style={{ fontSize: 24, color: "#f5222d" }} />,
    title: "作业批改",
    description: "自动批改学生作业，提供详细的错误分析",
  },
  {
    icon: <ExperimentOutlined style={{ fontSize: 24, color: "#722ed1" }} />,
    title: "知识问答",
    description: "解答教学相关问题，提供知识点讲解和分析",
  },
];

export default function AIAssistantPage() {
  const navigate = useNavigate();
  const { token } = useToken();
  const { user } = useAuth();
  const [learningModalOpen, setLearningModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [resourceDrawerOpen, setResourceDrawerOpen] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeResource | null>(null);
  const [knowledgeList, setKnowledgeList] = useState<KnowledgeResource[]>([]);
  const [knowledgeLoading, setKnowledgeLoading] = useState(false);

  const [aiCommands, setAiCommands] = useState<AICommand[]>([]);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const currentConversationIdRef = useRef<string | null>(null);

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

  // 从后端加载当前用户的会话列表
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
        const convs = (data.results || data || []).map((c: any) => ({
          id: c.id,
          title: c.title,
          threadId: c.threadId || null,
          aiCommand: null,
          aiCommandId: c.aiCommandId || null,
          createdAt: new Date(), // 使用当前时间，排序由后端按 inserted_at 倒序处理
          userId: user.id,
          userName: user.displayName,
        }));
        setConversations(convs);
        // 恢复上次活跃会话
        const lastConversationId = localStorage.getItem("ai_assistant_current_conversation");
        if (lastConversationId) {
          const lastConv = convs.find((c: Conversation) => c.id === lastConversationId);
          if (lastConv) {
            setCurrentConversationId(lastConv.id);
            currentConversationIdRef.current = lastConv.id;
            setThreadId(lastConv.threadId);
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

  // 保存当前会话 ID 到 localStorage（仅 UI 偏好，不做数据持久化）
  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem("ai_assistant_current_conversation", currentConversationId);
    }
  }, [currentConversationId]);

  // 先加载 AI Commands，再异步从后端加载 AI Command 详情填充会话
  useEffect(() => {
    if (conversations.length > 0 && aiCommands.length > 0) {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.aiCommandId) {
            const cmd = aiCommands.find((c) => c.id === conv.aiCommandId);
            return cmd ? { ...conv, aiCommand: cmd } : conv;
          }
          return conv;
        })
      );
    }
  }, [aiCommands, conversations.length > 0]);

  const createConversation = async (command?: AICommand | null) => {
    if (!user) return;
    const newThreadId = generateUUID();
    const title = command?.title ? `${command.title}` : `会话 ${conversations.length + 1}`;
    try {
      const result = await rpcCreateConversation({
        input: {
          title,
          threadId: newThreadId,
          aiCommandId: command?.id || undefined,
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
          aiCommand: command || null,
          aiCommandId: data.aiCommandId || null,
          createdAt: new Date(),
          userId: user.id,
          userName: user.displayName,
        };
        setConversations((prev) => [newConv, ...prev]);
        setCurrentConversationId(data.id);
        currentConversationIdRef.current = data.id;
        setThreadId(newThreadId);
      } else {
        message.error("创建会话失败");
      }
    } catch (error) {
      console.error("创建会话失败:", error);
      message.error("创建会话失败");
    }
  };

  const switchConversation = useCallback((convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      setCurrentConversationId(convId);
      currentConversationIdRef.current = convId;
      setThreadId(conv.threadId);
    }
  }, [conversations]);

  const deleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    try {
      const result = await rpcDeleteConversation({
        primaryKey: convId,
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) {
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
            localStorage.removeItem("ai_assistant_current_conversation");
          }
        }
      } else {
        message.error("删除会话失败");
      }
    } catch (error) {
      console.error("删除会话失败:", error);
      message.error("删除会话失败");
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

  const handleStartLearning = () => {
    setLearningModalOpen(true);
    loadKnowledgeList();
  };

  const handleKnowledgeSelect = (knowledge: KnowledgeResource) => {
    setSelectedKnowledge(knowledge);
    setLearningModalOpen(false);
    setResourceDrawerOpen(true);
  };

  const handleSearch = (value: string) => {
    loadKnowledgeList(value);
  };

  const getKnowledgeTypeTag = (type: string) => {
    const typeMap: Record<string, { color: string; text: string }> = {
      subject: { color: "blue", text: "学科" },
      knowledge_unit: { color: "green", text: "知识单元" },
      knowledge_cell: { color: "orange", text: "知识点" },
    };
    const config = typeMap[type] || { color: "default", text: type };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  return (
    <div className="ai-assistant-wrap" style={{ display: "flex", height: "calc(100vh - 64px)", width: "100%" }}>
      <style>{`@media(max-width:768px){.ai-assistant-wrap{height:calc(100vh-56px)!important}.ai-assistant-sidebar{display:none!important}.ai-assistant-chat-header{display:flex!important}}@media(min-width:769px){.ai-assistant-chat-header{display:none!important}}`}</style>
      {/* 移动端 Drawer 会话列表 */}
      <Drawer
        title="会话列表"
        placement="left"
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={280}
        styles={{ body: { padding: 0 } }}
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
                        <div style={{ fontSize: 11, color: "#999" }}>通用课程教学助手</div>
                      </div>
                    </div>
                  ),
                  onClick: () => { createConversation(null); setSidebarOpen(false); },
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
                    onClick: () => { createConversation(cmd); setSidebarOpen(false); },
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
                  onClick={() => { switchConversation(conv.id); setSidebarOpen(false); }}
                  style={{ padding: "12px", marginBottom: 4, borderRadius: 8, cursor: "pointer", backgroundColor: conv.id === currentConversationId ? "#e6f7ff" : "transparent", border: conv.id === currentConversationId ? "2px solid #1890ff" : "1px solid transparent" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{conv.title}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 4 }}>
                        {conv.aiCommand && <Tag color="blue" style={{ margin: 0, padding: "0 4px", fontSize: 10 }}>{conv.aiCommand.title}</Tag>}
                      </div>
                    </div>
                    <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id, e); }} />
                  </div>
                </List.Item>
              )}
            />
          )}
        </div>
      </Drawer>

      {/* 桌面端：会话列表 */}
      <div
        className="ai-assistant-sidebar"
        style={{
          width: 240,
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
                        <div style={{ fontSize: 11, color: "#999" }}>通用课程教学助手</div>
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
                        {conv.aiCommand && (
                          <Tag color="blue" style={{ margin: 0, padding: "0 4px", fontSize: 10 }}>{conv.aiCommand.title}</Tag>
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

      {/* 右侧：assistant-ui 聊天 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
        {/* 移动端头部 */}
        <div className="ai-assistant-chat-header" style={{ padding: "8px 12px", borderBottom: `1px solid ${token.colorBorder}`, background: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
          <Button type="text" icon={<MenuOutlined />} onClick={() => setSidebarOpen(true)} style={{ color: "#333" }} />
          <div style={{ flex: 1, fontWeight: 600, fontSize: 15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {conversations.find(c => c.id === currentConversationId)?.title || "AI 智能体助手"}
          </div>
        </div>
        {currentConversationId ? (
          <AssistantChat
            threadId={threadId}
            conversationId={currentConversationId}
            aiCommand={conversations.find(c => c.id === currentConversationId)?.aiCommand || null}
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

      {/* 选择知识点弹窗 */}
      <Modal
        title="选择知识点"
        open={learningModalOpen}
        onCancel={() => setLearningModalOpen(false)}
        footer={null}
        width={600}
      >
        <Input.Search placeholder="搜索知识点..." allowClear onSearch={handleSearch} style={{ marginBottom: 16 }} loading={knowledgeLoading} />
        {knowledgeLoading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : knowledgeList.length === 0 ? (
          <Empty description="暂无知识点，请尝试其他关键词" />
        ) : (
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            <List
              dataSource={knowledgeList}
              renderItem={(item) => (
                <List.Item onClick={() => handleKnowledgeSelect(item)} style={{ cursor: "pointer", padding: "12px" }}>
                  <div style={{ width: "100%" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{item.name}</span>
                      {getKnowledgeTypeTag(item.knowledgeType)}
                    </div>
                    {item.description && <div style={{ fontSize: 12, color: token.colorTextSecondary }}>{item.description}</div>}
                  </div>
                </List.Item>
              )}
            />
          </div>
        )}
      </Modal>

      {/* 资源面板 */}
      <KnowledgeResourcePanel open={resourceDrawerOpen} onClose={() => setResourceDrawerOpen(false)} knowledge={selectedKnowledge} />
    </div>
  );
}
