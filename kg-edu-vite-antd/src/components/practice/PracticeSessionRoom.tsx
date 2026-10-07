import { useCallback, useEffect, useRef, useState } from "react";
import {
  App,
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Space,
  Spin,
  Tag,
  Typography,
} from "antd";
import { ReloadOutlined, SendOutlined, BarChartOutlined, SaveOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  appendPracticeMessages,
  evaluatePracticeSession,
  fetchPracticeSession,
  gradePracticeSession,
  type PracticeMessage,
  type PracticeSession,
} from "@/lib/practice-session";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

interface Props {
  token: string;
  role: "teacher" | "student";
  userId: string;
  tenant: string;
  headers: Record<string, string>;
  onExit?: () => void;
}

export default function PracticeSessionRoom({ token, role, userId, tenant, headers, onExit }: Props) {
  const { message } = App.useApp();
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualScore, setManualScore] = useState<number | null>(null);
  const [manualReport, setManualReport] = useState("");
  const [grading, setGrading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const res = await fetchPracticeSession(token, tenant, headers);
    if (res.ok && res.data) {
      setSession(res.data);
      setError(null);
    } else if (!session) {
      setError(res.error || "会话不存在或已失效");
    }
  }, [token, tenant, headers, session]);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const res = await fetchPracticeSession(token, tenant, headers);
      if (!active) return;
      if (res.ok && res.data) setSession(res.data);
      else setError(res.error || "会话不存在或已失效");
      setLoading(false);
    })();
    const timer = setInterval(() => {
      refresh();
    }, 4000);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session?.transcript?.length]);

  const submitGrade = async () => {
    if (manualScore === null || manualScore < 0 || manualScore > 100) {
      message.warning("请输入 0-100 的分数");
      return;
    }
    setGrading(true);
    try {
      const res = await gradePracticeSession(
        token,
        { score: manualScore, report: manualReport.trim() || undefined },
        tenant,
        headers
      );
      if (res.ok && res.data) {
        setSession(res.data);
        setManualReport("");
        message.success(`已保存分数：${res.data.score} 分`);
      } else {
        message.error(res.error || "保存失败");
      }
    } finally {
      setGrading(false);
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending || !session) return;
    setInput("");
    setSending(true);
    try {
      const userMsg: PracticeMessage = { role, content: text };
      const r1 = await appendPracticeMessages(token, [userMsg], tenant, headers);
      if (r1.ok && r1.data) setSession(r1.data);
      else if (r1.error) message.error(r1.error);
    } catch (e: any) {
      message.error(e?.message || "发送失败");
    } finally {
      setSending(false);
    }
  };

  const evaluate = async () => {
    setEvaluating(true);
    try {
      const res = await evaluatePracticeSession(token, tenant, headers);
      if (res.ok && res.data) {
        setSession(res.data);
        message.success(`评分完成：${res.data.score} 分`);
      } else {
        message.error(res.error || "评分失败");
      }
    } finally {
      setEvaluating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 48 }}>
        <Spin />
      </div>
    );
  }

  if (error || !session) {
    return <Alert type="error" message={error || "会话不存在或已失效"} showIcon />;
  }

  const msgs = session.transcript || [];
  const myRoleLabel = role === "teacher" ? "我（教师）" : "我（学生）";

  return (
    <div>
      <Space style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <Text strong>{session.title || "互动故事课堂"}</Text>
        <Button size="small" icon={<ReloadOutlined />} onClick={refresh}>
          刷新
        </Button>
        {onExit && (
          <Button size="small" onClick={onExit}>
            退出房间
          </Button>
        )}
      </Space>

      <div
        ref={scrollRef}
        style={{
          height: 360,
          overflowY: "auto",
          border: "1px solid #e0e0e0",
          borderRadius: 8,
          padding: 12,
          background: "#fafafa",
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {msgs.length === 0 && <Text type="secondary">还没有消息。发送一条内容开始互动故事。</Text>}
        {msgs.map((m, i) => {
          const isMine = m.role === role;
          const isAi = m.role === "ai";
          const bg = isAi ? "white" : isMine ? "#1890ff" : "#d9f7be";
          const color = isMine && !isAi ? "white" : undefined;
          return (
            <div
              key={i}
              style={{
                alignSelf: isAi ? "flex-start" : isMine ? "flex-end" : "flex-start",
                maxWidth: "85%",
                background: bg,
                color,
                border: isAi ? "1px solid #e0e0e0" : undefined,
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              {!isAi && (
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 2 }}>
                  {m.role === "teacher" ? "教师" : "学生"}
                </div>
              )}
              {isAi ? (
                <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <span style={{ whiteSpace: "pre-wrap" }}>{m.content}</span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
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
          placeholder={`以${myRoleLabel}发言推进故事…`}
        />
        <Button type="primary" icon={<SendOutlined />} loading={sending} onClick={send}>
          发送
        </Button>
      </div>

      {role === "teacher" && (
        <div style={{ marginTop: 12 }}>
          <Button icon={<BarChartOutlined />} loading={evaluating} onClick={evaluate}>
            AI 评分并生成报告
          </Button>
          <Text type="secondary" style={{ marginLeft: 8, fontSize: 12 }}>
            依据学生作答自动评分，学生端将同步看到分数与报告
          </Text>
        </div>
      )}

      {role === "teacher" && (
        <Space style={{ marginTop: 8 }} wrap>
          <InputNumber
            min={0}
            max={100}
            placeholder="分数"
            value={manualScore}
            onChange={(v) => setManualScore(v as number | null)}
            style={{ width: 100 }}
          />
          <Input
            placeholder="报告（可选，留空保留现有报告）"
            value={manualReport}
            onChange={(e) => setManualReport(e.target.value)}
            style={{ width: 280 }}
          />
          <Button icon={<SaveOutlined />} loading={grading} onClick={submitGrade}>
            手动改分
          </Button>
        </Space>
      )}

      {session.report && (
        <Card
          size="small"
          style={{ marginTop: 12, background: "#f6f0ff" }}
          title={
            <span>
              评估报告　
              <Tag color={(session.score ?? 0) >= 80 ? "green" : (session.score ?? 0) >= 60 ? "orange" : "red"}>
                {session.score} 分
              </Tag>
            </span>
          }
        >
          <Paragraph style={{ marginBottom: 0 }}>{session.report}</Paragraph>
        </Card>
      )}
    </div>
  );
}
