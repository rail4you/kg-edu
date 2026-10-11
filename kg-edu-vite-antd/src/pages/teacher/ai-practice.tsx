import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  App,
  Button,
  Card,
  Descriptions,
  Drawer,
  Empty,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import {
  ArrowLeftOutlined,
  EyeOutlined,
  ReloadOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listUsers } from "@/lib/ash_rpc";
import { fetchTeacherPortals, type PortalBlock, type SmartPortalConfig } from "@/lib/smart-portal";
import {
  SCENARIOS,
  fetchPracticeAttempts,
  type PracticeAttemptRecord,
} from "@/lib/practice";
import TeacherSessionManager from "@/components/practice/TeacherSessionManager";
import { AppPage } from "@/components/proto";

const { Text, Paragraph } = Typography;

interface StudentOption {
  id: string;
  name?: string;
  email?: string;
}

interface StudentRow {
  key: string;
  student?: StudentOption;
  attempt: PracticeAttemptRecord | null;
}

function scenarioName(key: string): string {
  return SCENARIOS.find((s) => s.key === key)?.name || key;
}

function fmtTime(v?: string): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN", { hour12: false });
}

export default function AiPractice() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const headers = useMemo(() => getAuthHeaders(user) as Record<string, string>, [user]);
  const teacherId = user?.id as string | undefined;

  const [portals, setPortals] = useState<SmartPortalConfig[]>([]);
  const [loadingPortals, setLoadingPortals] = useState(true);
  const [portalId, setPortalId] = useState<string>();
  const [attempts, setAttempts] = useState<PracticeAttemptRecord[]>([]);
  const [loadingAttempts, setLoadingAttempts] = useState(false);
  const [activeTab, setActiveTab] = useState<string>();
  const [viewing, setViewing] = useState<PracticeAttemptRecord | null>(null);

  const { data: students = [] } = useQuery({
    queryKey: ["ai-practice-students", tenant],
    enabled: !!tenant,
    queryFn: async () => {
      const r = await listUsers({
        tenant,
        fields: ["id", "name", "email"],
        filter: { role: { eq: "user" } },
        sort: "+name",
        headers,
      });
      if (!(r as any)?.success) return [];
      const data = (r as any).data;
      return (Array.isArray(data) ? data : []) as StudentOption[];
    },
  });

  const portal = useMemo(
    () => portals.find((p) => p.id === portalId) || portals[0],
    [portals, portalId]
  );
  const practiceBlocks = useMemo(
    () => (portal?.layout.blocks || []).filter((b) => b.type === "ai-practice"),
    [portal]
  );

  const studentMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  // 门户是按学生分配的：只统计/展示分配给该门户的学生数据
  const portalStudentIds = useMemo(() => portal?.studentIds || [], [portal]);
  const portalAttempts = useMemo(
    () => attempts.filter((a) => a.userId && portalStudentIds.includes(a.userId)),
    [attempts, portalStudentIds]
  );

  const loadPortals = async () => {
    if (!teacherId) {
      setLoadingPortals(false);
      return;
    }
    setLoadingPortals(true);
    try {
      setPortals(await fetchTeacherPortals(teacherId, headers));
    } catch (e) {
      message.error((e as Error)?.message || "加载智慧门户失败");
    } finally {
      setLoadingPortals(false);
    }
  };

  const loadAttempts = async () => {
    if (!tenant) return;
    setLoadingAttempts(true);
    try {
      setAttempts(await fetchPracticeAttempts({ tenant, headers }));
    } finally {
      setLoadingAttempts(false);
    }
  };

  useEffect(() => {
    loadPortals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId]);

  useEffect(() => {
    loadAttempts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  useEffect(() => {
    if (portals.length && !portals.some((p) => p.id === portalId)) setPortalId(portals[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portals]);

  useEffect(() => {
    if (practiceBlocks.length && !practiceBlocks.some((b) => b.id === activeTab)) {
      setActiveTab(practiceBlocks[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceBlocks]);

  const nameOf = (id?: string | null) => {
    if (!id) return "未知学生";
    const s = studentMap.get(id);
    return s?.name || s?.email || `${id.slice(0, 8)}…`;
  };

  const rowsFor = (block: PortalBlock): StudentRow[] => {
    const scenario = String(block.config.scenario || "dialogue");
    const byUser = new Map<string, PracticeAttemptRecord>();
    portalAttempts
      .filter((a) => a.scenario === scenario && a.userId)
      .forEach((a) => {
        const key = a.userId as string;
        const prev = byUser.get(key);
        if (!prev || (a.insertedAt || "") > (prev.insertedAt || "")) byUser.set(key, a);
      });

    // 只包含分配到该门户的学生
    return portalStudentIds.map((id) => ({
      key: id,
      student: studentMap.get(id),
      attempt: byUser.get(id) || null,
    }));
  };

  const studentNamesOf = (p: SmartPortalConfig): string => {
    const ids = p.studentIds || [];
    if (!ids.length) return "未分配学生";
    return ids
      .map((id) => studentMap.get(id)?.name || studentMap.get(id)?.email || `${id.slice(0, 8)}…`)
      .join("、");
  };

  const columns = [
    {
      title: "学生",
      key: "student",
      render: (_: unknown, row: StudentRow) => (
        <Space>
          <TeamOutlined style={{ color: "#8c8c8c" }} />
          <span>{row.student?.name || row.student?.email || nameOf(row.key)}</span>
        </Space>
      ),
    },
    {
      title: "状态",
      key: "status",
      width: 100,
      render: (_: unknown, row: StudentRow) =>
        row.attempt ? <Tag color="green">已提交</Tag> : <Tag>未提交</Tag>,
    },
    {
      title: "得分",
      key: "score",
      width: 90,
      render: (_: unknown, row: StudentRow) =>
        row.attempt?.score != null ? (
          <Text strong style={{ color: row.attempt.score >= 60 ? "#389e0d" : "#d46b08" }}>
            {row.attempt.score}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "AI 评估报告",
      key: "report",
      render: (_: unknown, row: StudentRow) =>
        row.attempt?.report ? (
          <Text type="secondary" ellipsis style={{ maxWidth: 360 }}>
            {row.attempt.report.replace(/[#*`>\n]/g, " ").slice(0, 60)}
          </Text>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "提交时间",
      key: "time",
      width: 180,
      render: (_: unknown, row: StudentRow) => (
        <Text type="secondary">{fmtTime(row.attempt?.insertedAt)}</Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: 120,
      render: (_: unknown, row: StudentRow) => (
        <Button
          size="small"
          type="link"
          icon={<EyeOutlined />}
          disabled={!row.attempt}
          onClick={() => row.attempt && setViewing(row.attempt)}
        >
          查看对话
        </Button>
      ),
    },
  ];

  const tabItems = practiceBlocks.map((block) => {
    const scenario = String(block.config.scenario || "dialogue");
    const preset = (block.config.preset as string) || "";
    const isStory = scenario === "interactive_story";
    return {
      key: block.id,
      label: (
        <Space size={6}>
          {scenarioName(scenario)}
          {preset ? <Tag style={{ marginInlineEnd: 0 }}>{preset}</Tag> : null}
        </Space>
      ),
      children: isStory ? (
        <TeacherSessionManager />
      ) : portalStudentIds.length === 0 ? (
        <Empty
          description="该门户尚未分配学生，请先在「智慧门户」中把门户分配给指定学生"
          style={{ padding: 32 }}
        >
          <Button type="primary" onClick={() => navigate("/teacher/dashboard/smart-portal")}>
            去分配学生
          </Button>
        </Empty>
      ) : (
        <Table<StudentRow>
          rowKey="key"
          size="small"
          loading={loadingAttempts}
          dataSource={rowsFor(block)}
          columns={columns}
          pagination={false}
          locale={{ emptyText: <Empty description="暂无学生数据" style={{ padding: 24 }} /> }}
        />
      ),
    };
  });

  return (
    <AppPage
      title="AI 实践"
      description="按智慧门户的 AI 实践内容与学生查看对话记录、报告与成绩"
      actions={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadAttempts} loading={loadingAttempts}>
            刷新
          </Button>
          <Button
            icon={<SettingOutlined />}
            onClick={() => navigate("/teacher/dashboard/smart-portal")}
          >
            管理门户
          </Button>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} />
        </Space>
      }
    >
      {loadingPortals ? null : portals.length === 0 ? (
        <Card>
          <Empty description="你还没有创建智慧门户，请先在「智慧门户」中配置 AI 实践内容">
            <Button type="primary" onClick={() => navigate("/teacher/dashboard/smart-portal")}>
              去创建门户
            </Button>
          </Empty>
        </Card>
      ) : (
        <>
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space wrap size={16} align="center">
              <Text strong>智慧门户：</Text>
              <Select
                style={{ width: 360 }}
                value={portal?.id}
                onChange={setPortalId}
                options={portals.map((p) => ({
                  label: `${p.name}${p.enabled ? "" : "（停用）"} · ${studentNamesOf(p)}`,
                  value: p.id,
                }))}
              />
              <Text type="secondary" style={{ fontSize: 12 }}>
                共 {practiceBlocks.length} 项 AI 实践
              </Text>
            </Space>
          </Card>

          {practiceBlocks.length === 0 ? (
            <Card>
              <Empty description="该门户还没有配置 AI 实践组件">
                <Button type="primary" onClick={() => navigate("/teacher/dashboard/smart-portal")}>
                  去配置
                </Button>
              </Empty>
            </Card>
          ) : (
            <Card size="small">
              <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
            </Card>
          )}
        </>
      )}

      <Drawer
        title={viewing ? `${nameOf(viewing.userId)} · ${scenarioName(viewing.scenario)}` : "实践详情"}
        width={760}
        open={!!viewing}
        onClose={() => setViewing(null)}
        destroyOnHidden
      >
        {viewing && (
          <>
            <Descriptions size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="得分">
                <Text strong>{viewing.score ?? "-"}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="提交时间">{fmtTime(viewing.insertedAt)}</Descriptions.Item>
            </Descriptions>

            <Text strong>对话记录</Text>
            <div
              style={{
                marginTop: 8,
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                padding: 12,
                background: "#fafafa",
                maxHeight: 360,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {viewing.transcript.length === 0 && <Text type="secondary">（无对话记录）</Text>}
              {viewing.transcript.map((m, i) => {
                const isUser = m.role === "user" || m.role === "student";
                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: "85%",
                      background: isUser ? "#1890ff" : "white",
                      color: isUser ? "white" : undefined,
                      border: !isUser ? "1px solid #e0e0e0" : undefined,
                      borderRadius: 8,
                      padding: "8px 12px",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 2 }}>
                      {m.role === "user"
                        ? nameOf(viewing.userId)
                        : m.role === "teacher"
                          ? "教师"
                          : m.role === "student"
                            ? "学生"
                            : "AI"}
                    </div>
                    {m.content}
                  </div>
                );
              })}
            </div>

            <div style={{ marginTop: 16 }}>
              <Text strong>AI 评估报告</Text>
              <Card size="small" style={{ marginTop: 8 }}>
                {viewing.report ? (
                  <div style={{ fontSize: 14, lineHeight: 1.7 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewing.report}</ReactMarkdown>
                  </div>
                ) : (
                  <Paragraph type="secondary" style={{ margin: 0 }}>
                    暂无报告
                  </Paragraph>
                )}
              </Card>
            </div>
          </>
        )}
      </Drawer>
    </AppPage>
  );
}
