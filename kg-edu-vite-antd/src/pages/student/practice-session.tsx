import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button, Card, Input, Popconfirm, Spin, Typography, message } from "antd";
import {
  ArrowLeftOutlined,
  SendOutlined,
  BarChartOutlined,
  BulbOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { fetchStudentSmartPortal, type PortalBlock } from "@/lib/smart-portal";
import {
  SCENARIOS,
  chatOnce,
  extractAnswers,
  getScenarioAnswerMode,
  fetchPracticeSession,
  savePracticeSession,
  resetPracticeSession,
  type ScenarioKey,
} from "@/lib/practice";
import "./practice-session.css";

const { Text } = Typography;
const { TextArea } = Input;

interface Msg {
  role: "user" | "ai";
  content: string;
}

export default function StudentPracticeSession() {
  const navigate = useNavigate();
  const { scenario: scenarioParam } = useParams<{ scenario: string }>();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("courseId") || undefined;
  const blockId = searchParams.get("blockId") || undefined;

  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const headers = useMemo(
    () => getAuthHeaders(user) as Record<string, string>,
    [user],
  );

  const scenario = (scenarioParam as ScenarioKey) || "dialogue";
  const meta = SCENARIOS.find((s) => s.key === scenario);

  const { data: portalConfig } = useQuery({
    queryKey: ["student-smart-portal-session", user?.id],
    queryFn: () => fetchStudentSmartPortal(user?.id, headers),
    enabled: !!user?.id,
    staleTime: 60 * 1000,
  });

  const block: PortalBlock | undefined = portalConfig?.layout.blocks.find(
    (b) => b.id === blockId,
  );

  const preset = (block?.config.preset as string) || "";
  const rolePrompt = (block?.config.rolePrompt as string) || meta?.systemPrompt || "";
  const inputKind =
    (block?.config.inputKind as "chat" | "code" | "upload") ||
    meta?.inputKind ||
    "chat";
  const placeholder =
    (block?.config.placeholder as string) || meta?.placeholder || "";
  const title = block?.title || preset || meta?.name || "AI 实践";

  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [chatting, setChatting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [report, setReport] = useState<{ score: number; report: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const bodyRef = useRef<HTMLDivElement>(null);

  const answers = extractAnswers(msgs, scenario);
  const hasAnswers = answers.length > 0;

  useEffect(() => {
    if (!tenant || !user?.id) return;
    let active = true;
    setLoading(true);
    fetchPracticeSession({
      tenant,
      scenario,
      userId: user.id,
      courseId,
      headers,
    })
      .then((rec) => {
        if (!active) return;
        if (rec?.transcript?.length) {
          setMsgs(
            rec.transcript.map((m) => ({
              role: m.role === "user" ? "user" : "ai",
              content: m.content,
            })),
          );
        }
        if (rec?.score != null && rec?.report) {
          setReport({ score: rec.score, report: rec.report });
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tenant, user?.id, scenario, courseId, headers]);

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const persist = (list: Msg[]) => {
    if (!tenant || !user?.id) return;
    void savePracticeSession({
      tenant,
      scenario,
      userId: user.id,
      courseId,
      transcript: list.map((m) => ({ role: m.role, content: m.content })),
      headers,
    });
  };

  const send = async () => {
    const text = input.trim();
    if (!text || chatting) return;
    setInput("");
    const withUser: Msg[] = [...msgs, { role: "user", content: text }];
    persist(withUser);
    setMsgs([...withUser, { role: "ai", content: "" }]);
    setChatting(true);
    try {
      let ai = "";
      await chatOnce({
        message: text,
        systemPrompt: rolePrompt,
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
      } else {
        persist([...withUser, { role: "ai", content: ai }]);
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
        getScenarioAnswerMode(scenario) === "qa"
          ? "请先回答 AI 提出的问题后再评估"
          : "请先提交内容后再评估",
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
          courseId,
        }),
      }).then((x) => x.json());
      if (r.success) {
        setReport({ score: r.score, report: r.report });
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

  const reset = async () => {
    if (!tenant || !user?.id) return;
    setResetting(true);
    const ok = await resetPracticeSession({
      tenant,
      scenario,
      userId: user.id,
      courseId,
      headers,
    });
    if (ok) {
      setMsgs([]);
      setReport(null);
      setInput("");
      message.success("已重置练习，可重新作答");
    } else {
      message.error("重置失败，请稍后重试");
    }
    setResetting(false);
  };

  const goBack = () => {
    navigate(
      courseId
        ? `/dashboard/smart-portal?courseId=${encodeURIComponent(courseId)}`
        : "/dashboard/smart-portal",
    );
  };

  return (
    <div className="practice-session-page">
      <div className="practice-session-head">
        <div>
          <h1>{title}</h1>
          <p>{meta?.desc || "AI 实践"}</p>
        </div>
        <Button
          className="practice-session-head__back"
          icon={<ArrowLeftOutlined />}
          onClick={goBack}
        >
          返回智能门户
        </Button>
      </div>

      <div className="practice-session-card">
        <div className="practice-session-card__header">
          <span className="practice-avatar">AI</span>
          <div>
            <h3>易课程智能助手</h3>
            <small>{preset || meta?.name || "AI 实践"}</small>
          </div>
          <Popconfirm
            title="重置练习"
            description="将清空当前对话记录、分数与报告，重新作答。确定继续？"
            okText="重置"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={reset}
          >
            <Button
              size="small"
              icon={<ReloadOutlined />}
              loading={resetting}
              disabled={msgs.length === 0 && !report}
              style={{ marginLeft: "auto" }}
            >
              重置练习
            </Button>
          </Popconfirm>
        </div>

        <div className="practice-session-card__guide">
          <div className="practice-session-card__guide-label">
            <BulbOutlined /> 实践指导
          </div>
          <p>{meta?.desc || "与 AI 角色多轮对话完成本次实践任务。"}</p>
          {rolePrompt && (
            <p>
              <strong>角色设定：</strong>
              {rolePrompt}
            </p>
          )}
          <p>
            <strong>流程：</strong>
            与 AI 角色进行多轮对话完成练习，对话内容会自动保存；随时可返回继续练习，完成后可提交查看评估结果。
          </p>
        </div>

        <div className="practice-session-body" ref={bodyRef}>
          {loading ? (
            <div className="practice-session-empty">
              <Spin />
            </div>
          ) : msgs.length === 0 ? (
            <div className="practice-session-empty">
              <span
                className="practice-avatar"
                style={{ margin: "0 auto 12px", width: 56, height: 56, fontSize: 20 }}
              >
                AI
              </span>
              <p>{placeholder || "开始与 AI 对话吧"}</p>
            </div>
          ) : (
            msgs.map((m, i) => (
              <div
                key={i}
                className={`practice-msg-row practice-msg-row--${m.role}`}
              >
                <span className="practice-avatar">
                  {m.role === "user" ? "我" : "AI"}
                </span>
                <div className={`practice-msg-bubble practice-msg-bubble--${m.role}`}>
                  {m.role === "ai" ? (
                    m.content ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeKatex]}
                        components={{
                          a: ({ href, children }) => (
                            <a href={href} target="_blank" rel="noopener noreferrer">
                              {children}
                            </a>
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    ) : (
                      <Text type="secondary">
                        {chatting && i === msgs.length - 1 ? "思考中…" : ""}
                      </Text>
                    )
                  ) : (
                    m.content
                  )}
                </div>
              </div>
            ))
          )}

          {report && (
            <Card
              size="small"
              title={`评估结果：${report.score} 分`}
              style={{ alignSelf: "stretch" }}
            >
              <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                  {report.report}
                </ReactMarkdown>
              </div>
            </Card>
          )}
        </div>

        <div className="practice-composer">
          {meta?.template && msgs.length === 0 && (
            <div style={{ marginBottom: 8 }}>
              <Button
                size="small"
                icon={<BulbOutlined />}
                onClick={() => setInput(meta.template)}
              >
                填入示例文本
              </Button>
            </div>
          )}
          <div className="practice-composer__row">
            <TextArea
              rows={inputKind === "code" ? 3 : 2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              style={inputKind === "code" ? { fontFamily: "monospace" } : undefined}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              className="practice-composer__send"
              type="primary"
              icon={<SendOutlined />}
              loading={chatting}
              onClick={send}
            >
              发送
            </Button>
          </div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              size="small"
              icon={<BarChartOutlined />}
              loading={evaluating}
              onClick={evaluate}
              disabled={!hasAnswers}
            >
              提交并查看评估结果
            </Button>
            {!hasAnswers && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {getScenarioAnswerMode(scenario) === "qa" ? "请先回答 AI 的提问" : "请先提交作品/代码"}
              </Text>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
