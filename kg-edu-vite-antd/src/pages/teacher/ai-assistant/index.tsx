/**
 * AI 智能体助手
 * 参照「易课程-完整交互原型」#/teacher/AI智能体助手：
 * 左侧「课程助手」快捷提示面板 + 右侧对话卡片。
 * 对话仍由 assistant-ui（AG-UI）驱动真实后端。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { Button, Select, message } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import AssistantChat from "@/components/assistant-ui/AssistantChat";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { AppPage, PageHead } from "@/components/proto";
import {
  listCommands,
  createConversation as rpcCreateConversation,
  listConversations as rpcListConversations,
} from "@/lib/ash_rpc";
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
  aiCommand: AICommand | null;
  aiCommandId?: string | null;
}

const QUICK_PROMPTS = [
  { label: "课程答疑", prompt: "请解释本章的核心概念" },
  { label: "教案设计", prompt: "请帮我设计一节视觉语言课程" },
  { label: "知识点提炼", prompt: "请提炼本章的核心知识点" },
  { label: "学习建议", prompt: "如何安排本周学习计划" },
];

export default function AIAssistantPage() {
  const { user } = useAuth();
  const [aiCommands, setAiCommands] = useState<AICommand[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [presetPrompt, setPresetPrompt] = useState<{ text: string; nonce: number } | null>(null);
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
          aiCommand: null,
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

  // 命令详情填充会话
  useEffect(() => {
    if (conversations.length > 0 && aiCommands.length > 0) {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.aiCommandId) {
            const cmd = aiCommands.find((c) => c.id === conv.aiCommandId);
            return cmd ? { ...conv, aiCommand: cmd } : conv;
          }
          return conv;
        }),
      );
    }
  }, [aiCommands, conversations.length > 0]);

  const createConversation = useCallback(
    async (command?: AICommand | null) => {
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
    },
    [user, conversations.length],
  );

  const switchConversation = useCallback(
    (convId: string) => {
      const conv = conversations.find((c) => c.id === convId);
      if (conv) {
        setCurrentConversationId(convId);
        currentConversationIdRef.current = convId;
        setThreadId(conv.threadId);
      }
    },
    [conversations],
  );

  const handleQuickPrompt = async (prompt: string) => {
    if (!currentConversationId) {
      await createConversation(null);
    }
    setPresetPrompt({ text: prompt, nonce: Date.now() });
  };

  const activeConversation = conversations.find((c) => c.id === currentConversationId);
  const subtitle = activeConversation?.aiCommand?.title || "通用课程教学助手";

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
            <Button onClick={() => createConversation(null)}>
              <PlusOutlined /> 新建对话
            </Button>
          }
        />

        <div className="ai-split">
          <aside className="ai-card ai-tree">
            <h3>课程助手</h3>
            <div className="ai-tree__list">
              {QUICK_PROMPTS.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleQuickPrompt(item.prompt)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <div className="ai-note">
              助手会结合课程内容作答，结果仅供参考，请自行核对。
            </div>
          </aside>

          <section className="ai-card ai-chat">
            <div className="ai-chat__header">
              <span className="ai-avatar">AI</span>
              <div>
                <h3>易课程智能助手</h3>
                <small>{subtitle}</small>
              </div>
              {conversations.length > 0 && (
                <Select
                  className="ai-chat__switch"
                  size="small"
                  value={currentConversationId || undefined}
                  placeholder="选择会话"
                  onChange={switchConversation}
                  options={conversations.map((c) => ({ label: c.title, value: c.id }))}
                />
              )}
            </div>

            <div className="ai-chat__body">
              {currentConversationId ? (
                <AssistantChat
                  key={currentConversationId}
                  threadId={threadId}
                  conversationId={currentConversationId}
                  aiCommand={activeConversation?.aiCommand || null}
                  presetPrompt={presetPrompt}
                />
              ) : (
                <div className="ai-chat__empty">
                  <div>
                    <span className="ai-avatar ai-avatar--lg">AI</span>
                    <p>点击右上角「新建对话」，开始与智能助手交流。</p>
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
