import * as React from "react";
import { useState } from "react";
import {
  Card, Button, Typography, Spin, Input, Tabs, Tag, message, Space, List,
} from "antd";
import { ArrowLeftOutlined, SendOutlined, BarChartOutlined } from "@ant-design/icons";
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
        systemPrompt: sc.systemPrompt,
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
    } catch {
      message.error("对话失败");
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
          <div style={{ marginTop: 12, maxHeight: 380, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {cur.length === 0 && <Text type="secondary">（{sc.placeholder}）</Text>}
            {cur.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? "#1890ff" : "white", color: m.role === "user" ? "white" : undefined, border: m.role === "ai" ? "1px solid #e0e0e0" : undefined, borderRadius: 8, padding: "8px 12px", whiteSpace: "pre-wrap" }}>
                {m.content || (chatting && i === cur.length - 1 ? "思考中…" : "")}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
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
