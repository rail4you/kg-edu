import { useState, useEffect, useRef } from "react";
import {
  Button,
  Input,
  Avatar,
  Spin,
  message,
  Card,
  Select,
  Tag,
  Empty,
} from "antd";
import {
  SendOutlined,
  PaperClipOutlined,
  RobotOutlined,
  UserOutlined,
  PlusOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "highlight.js/styles/github.css";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import {
  listFiles,
  listCommands,
} from "@/lib/ash_rpc";

const { TextArea } = Input;

interface FileInfo {
  id: string;
  filename: string;
  path: string;
  size: number;
  fileType: string;
}

interface AICommand {
  id: string;
  title: string | null;
  user: string | null;
  system: string | null;
  assistant: string | null;
}

interface Message {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  files?: FileInfo[];
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  threadId: string | null;
  aiCommand?: AICommand;
  createdAt: Date;
}

// 构建文件URL
const buildFileUrl = (file: FileInfo): string => {
  try {
    const filePath = file.path;
    if (!filePath) return file.filename || "";

    if (filePath.startsWith("http://") || filePath.startsWith("https://")) {
      return filePath;
    }

    if (filePath.includes("/uploads/")) {
      return `https://kg-edu.oss-cn-beijing.aliyuncs.com${filePath}`;
    } else if (filePath.startsWith("/")) {
      return `https://kg-edu.oss-cn-beijing.aliyuncs.com${filePath}`;
    } else {
      return `https://kg-edu.oss-cn-beijing.aliyuncs.com/uploads/${filePath}`;
    }
  } catch {
    return file.path || file.filename || "";
  }
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// 格式化文件类型
const getSimpleFileType = (mimeType: string, filename: string): string => {
  if (mimeType.includes("pdf")) return "pdf";
  if (mimeType.includes("word")) return "docx";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "xlsx";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "pptx";
  if (mimeType.includes("text/plain")) return "txt";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("png")) return "png";

  const ext = filename.split(".").pop()?.toLowerCase();
  return ext || "unknown";
};

export default function AIAgentChat() {
  const { user, tenant } = useAuth();
  const { canEdit } = useEditPermission();

  // 状态
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [files, setFiles] = useState<FileInfo[]>([]);
  const [aiCommands, setAiCommands] = useState<AICommand[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [selectedCommand, setSelectedCommand] = useState<AICommand | null>(null);
  const [newConversationOpen, setNewConversationOpen] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 加载数据和初始化对话
  useEffect(() => {
    const loadData = async () => {
      if (!tenant || !user) return;

      try {
        // 加载文件
        const filesResult = await listFiles({
          tenant: tenant,
          fields: ["id", "filename", "path", "size", "fileType"],
          filter: { createdById: { eq: user.id } },
          page: { limit: 100, offset: 0 },
          headers: getAuthHeaders(user) as Record<string, string>,
        });

        if (filesResult.success && filesResult.data) {
          const data = filesResult.data as unknown as FileInfo[];
          setFiles(Array.isArray(data) ? data : []);
        }

        // 加载AI命令
        const commandsResult = await listCommands({
          fields: ["id", "title", "user", "system", "assistant"],
          headers: getAuthHeaders(user) as Record<string, string>,
        });

        if (commandsResult.success && commandsResult.data) {
          const data = commandsResult.data as unknown as AICommand[];
          setAiCommands(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("加载数据失败:", error);
      }
    };

    loadData();
  }, [tenant, user]);

  // 从localStorage加载会话
  useEffect(() => {
    const stored = localStorage.getItem("pi_agent_conversations");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const convs = parsed.map((c: any) => ({
          ...c,
          createdAt: new Date(c.createdAt),
          messages: c.messages.map((m: any) => ({
            ...m,
            timestamp: new Date(m.timestamp),
          })),
        }));
        setConversations(convs);

        if (convs.length > 0) {
          setCurrentConversationId(convs[0].id);
          setMessages(convs[0].messages);
        }
      } catch (e) {
        console.error("加载会话失败:", e);
      }
    }
  }, []);

  // 保存会话到localStorage
  useEffect(() => {
    if (conversations.length > 0) {
      localStorage.setItem("pi_agent_conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 获取当前会话
  const getCurrentConversation = () => {
    return conversations.find((c) => c.id === currentConversationId);
  };

  // 创建新会话
  const createConversation = (command?: AICommand) => {
    const newId = `conv-${Date.now()}`;
    const title = command?.title || `对话 ${conversations.length + 1}`;

    const newConv: Conversation = {
      id: newId,
      title,
      messages: [],
      threadId: null,
      aiCommand: command || null,
      createdAt: new Date(),
    };

    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversationId(newId);
    setMessages([]);
    setSelectedCommand(command || null);
    setNewConversationOpen(false);

    return newConv;
  };

  // 发送消息到后端
  const sendMessage = async (userMessage: string, attachedFiles: FileInfo[]) => {
    const conversation = getCurrentConversation();
    if (!conversation) {
      message.error("请先创建会话");
      return;
    }

    // 添加用户消息
    const userMsg: Message = {
      id: `msg-${Date.now()}`,
      content: userMessage,
      role: "user",
      timestamp: new Date(),
      files: attachedFiles,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSelectedFiles([]);
    setIsLoading(true);

    // 更新会话中的消息
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversationId
          ? { ...c, messages: [...c.messages, userMsg] }
          : c
      )
    );

    // 添加空的AI回复
    const aiMsgId = `msg-${Date.now()}-ai`;
    const aiMsg: Message = {
      id: aiMsgId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);

    try {
      // Pi Agent Server 请求
      const requestBody: any = {
        message: userMessage,
        orgSchema: tenant,
        userId: user?.id,
        threadId: conversation.threadId || undefined,
      };

      // 添加AI命令参数
      if (conversation.aiCommand) {
        const cmd = conversation.aiCommand;
        if (cmd.system) {
          requestBody.systemPrompt = cmd.system;
          if (cmd.user) {
            requestBody.systemPrompt += ` ${cmd.user}`;
          }
        } else if (cmd.user) {
          requestBody.systemPrompt = cmd.user;
        }
      }

      // Pi Agent Server (port 5050) via vite proxy
      const response = await fetch("/agent/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (!response.body) {
        throw new Error("Response body is null");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";
      let receivedThreadId: string | null = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
            continue;
          }

          if (line.startsWith("data: ")) {
            currentData = line.slice(6).trimEnd();
            continue;
          }

          if (line === "" && currentEvent) {
            if (currentEvent === "message") {
              try {
                const parsed = JSON.parse(currentData);
                if (parsed.text) {
                  assistantMessage += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgId ? { ...m, content: assistantMessage } : m
                    )
                  );
                }
              } catch {
                assistantMessage += currentData;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, content: assistantMessage } : m
                  )
                );
              }
            } else if (currentEvent === "thread_id") {
              receivedThreadId = currentData.trim();
            }

            currentEvent = "";
            currentData = "";
          }
        }
      }

      // 更新最终消息
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: assistantMessage } : m
        )
      );

      // 更新会话的threadId
      if (receivedThreadId) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? { ...c, threadId: receivedThreadId, messages: [...c.messages, { ...aiMsg, content: assistantMessage }] }
              : c
          )
        );
      }

    } catch (error) {
      console.error("发送消息失败:", error);
      const errorMsg: Message = {
        id: `msg-${Date.now()}-error`,
        content: `抱歉，发生了错误: ${error instanceof Error ? error.message : "未知错误"}`,
        role: "assistant",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMsg]);
      message.error("发送消息失败");
    } finally {
      setIsLoading(false);
    }
  };

  // 处理发送
  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    if (!currentConversationId) {
      createConversation();
    }
    sendMessage(input, selectedFiles);
  };

  // 处理键盘事件
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // 切换会话
  const switchConversation = (convId: string) => {
    const conv = conversations.find((c) => c.id === convId);
    if (conv) {
      setCurrentConversationId(convId);
      setMessages(conv.messages);
      setSelectedCommand(conv.aiCommand || null);
    }
  };

  // 删除会话
  const deleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newConvs = conversations.filter((c) => c.id !== convId);
    setConversations(newConvs);

    if (convId === currentConversationId) {
      if (newConvs.length > 0) {
        switchConversation(newConvs[0].id);
      } else {
        setCurrentConversationId(null);
        setMessages([]);
      }
    }

    if (newConvs.length === 0) {
      localStorage.removeItem("pi_agent_conversations");
    }
  };

  // 选择文件切换
  const toggleFileSelection = (file: FileInfo) => {
    setSelectedFiles((prev) => {
      const exists = prev.find((f) => f.id === file.id);
      if (exists) {
        return prev.filter((f) => f.id !== file.id);
      }
      return [...prev, file];
    });
  };

  // Mermaid 渲染组件
  const Mermaid = ({ chart }: { chart: string }) => (
    <div
      style={{
        padding: 16,
        backgroundColor: "#f9fafb",
        borderRadius: 8,
        overflow: "auto",
      }}
    >
      <pre style={{ margin: 0, fontSize: 12 }}>{chart}</pre>
    </div>
  );

  return (
    <div
      style={{
        display: "flex",
        height: "calc(100vh - 100px)",
        backgroundColor: "#ffffff",
      }}
    >
      {/* 左侧会话列表 */}
      <div
        style={{
          width: 280,
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#f9fafb",
        }}
      >
        {/* 新建会话按钮 */}
        <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={() => setNewConversationOpen(true)}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderColor: "transparent",
              ...(canEdit ? {} : { display: "none" }),
            }}
          >
            新建会话
          </Button>
        </div>

        {/* 会话列表 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {conversations.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无会话"
              style={{ marginTop: 40 }}
            />
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => switchConversation(conv.id)}
                style={{
                  padding: "12px",
                  marginBottom: 4,
                  borderRadius: 8,
                  cursor: "pointer",
                  backgroundColor:
                    conv.id === currentConversationId ? "#e0e7ff" : "transparent",
                  border:
                    conv.id === currentConversationId
                      ? "1px solid #667eea"
                      : "1px solid transparent",
                  transition: "all 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 14,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.title}
                    </div>
                  </div>
                  <ReadonlyActionButton
                    type="text"
                    size="small"
                    danger
                    onClick={(e) => deleteConversation(conv.id, e)}
                  >
                    ×
                  </ReadonlyActionButton>
                </div>
              </div>
            ))
          )}
        </div>

        {/* 文件和命令面板 */}
        <div style={{ borderTop: "1px solid #e5e7eb", padding: 12 }}>
          <div style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
              <FileTextOutlined /> 已加载 {files.length} 个文件
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>
              <RobotOutlined /> 已加载 {aiCommands.length} 个AI命令
            </div>
          </div>
        </div>
      </div>

      {/* 右侧聊天区域 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* 聊天消息 */}
        <div
          ref={messagesContainerRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
          }}
        >
          {messages.length === 0 ? (
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
              }}
            >
              <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>开始与AI智能体对话</div>
              <div style={{ fontSize: 12, marginTop: 8 }}>
                选择AI命令或直接开始对话
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                  marginBottom: 16,
                }}
              >
                {msg.role === "assistant" && (
                  <Avatar
                    style={{
                      backgroundColor: "#667eea",
                      marginRight: 8,
                    }}
                    icon={<RobotOutlined />}
                  />
                )}
                <div
                  style={{
                    maxWidth: "70%",
                    padding: "12px 16px",
                    borderRadius: 12,
                    backgroundColor: msg.role === "user" ? "#667eea" : "#f3f4f6",
                    color: msg.role === "user" ? "#fff" : "#374151",
                  }}
                >
                  {msg.role === "user" ? (
                    <div>
                      <div>{msg.content}</div>
                      {msg.files && msg.files.length > 0 && (
                        <div style={{ marginTop: 8 }}>
                          <Tag color="blue">
                            {msg.files.length} 个附件
                          </Tag>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                      {msg.content ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code: ({ className, children }) => {
                              if (className === "language-mermaid") {
                                const chart = String(children).replace(/\n$/, "");
                                return <Mermaid chart={chart} />;
                              }
                              return (
                                <code className={className}>{children}</code>
                              );
                            },
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Spin size="small" />
                          <span>AI正在思考...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {msg.role === "user" && (
                  <Avatar
                    style={{
                      backgroundColor: "#10b981",
                      marginLeft: 8,
                    }}
                    icon={<UserOutlined />}
                  />
                )}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 输入区域 */}
        <div
          style={{
            padding: 16,
            borderTop: "1px solid #e5e7eb",
            backgroundColor: "#fff",
          }}
        >
          {/* 已选文件 */}
          {selectedFiles.length > 0 && (
            <div
              style={{
                marginBottom: 8,
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              {selectedFiles.map((file) => (
                <Tag
                  key={file.id}
                  closable
                  onClose={() => toggleFileSelection(file)}
                  color="blue"
                >
                  {file.filename} ({formatFileSize(file.size)})
                </Tag>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
            }}
          >
            {/* 文件选择 */}
            <Select
              mode="multiple"
              placeholder="选择附件文件"
              value={selectedFiles.map((f) => f.id)}
              onChange={(values) => {
                setSelectedFiles(files.filter((f) => values.includes(f.id)));
              }}
              style={{ minWidth: 200 }}
              options={files.map((f) => ({
                value: f.id,
                label: `${f.filename} (${formatFileSize(f.size)})`,
              }))}
              allowClear
            />

            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入您的问题... (Enter 发送, Shift+Enter 换行)"
              autoSize={{ minRows: 1, maxRows: 4 }}
              style={{ flex: 1, borderRadius: 8 }}
            />

            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={isLoading}
              style={{
                background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderColor: "transparent",
                ...(canEdit ? {} : { display: "none" }),
              }}
            >
              发送
            </Button>
          </div>
        </div>
      </div>

      {/* 新建会话弹窗 */}
      <Card
        title="选择对话模式"
        open={newConversationOpen}
        onCancel={() => setNewConversationOpen(false)}
        footer={null}
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            block
            onClick={() => createConversation()}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderColor: "transparent",
              height: 48,
            }}
          >
            <RobotOutlined /> 普通对话
          </Button>
        </div>

        <div style={{ marginBottom: 8, fontWeight: 500 }}>
          或选择AI命令模板
        </div>

        {aiCommands.length === 0 ? (
          <div style={{ textAlign: "center", padding: 20, color: "#9ca3af" }}>
            暂无AI命令，请在AI命令中心创建
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
              maxHeight: 300,
              overflowY: "auto",
            }}
          >
            {aiCommands.map((cmd) => (
              <Card
                key={cmd.id}
                size="small"
                hoverable
                onClick={() => createConversation(cmd)}
                style={{ cursor: "pointer" }}
              >
                <div style={{ fontWeight: 500 }}>{cmd.title || "未命名"}</div>
                {cmd.user && (
                  <div
                    style={{
                      fontSize: 12,
                      color: "#9ca3af",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cmd.user}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
