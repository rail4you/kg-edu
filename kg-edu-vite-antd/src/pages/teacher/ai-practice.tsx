import * as React from "react";
import { useState } from "react";
import {
  Card, Button, Typography, Spin, Input, Tabs, Tag, message, Space, List, Select,
} from "antd";
import { ArrowLeftOutlined, SendOutlined, BarChartOutlined, FileTextOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { SCENARIOS, chatOnce, type ScenarioKey } from "@/lib/practice";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Msg {
  role: "user" | "ai";
  content: string;
}

/** 情景对话：可选预设场景，AI 按角色扮演回答 */
const DIALOGUE_PRESETS: Array<{ key: string; label: string; prompt: string }> = [
  {
    key: "restaurant",
    label: "餐厅点餐",
    prompt:
      "你是餐厅服务员，正在接待一位顾客。请用热情、礼貌的语气接待，引导顾客点餐并介绍菜品，顾客点完后再确认订单。全程只用中文交流。",
  },
  {
    key: "interview",
    label: "求职面试",
    prompt:
      "你是公司的面试官，正在面试一位求职者。请依次提问关于自我介绍、专业技能、项目经历的问题，并根据回答适当追问，最后请求职者提问。全程只用中文交流。",
  },
  {
    key: "hospital",
    label: "医院问诊",
    prompt:
      "你是医院的全科医生，正在接诊一位病人。请先询问症状、病史，再给出初步建议，语气专业而温和。全程只用中文交流。",
  },
  {
    key: "airport",
    label: "机场值机",
    prompt:
      "你是机场地勤人员，正在为旅客办理值机手续。请引导旅客出示证件、确认行李托运和登机口信息，语气友好耐心。全程只用中文交流。",
  },
  {
    key: "hotel",
    label: "酒店入住",
    prompt:
      "你是酒店前台，正在为客人办理入住。请询问预订信息、办理登记、介绍酒店设施，语气礼貌周到。全程只用中文交流。",
  },
];

export default function AiPractice() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [scenario, setScenario] = useState<ScenarioKey>("dialogue");
  const [msgs, setMsgs] = useState<Record<string, Msg[]>>({});
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [report, setReport] = useState<{ score: number; report: string } | null>(null);
  const [rolePrompts, setRolePrompts] = useState<Record<string, string>>(() =>
    Object.fromEntries(SCENARIOS.map((s) => [s.key, s.systemPrompt]))
  );

  const sc = SCENARIOS.find((s) => s.key === scenario)!;
  const cur = msgs[scenario] || [];

  const send = async () => {
    const text = input.trim();
    if (!text || chatting) return;
    setInput("");
    const next = [...cur, { role: "user" as const, content: text }];
    setMsgs((m) => ({ ...m, [scenario]: next }));
    setChatting(true);
    try {
      let ai = "";
      setMsgs((m) => ({ ...m, [scenario]: [...next, { role: "ai" as const, content: "" }] }));
      await chatOnce({
        message: text,
        systemPrompt: rolePrompts[scenario] || sc.systemPrompt,
        tenant,
        userId: user?.id,
        headers,
        onToken: (d) => {
          ai += d;
          setMsgs((m) => {
            const arr = [...(m[scenario] || [])];
            arr[arr.length - 1] = { role: "ai", content: ai };
            return { ...m, [scenario]: arr };
          });
        },
      });
      if (!ai) {
        setMsgs((m) => {
          const arr = [...(m[scenario] || [])];
          arr[arr.length - 1] = { role: "ai", content: "（AI 暂无回复，请检查 Key 后重试）" };
          return { ...m, [scenario]: arr };
        });
      }
    } catch (e) {
      message.error(e instanceof Error && e.message ? `对话失败：${e.message}` : "对话失败");
    } finally {
      setChatting(false);
    }
  };

  const evaluate = async () => {
    if (cur.length === 0) {
      message.warning("先进行若干轮互动再评估");
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
          transcript: cur.map((m) => ({ role: m.role, content: m.content })),
          userId: user?.id,
        }),
      }).then((x) => x.json());
      if (r.success) {
        setReport({ score: r.score, report: r.report });
        message.success(`评估完成：${r.score} 分`);
      } else message.error(r.error || "评估失败");
    } finally {
      setEvaluating(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", paddingBottom: 24 }}>
      <div style={{ padding: 24, background: "white", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>AI 实践（6 场景实时评估）</Title>
      </div>

      <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
        <Tabs
          activeKey={scenario}
          onChange={(k) => { setScenario(k as ScenarioKey); setReport(null); }}
          items={SCENARIOS.map((s) => ({ key: s.key, label: s.name }))}
        />
        <Card>
          <Text type="secondary">{sc.desc}</Text>
          <div style={{ marginTop: 12, border: "1px solid #e0e0e0", borderRadius: 8, padding: 12, background: "#fafafa" }}>
            <Space style={{ width: "100%", alignItems: "center" }}>
              <Text strong>AI 角色 / 主题设定</Text>
              {scenario === "dialogue" && (
                <Select
                  style={{ width: 180 }}
                  placeholder="选择预设场景"
                  value={DIALOGUE_PRESETS.find((p) => p.prompt === rolePrompts.dialogue)?.key || undefined}
                  options={DIALOGUE_PRESETS.map((p) => ({ value: p.key, label: p.label }))}
                  onChange={(k) => {
                    const p = DIALOGUE_PRESETS.find((x) => x.key === k);
                    if (p) setRolePrompts((r) => ({ ...r, dialogue: p.prompt }));
                  }}
                />
              )}
            </Space>
            <TextArea
              rows={2}
              value={rolePrompts[scenario] || sc.systemPrompt}
              onChange={(e) => setRolePrompts((r) => ({ ...r, [scenario]: e.target.value }))}
              placeholder={`为「${sc.name}」设定独立的 AI 角色与主题，AI 将仅按此设定作答`}
              style={{ marginTop: 8 }}
            />
          </div>
          <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {cur.length === 0 && <Text type="secondary">（{sc.placeholder}）</Text>}
            {cur.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? "#1890ff" : "white", color: m.role === "user" ? "white" : undefined, border: m.role === "ai" ? "1px solid #e0e0e0" : undefined, borderRadius: 8, padding: "8px 12px", whiteSpace: m.role === "ai" ? "normal" : "pre-wrap" }}>
                {m.role === "ai" && m.content ? (
                  <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                      p: ({ children }: { children?: React.ReactNode }) => <p style={{ margin: "8px 0" }}>{children}</p>,
                      a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
                        <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#1890ff" }}>{children}</a>
                      ),
                      h1: ({ children }: { children?: React.ReactNode }) => <h1 style={{ fontSize: 20, fontWeight: 600, margin: "12px 0 6px" }}>{children}</h1>,
                      h2: ({ children }: { children?: React.ReactNode }) => <h2 style={{ fontSize: 17, fontWeight: 600, margin: "10px 0 6px" }}>{children}</h2>,
                      h3: ({ children }: { children?: React.ReactNode }) => <h3 style={{ fontSize: 15, fontWeight: 600, margin: "8px 0 4px" }}>{children}</h3>,
                      ul: ({ children }: { children?: React.ReactNode }) => <ul style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ul>,
                      ol: ({ children }: { children?: React.ReactNode }) => <ol style={{ paddingLeft: 20, margin: "6px 0" }}>{children}</ol>,
                      li: ({ children }: { children?: React.ReactNode }) => <li style={{ margin: "3px 0" }}>{children}</li>,
                      code: ({ className, children }: { className?: string; children?: React.ReactNode }) => (
                        <code className={className} style={{ backgroundColor: "#f5f5f5", padding: "2px 6px", borderRadius: 4, fontSize: 13 }}>{children}</code>
                      ),
                      pre: ({ children }: { children?: React.ReactNode }) => <pre style={{ backgroundColor: "#f6f8fa", padding: 12, borderRadius: 8, overflow: "auto", margin: "8px 0", fontFamily: "monospace", fontSize: 13 }}>{children}</pre>,
                      strong: ({ children }: { children?: React.ReactNode }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
                      em: ({ children }: { children?: React.ReactNode }) => <em style={{ fontStyle: "italic" }}>{children}</em>,
                    }}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <>{m.content || (chatting && i === cur.length - 1 ? "思考中…" : "")}</>
                )}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            <Button size="small" icon={<FileTextOutlined />} onClick={() => { setInput(sc.template); setMsgs((m) => ({ ...m, [scenario]: [] })); setReport(null); }}>
              填入示例文本
            </Button>
            <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>点击后将示例内容填入下方输入框，便于快速演示</Text>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {sc.inputKind === "code" ? (
              <TextArea rows={3} value={input} onChange={(e) => setInput(e.target.value)} placeholder={sc.placeholder} style={{ fontFamily: "monospace" }} />
            ) : (
              <TextArea rows={2} value={input} onChange={(e) => setInput(e.target.value)} onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(); } }} placeholder={sc.placeholder} />
            )}
            <Button type="primary" icon={<SendOutlined />} loading={chatting} onClick={send}>
              发送
            </Button>
          </div>
          <div style={{ marginTop: 12 }}>
            <Button icon={<BarChartOutlined />} loading={evaluating} onClick={evaluate}>
              AI 实时评估并生成报告
            </Button>
          </div>
          {report && (
            <Card size="small" title={<span>评估报告　<Tag color={report.score >= 80 ? "green" : report.score >= 60 ? "orange" : "red"}>{report.score} 分</Tag></span>} style={{ marginTop: 12, background: "#f6f0ff" }}>
              <Paragraph>{report.report}</Paragraph>
            </Card>
          )}
        </Card>
      </div>
    </div>
  );
}
