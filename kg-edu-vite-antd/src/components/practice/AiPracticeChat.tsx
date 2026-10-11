import * as React from "react";
import { useState } from "react";
import { Button, Card, Input, Space, Tag, Typography, message } from "antd";
import { SendOutlined, BarChartOutlined, BulbOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import {
  SCENARIOS,
  chatOnce,
  extractAnswers,
  getScenarioAnswerMode,
  type ScenarioKey,
} from "@/lib/practice";

const { Text } = Typography;
const { TextArea } = Input;

interface Msg {
  role: "user" | "ai";
  content: string;
}

export interface AiPracticeChatProps {
  scenario: ScenarioKey;
  /** 教师配置的 AI 角色 / 提示词 */
  systemPrompt?: string;
  /** 场景名称，如「餐厅点餐」 */
  title?: string;
  placeholder?: string;
  inputKind?: "chat" | "code" | "upload";
  /** 完成后回调（携带分数） */
  onEvaluated?: (result: { score: number; report: string }) => void;
}

/**
 * 单个 AI 实践场景的对话 + 实时评估面板。
 * 用于学生端智慧门户的 `ai-practice` 组件；教师端配置的角色/参数在此生效。
 */
export default function AiPracticeChat({
  scenario,
  systemPrompt,
  title,
  placeholder,
  inputKind,
  onEvaluated,
}: AiPracticeChatProps) {
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const meta = SCENARIOS.find((s) => s.key === scenario);
  const kind = inputKind || meta?.inputKind || "chat";
  const prompt = systemPrompt || meta?.systemPrompt || "";
  const ph = placeholder || meta?.placeholder || "";

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [report, setReport] = useState<{ score: number; report: string } | null>(null);

  const answers = extractAnswers(msgs, scenario);
  const hasAnswers = answers.length > 0;

  const send = async () => {
    const text = input.trim();
    if (!text || chatting) return;
    setInput("");
    const next: Msg[] = [...msgs, { role: "user", content: text }];
    setMsgs([...next, { role: "ai", content: "" }]);
    setChatting(true);
    try {
      let ai = "";
      await chatOnce({
        message: text,
        systemPrompt: prompt,
        tenant,
        userId: user?.id,
        headers,
        onToken: (d) => {
          ai += d;
          setMsgs((prev) => {
            const arr = [...prev];
            arr[arr.length - 1] = { role: "ai", content: ai };
            return arr;
          });
        },
      });
      if (!ai) {
        setMsgs((prev) => {
          const arr = [...prev];
          arr[arr.length - 1] = { role: "ai", content: "（AI 暂无回复，请稍后重试）" };
          return arr;
        });
      }
    } catch (e) {
      message.error(e instanceof Error && e.message ? `对话失败：${e.message}` : "对话失败");
    } finally {
      setChatting(false);
    }
  };

  const evaluate = async () => {
    if (!hasAnswers) {
      message.warning(
        getScenarioAnswerMode(scenario) === "qa" ? "请先回答 AI 提出的问题后再评估" : "请先提交内容后再评估"
      );
      return;
    }
    setEvaluating(true);
    try {
      const r = await fetch("/api/practice/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          tenant,
          scenario,
          transcript: msgs.map((m) => ({ role: m.role, content: m.content })),
          userId: user?.id,
        }),
      }).then((x) => x.json());
      if (r.success) {
        setReport({ score: r.score, report: r.report });
        onEvaluated?.({ score: r.score, report: r.report });
        message.success(`评估完成：${r.score} 分`);
      } else {
        message.error(r.error || "评估失败");
      }
    } catch {
      message.error("评估失败");
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div>
      <Space wrap style={{ marginBottom: 8 }}>
        {title && <Tag color="blue">{title}</Tag>}
        {meta && <Text type="secondary">{meta.desc}</Text>}
      </Space>

      <div
        style={{
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          padding: 12,
          background: "#fafafa",
          minHeight: 160,
          maxHeight: 360,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {msgs.length === 0 && <Text type="secondary">（{ph}）</Text>}
        {msgs.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: m.role === "user" ? "#1890ff" : "white",
              color: m.role === "user" ? "white" : undefined,
              border: m.role === "ai" ? "1px solid #e0e0e0" : undefined,
              borderRadius: 8,
              padding: "8px 12px",
              whiteSpace: m.role === "ai" ? "normal" : "pre-wrap",
            }}
          >
            {m.role === "ai" && m.content ? (
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                  components={{
                    p: ({ children }: { children?: React.ReactNode }) => (
                      <p style={{ margin: "8px 0" }}>{children}</p>
                    ),
                    a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
                      <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#1890ff" }}>
                        {children}
                      </a>
                    ),
                    ul: ({ children }: { children?: React.ReactNode }) => (
                      <ul style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ul>
                    ),
                    ol: ({ children }: { children?: React.ReactNode }) => (
                      <ol style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ol>
                    ),
                    li: ({ children }: { children?: React.ReactNode }) => (
                      <li style={{ margin: "3px 0" }}>{children}</li>
                    ),
                    code: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
                      <code
                        className={className}
                        style={{ backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}
                      >
                        {children}
                      </code>
                    ),
                    pre: ({ children }: { children?: React.ReactNode }) => (
                      <pre
                        style={{
                          backgroundColor: "#f6f8fa",
                          padding: 12,
                          borderRadius: 8,
                          overflow: "auto",
                          margin: "8px 0",
                          fontFamily: "monospace",
                          fontSize: 13,
                        }}
                      >
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            ) : (
              <>{m.content || (chatting && i === msgs.length - 1 ? "思考中…" : "")}</>
            )}
          </div>
        ))}
      </div>

      {meta?.template && msgs.length === 0 && (
        <div style={{ marginTop: 8 }}>
          <Button
            size="small"
            icon={<BulbOutlined />}
            onClick={() => setInput(meta.template)}
          >
            填入示例文本
          </Button>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            点击后将示例内容填入下方输入框，便于快速演示
          </Text>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {kind === "code" ? (
          <TextArea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ph}
            style={{ fontFamily: "monospace" }}
          />
        ) : (
          <TextArea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={ph}
          />
        )}
        <Button type="primary" icon={<SendOutlined />} loading={chatting} onClick={send}>
          发送
        </Button>
      </div>

      <div style={{ marginTop: 12 }}>
        <Button icon={<BarChartOutlined />} loading={evaluating} onClick={evaluate} disabled={!hasAnswers}>
          提交并查看评估结果
        </Button>
        {!hasAnswers && (
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            {getScenarioAnswerMode(scenario) === "qa" ? "请先回答 AI 的提问" : "请先提交作品/代码"}
          </Text>
        )}
      </div>

      {report && (
        <Card size="small" title={`评估结果：${report.score} 分`} style={{ marginTop: 12 }}>
          <div style={{ fontSize: 14, lineHeight: 1.7 }}>
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {report.report}
            </ReactMarkdown>
          </div>
        </Card>
      )}
    </div>
  );
}
