import { useState, useEffect, useRef, useCallback } from "react";
import { Button, message, Empty, Card, Avatar, Input, Spin, Modal, Tabs, Upload, List, Tag, Select } from "antd";
import { PlusOutlined, RobotOutlined, DeleteOutlined, SendOutlined, UserOutlined, PaperClipOutlined, FileOutlined, CloudUploadOutlined, BookOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "highlight.js/styles/github.css";
import "katex/dist/katex.min.css";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { listCommands, listFiles, listCourses } from "@/lib/ash_rpc";
import { uploadFile } from "@/lib/oss-upload";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";

const { TextArea } = Input;

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
  isComplete?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  threadId: string | null;
  aiCommand?: AICommand | null;
  createdAt: Date;
}

// 附件文件接口
interface AttachedFile {
  id: string;
  name: string;
  url: string;
  type: "course_file" | "upload";
  size?: number;
}

// 课程文件接口
interface CourseFile {
  id: string;
  name: string;
  url: string;
  courseId?: string;
  courseName?: string;
}

// 课程接口
interface Course {
  id: string;
  title: string;
}

// Mermaid 组件
const Mermaid = ({ chart }: { chart: string }) => (
  <div style={{ padding: 16, backgroundColor: "#f9fafb", borderRadius: 8, overflow: "auto" }}>
    <pre style={{ margin: 0, fontSize: 12 }}>{chart}</pre>
  </div>
);

// 预处理 Markdown 内容，修复段落分隔问题
const preprocessMarkdown = (content: string): string => {
  if (!content) return "";

  let processed = content;

  // 1. 确保代码块完整（不处理代码块内的内容）
  const codeBlocks: string[] = [];
  processed = processed.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 2. 保护行内代码
  const inlineCodes: string[] = [];
  processed = processed.replace(/`[^`]+`/g, (match) => {
    inlineCodes.push(match);
    return `__INLINE_CODE_${inlineCodes.length - 1}__`;
  });

  // 3. 保护数学公式
  const mathBlocks: string[] = [];
  processed = processed.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    mathBlocks.push(match);
    return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
  });
  processed = processed.replace(/\$[^$]+\$/g, (match) => {
    mathBlocks.push(match);
    return `__MATH_BLOCK_${mathBlocks.length - 1}__`;
  });

  // 4. 在 "1. " "2. " "3. " 等编号前添加空行（列表项）
  processed = processed.replace(/(\S)(\n)(\d+\.\s)/g, '$1\n\n$3');

  // 5. 在 "---" 水平分隔符前后添加空行
  processed = processed.replace(/\n?---\n?/g, '\n\n---\n\n');

  // 6. 确保标题前有换行
  processed = processed.replace(/(\S)(\n)(#{1,6}\s)/g, '$1\n\n$3');

  // 7. 恢复数学公式
  mathBlocks.forEach((block, i) => {
    processed = processed.replace(`__MATH_BLOCK_${i}__`, block);
  });

  // 8. 恢复行内代码
  inlineCodes.forEach((code, i) => {
    processed = processed.replace(`__INLINE_CODE_${i}__`, code);
  });

  // 9. 恢复代码块
  codeBlocks.forEach((block, i) => {
    processed = processed.replace(`__CODE_BLOCK_${i}__`, block);
  });

  return processed;
};

export default function AgentChat() {
  const { user, tenant } = useAuth();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [aiCommands, setAiCommands] = useState<AICommand[]>([]);
  const [newConversationOpen, setNewConversationOpen] = useState(false);

  // 文件相关状态
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [fileSelectorOpen, setFileSelectorOpen] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [courseFiles, setCourseFiles] = useState<CourseFile[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<AttachedFile[]>([]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 加载 AI 命令
  useEffect(() => {
    const loadCommands = async () => {
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
    loadCommands();
  }, [user]);

  // 从localStorage加载会话
  useEffect(() => {
    const stored = localStorage.getItem("agent_chat_conversations");
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
      localStorage.setItem("agent_chat_conversations", JSON.stringify(conversations));
    }
  }, [conversations]);

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
    setNewConversationOpen(false);

    return newConv;
  };

  // 发送消息到后端
  const sendMessage = async (userMessage: string) => {
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
    };

    setMessages((prev) => [...prev, userMsg]);

    // 添加空的AI回复
    const aiMsgId = `msg-${Date.now()}-ai`;
    const aiMsg: Message = {
      id: aiMsgId,
      content: "",
      role: "assistant",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, aiMsg]);

    setIsLoading(true);
    setInput("");

    try {
      // 构建 Pi Agent Server 请求体
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

      // 添加附件文件 URL
      if (attachedFiles.length > 0) {
        requestBody.fileUrls = attachedFiles.map((f) => ({
          url: f.url,
          type: f.type,
        }));
      }

      abortControllerRef.current = new AbortController();

      // Pi Agent Server (port 5050) via vite proxy
      const response = await fetch("/agent/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: abortControllerRef.current.signal,
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
              // Pi Agent Server: data 是 JSON {"text": "..."}
              try {
                const parsed = JSON.parse(currentData);
                if (parsed.text) {
                  assistantMessage += parsed.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === aiMsgId ? { ...m, content: assistantMessage, isComplete: false } : m
                    )
                  );
                }
              } catch {
                // 非 JSON 数据，作为纯文本
                assistantMessage += currentData;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId ? { ...m, content: assistantMessage, isComplete: false } : m
                  )
                );
              }
            } else if (currentEvent === "thread_id") {
              receivedThreadId = currentData.trim();
            } else if (currentEvent === "done") {
              // 流结束
            }

            currentEvent = "";
            currentData = "";
          }
        }
      }

      // 消息接收完成后更新，标记 isComplete = true 以触发 Markdown 渲染
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId ? { ...m, content: assistantMessage, isComplete: true } : m
        )
      );

      // 更新会话的threadId和消息
      if (receivedThreadId) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? {
                  ...c,
                  threadId: receivedThreadId,
                  messages: [...c.messages, userMsg, { ...aiMsg, content: assistantMessage }],
                }
              : c
          )
        );
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === currentConversationId
              ? { ...c, messages: [...c.messages, userMsg, { ...aiMsg, content: assistantMessage }] }
              : c
          )
        );
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        // 用户取消请求
        return;
      }
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
      abortControllerRef.current = null;
    }
  };

  // 处理发送
  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    if (!currentConversationId) {
      createConversation();
    }
    sendMessage(input);
    setAttachedFiles([]); // 发送后清空附件
  };

  // 加载课程列表
  const loadCourses = useCallback(async () => {
    if (!user) return;
    setLoadingCourses(true);
    try {
      const currentTenant = getCurrentTenant();
      const tenant = currentTenant?.schemaName || "";
      const result = await listCourses({
        tenant,
        fields: ["id", "title"] as any,
        sort: "+title",
        page: { limit: 100, offset: 0 },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      const courseList = extractArrayData(result);
      setCourses(courseList);
    } catch (error) {
      console.error("加载课程列表失败:", error);
    } finally {
      setLoadingCourses(false);
    }
  }, [user]);

  // 加载课程文件列表
  const loadCourseFiles = useCallback(async (courseId: string) => {
    if (!user || !courseId) return;
    setLoadingFiles(true);
    try {
      const currentTenant = getCurrentTenant();
      const tenant = currentTenant?.schemaName || "";
      const courseFilesResult = await listFiles({
        tenant,
        fields: ["id", "filename", "path", "courseId"] as any,
        filter: { courseId: { eq: courseId } },
        page: { limit: 100, offset: 0 },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (courseFilesResult.success && courseFilesResult.data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const files = extractArrayData(courseFilesResult).map((f: any) => ({
          id: f.id,
          name: f.filename,
          url: f.path,
          courseId: f.courseId,
        }));
        setCourseFiles(files);
      }
    } catch (error) {
      console.error("加载课程文件失败:", error);
    } finally {
      setLoadingFiles(false);
    }
  }, [user]);

  // 打开文件选择器
  const openFileSelector = useCallback(() => {
    setFileSelectorOpen(true);
    setSelectedCourseId("");
    setCourseFiles([]);
    loadCourses();
  }, [loadCourses]);

  // 选择课程时加载该课程的文件
  const handleCourseChange = (courseId: string) => {
    setSelectedCourseId(courseId);
    setCourseFiles([]);
    if (courseId) {
      loadCourseFiles(courseId);
    }
  };

  // 选择课程文件
  const selectCourseFile = (file: CourseFile) => {
    const attached: AttachedFile = {
      id: file.id,
      name: file.name,
      url: file.url,
      type: "course_file",
    };
    if (!attachedFiles.find((f) => f.id === file.id)) {
      setAttachedFiles((prev) => [...prev, attached]);
    }
    setFileSelectorOpen(false);
  };

  // 移除附件
  const removeAttachedFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // 选择已上传的文件
  const selectUploadedFile = (file: AttachedFile) => {
    if (!attachedFiles.find((f) => f.id === file.id)) {
      setAttachedFiles((prev) => [...prev, file]);
    }
    setFileSelectorOpen(false);
  };

  // 移除已上传的文件
  const removeUploadedFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  // 处理文件上传
  const handleUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const result = await uploadFile(file);
      if (result && result.url) {
        const uploaded: AttachedFile = {
          id: `upload-${Date.now()}`,
          name: result.originalName || result.name || file.name,
          url: result.url,
          type: "upload",
          size: result.size || file.size,
        };
        setUploadedFiles((prev) => [...prev, uploaded]);
        message.success("文件上传成功");
      } else {
        message.error("上传失败");
      }
    } catch (error) {
      console.error("上传文件失败:", error);
      message.error("上传文件失败");
    } finally {
      setUploadingFile(false);
    }
    return false; // 阻止 Upload 组件默认上传行为
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
      localStorage.removeItem("agent_chat_conversations");
    }
  };

  // 渲染消息
  const renderMessage = (msg: Message, index: number) => {
    const isUser = msg.role === "user";
    const isLoadingMsg = !isUser && !msg.content && isLoading && index === messages.length - 1;

    return (
      <div
        key={msg.id}
        style={{
          display: "flex",
          justifyContent: isUser ? "flex-end" : "flex-start",
          marginBottom: 16,
          padding: "0 16px",
          width: "100%",
        }}
      >
        {!isUser && (
          <Avatar
            size={40}
            style={{
              backgroundColor: "#667eea",
              marginRight: 12,
              flexShrink: 0,
            }}
            icon={<RobotOutlined />}
          />
        )}
        <div
          style={{
            maxWidth: isUser ? "70%" : "85%",
            display: "flex",
            flexDirection: "column",
            alignItems: isUser ? "flex-end" : "flex-start",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: isUser ? "12px 16px" : "16px 20px",
              borderRadius: 12,
              backgroundColor: isUser ? "#667eea" : "#f3f4f6",
              color: isUser ? "#fff" : "#374151",
              width: isUser ? "auto" : "100%",
              overflow: "hidden",
            }}
          >
            {isUser ? (
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{preprocessMarkdown(msg.content)}</div>
            ) : isLoadingMsg ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Spin size="small" />
                <span>AI正在思考...</span>
              </div>
            ) : (
              <div style={{ fontSize: 14, lineHeight: 1.6 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                  p: ({ children }: { children?: React.ReactNode }) => <p style={{ margin: "12px 0", lineHeight: 1.8 }}>{children}</p>,
                  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
                    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#667eea" }}>{children}</a>
                  ),
                  h1: ({ children }: { children?: React.ReactNode }) => <h1 style={{ fontSize: 24, fontWeight: 600, margin: "20px 0 10px", borderBottom: "1px solid #e5e7eb", paddingBottom: 8 }}>{children}</h1>,
                  h2: ({ children }: { children?: React.ReactNode }) => <h2 style={{ fontSize: 20, fontWeight: 600, margin: "18px 0 8px" }}>{children}</h2>,
                  h3: ({ children }: { children?: React.ReactNode }) => <h3 style={{ fontSize: 16, fontWeight: 600, margin: "14px 0 6px" }}>{children}</h3>,
                  ul: ({ children }: { children?: React.ReactNode }) => <ul style={{ paddingLeft: 20, margin: "8px 0" }}>{children}</ul>,
                  ol: ({ children }: { children?: React.ReactNode }) => <ol style={{ paddingLeft: 20, margin: "8px 0" }}>{children}</ol>,
                  li: ({ children }: { children?: React.ReactNode }) => <li style={{ margin: "4px 0", lineHeight: 1.6 }}>{children}</li>,
                  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
                    if (className === "language-mermaid") {
                      const chart = String(children).replace(/\n$/, "");
                      return <Mermaid chart={chart} />;
                    }
                    return <code className={className} style={{ backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>{children}</code>;
                  },
                  pre: ({ children }: { children?: React.ReactNode }) => <pre style={{ backgroundColor: "#f6f8fa", padding: 16, borderRadius: 8, overflow: "auto", margin: "12px 0" }}>{children}</pre>,
                  blockquote: ({ children }: { children?: React.ReactNode }) => <blockquote style={{ borderLeft: "4px solid #667eea", paddingLeft: 16, margin: "12px 0", color: "#6b7280", backgroundColor: "#f9fafb", padding: "12px 16px" }}>{children}</blockquote>,
                  table: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
                    <div style={{ overflowX: "auto", margin: "12px 0" }}>
                      <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13, backgroundColor: "#ffffff", border: "1px solid #e5e7eb" }} {...props}>{children}</table>
                    </div>
                  ),
                  thead: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <thead style={{ backgroundColor: "#f9fafb" }} {...props}>{children}</thead>,
                  tbody: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <tbody {...props}>{children}</tbody>,
                  tr: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <tr style={{ borderBottom: "1px solid #e5e7eb" }} {...props}>{children}</tr>,
                  th: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <th style={{ border: "1px solid #e5e7eb", padding: "10px 12px", textAlign: "left", fontWeight: 600, fontSize: 12, color: "#374151", backgroundColor: "#f9fafb" }} {...props}>{children}</th>,
                  td: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => <td style={{ border: "1px solid #e5e7eb", padding: "10px 12px", textAlign: "left", color: "#6b7280", fontSize: 13 }} {...props}>{children}</td>,
                  strong: ({ children }: { children?: React.ReactNode }) => <strong style={{ fontWeight: 600, color: "#374151" }}>{children}</strong>,
                  em: ({ children }: { children?: React.ReactNode }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                }}>
                  {preprocessMarkdown(msg.content)}
                </ReactMarkdown>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
            {msg.timestamp.toLocaleTimeString()}
          </div>
        </div>
        {isUser && (
          <Avatar
            size={40}
            style={{
              backgroundColor: "#10b981",
              marginLeft: 12,
              flexShrink: 0,
            }}
            icon={<UserOutlined />}
          />
        )}
      </div>
    );
  };

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", backgroundColor: "#fff" }}>
      {/* Header */}
      <div
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #e5e7eb",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#fff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar
            size={40}
            style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
            icon={<RobotOutlined />}
          />
          <div>
            <div style={{ fontWeight: 600, fontSize: 16 }}>AI Agent</div>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>智能对话助手</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setNewConversationOpen(true)}
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderColor: "transparent",
            }}
          >
            新建会话
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* 左侧会话列表 */}
        <div
          style={{
            width: 260,
            borderRight: "1px solid #e5e7eb",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#fafafa",
          }}
        >
          <div style={{ padding: 16, borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ fontWeight: 500, fontSize: 14, color: "#6b7280" }}>对话列表</div>
          </div>

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
                    backgroundColor: conv.id === currentConversationId ? "#e0e7ff" : "transparent",
                    border: conv.id === currentConversationId ? "1px solid #667eea" : "1px solid transparent",
                    transition: "all 0.2s",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 500,
                        fontSize: 13,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {conv.title}
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>
                      {conv.messages.length} 条消息
                      {conv.aiCommand && conv.aiCommand.title && ` • ${conv.aiCommand.title}`}
                    </div>
                  </div>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => deleteConversation(conv.id, e)}
                  />
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧聊天区域 */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {conversations.length === 0 ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
              }}
            >
              <RobotOutlined style={{ fontSize: 48, marginBottom: 16 }} />
              <div>点击"新建会话"开始对话</div>
            </div>
          ) : (
            <>
              {/* 消息列表 */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
                {messages.map(renderMessage)}
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
                {/* 已选附件显示 */}
                {attachedFiles.length > 0 && (
                  <div style={{ marginBottom: 12, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {attachedFiles.map((file) => (
                      <Tag
                        key={file.id}
                        closable
                        onClose={() => removeAttachedFile(file.id)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px",
                          background: "#f0f5ff",
                          border: "1px solid #adc6ff",
                        }}
                      >
                        <PaperClipOutlined style={{ fontSize: 12 }} />
                        <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {file.name}
                        </span>
                        <span style={{ fontSize: 10, color: "#999" }}>
                          {file.type === "course_file" ? "课程文件" : "上传"}
                        </span>
                      </Tag>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
                  <Button
                    icon={<PaperClipOutlined />}
                    onClick={openFileSelector}
                    disabled={isLoading}
                    style={{ borderRadius: 8 }}
                    title="添加附件"
                  />
                  <TextArea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="输入您的问题... (Enter 发送, Shift+Enter 换行)"
                    autoSize={{ minRows: 1, maxRows: 4 }}
                    style={{ flex: 1, borderRadius: 8 }}
                    disabled={isLoading}
                  />
                  <Button
                    type="primary"
                    icon={isLoading ? <Spin size="small" /> : <SendOutlined />}
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    style={{
                      background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                      borderColor: "transparent",
                    }}
                  >
                    {isLoading ? "" : "发送"}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 新建会话弹窗 */}
      {newConversationOpen && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <Card
            title="选择对话模式"
            style={{ width: 500, maxHeight: "80vh", overflow: "auto" }}
            extra={<Button onClick={() => setNewConversationOpen(false)}>关闭</Button>}
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

            <div style={{ marginBottom: 8, fontWeight: 500 }}>或选择AI命令模板</div>

            {aiCommands.length === 0 ? (
              <div style={{ textAlign: "center", padding: 20, color: "#9ca3af" }}>
                暂无AI命令，请在AI命令中心创建
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
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
      )}

      {/* 文件选择弹窗 */}
      <Modal
        title="选择文件"
        open={fileSelectorOpen}
        onCancel={() => setFileSelectorOpen(false)}
        footer={null}
        width={600}
      >
        <Tabs
          items={[
            {
              key: "course_files",
              label: (
                <span>
                  <BookOutlined /> 课程文件
                </span>
              ),
              children: (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <Select
                      placeholder="请选择课程"
                      style={{ width: "100%" }}
                      value={selectedCourseId || undefined}
                      onChange={handleCourseChange}
                      loading={loadingCourses}
                      showSearch
                      optionFilterProp="label"
                      options={courses.map((c) => ({
                        value: c.id,
                        label: c.title,
                      }))}
                    />
                  </div>
                  <div style={{ maxHeight: 350, overflow: "auto" }}>
                    {loadingFiles ? (
                      <div style={{ textAlign: "center", padding: 40 }}>
                        <Spin />
                      </div>
                    ) : !selectedCourseId ? (
                      <Empty description="请先选择课程" />
                    ) : courseFiles.length === 0 ? (
                      <Empty description="该课程暂无文件" />
                    ) : (
                      <List
                        dataSource={courseFiles}
                        renderItem={(file) => (
                          <List.Item
                            style={{ cursor: "pointer", padding: "12px 16px" }}
                            onClick={() => selectCourseFile(file)}
                            hoverable
                          >
                            <List.Item.Meta
                              avatar={<FileOutlined style={{ fontSize: 20, color: "#52c41a" }} />}
                              title={file.name}
                              description={file.url ? file.url.substring(0, 50) + "..." : ""}
                            />
                          </List.Item>
                        )}
                      />
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "upload",
              label: (
                <span>
                  <CloudUploadOutlined /> 上传文件
                </span>
              ),
              children: (
                <div>
                  <div style={{ padding: "0 20px 20px" }}>
                    <Upload.Dragger
                      accept=".pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.ppt,.pptx,.png,.jpg,.jpeg"
                      beforeUpload={handleUpload}
                      showUploadList={false}
                      disabled={uploadingFile}
                    >
                      {uploadingFile ? (
                        <div style={{ padding: 40 }}>
                          <Spin />
                          <p style={{ marginTop: 16, color: "#666" }}>上传中...</p>
                        </div>
                      ) : (
                        <>
                          <p className="ant-upload-drag-icon">
                            <CloudUploadOutlined style={{ fontSize: 48, color: "#667eea" }} />
                          </p>
                          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                          <p className="ant-upload-hint">
                            支持 PDF、Word、Excel、PPT、图片等格式
                          </p>
                        </>
                      )}
                    </Upload.Dragger>
                  </div>

                  {/* 已上传的文件列表 */}
                  {uploadedFiles.length > 0 && (
                    <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
                      <div style={{ padding: "0 20px 8px", fontWeight: 500, color: "#666" }}>
                        已上传文件（点击选择）
                      </div>
                      <div style={{ maxHeight: 200, overflow: "auto" }}>
                        <List
                          dataSource={uploadedFiles}
                          renderItem={(file) => (
                            <List.Item
                              style={{ cursor: "pointer", padding: "12px 20px" }}
                              onClick={() => selectUploadedFile(file)}
                              hoverable
                            >
                              <List.Item.Meta
                                avatar={<FileOutlined style={{ fontSize: 20, color: "#1890ff" }} />}
                                title={file.name}
                                description={file.size ? `${(file.size / 1024).toFixed(1)} KB` : ""}
                              />
                              <Button
                                type="text"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeUploadedFile(file.id);
                                }}
                              />
                            </List.Item>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
}
