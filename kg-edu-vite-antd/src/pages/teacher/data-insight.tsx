import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Card,
  Button,
  Typography,
  Spin,
  Input,
  Table,
  Space,
  Tag,
  message,
  Row,
  Col,
  Divider,
  Select,
  Checkbox,
  Modal,
  Popconfirm,
  Empty,
  InputNumber,
  Tooltip,
} from "antd";
import { ArrowLeftOutlined, SendOutlined, PrinterOutlined, ReloadOutlined, DownloadOutlined, SaveOutlined, DeleteOutlined, DatabaseOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  askDataQuestion,
  buildDataReport,
  buildDataTable,
  createReportTemplate,
  listReportTemplates,
  deleteReportTemplate,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text, Paragraph } = Typography;

const QUICK_QUESTIONS = [
  "数据总览",
  "各课程知识点分布",
  "知识点分类分布",
  "作业分布",
  "考试分布",
  "课堂活动分布",
];

const KPI_COLORS = [
  "#1890ff",
  "#722ed1",
  "#eb2f96",
  "#13c2c2",
  "#fa8c16",
  "#52c41a",
  "#2f54eb",
  "#f5222d",
  "#a0d911",
];

function ChartBlock({ option }: { option: any }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !option) return;
    const chart = echarts.init(ref.current);
    chart.setOption(option);
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
    };
  }, [option]);
  if (!option) return null;
  return <div ref={ref} style={{ height: 300 }} />;
}

/** 把问答返回的 [label, value] 行构造成柱状图 option */
function answerChartOption(answer: any) {
  const cols: string[] = answer?.columns || [];
  const rows: any[] = answer?.rows || [];
  if (cols.length < 2 || rows.length === 0) return null;
  const [labelCol, valueCol] = cols;
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: rows.map((r) => String(r[0] ?? "-")), axisLabel: { interval: 0, rotate: rows.length > 6 ? 30 : 0 } },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: rows.map((r) => r[1] ?? 0), itemStyle: { color: "#1890ff", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 40 }],
  };
}

export default function DataInsight() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  // —— 数据总览 KPI ——
  const [kpis, setKpis] = useState<any[]>([]);
  const [overviewSummary, setOverviewSummary] = useState("");
  const [overviewInsight, setOverviewInsight] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const r = await askDataQuestion({ tenant, input: { question: "数据总览", days: 30 }, headers });
      if (r.success && r.data) {
        setKpis(r.data.kpis || []);
        setOverviewSummary(r.data.summary || "");
        setOverviewInsight(r.data.ai_insight || "");
      }
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadOverview();
  }, [user]);

  // —— AI 问答 ——
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<any>(null);

  const doAsk = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setAsking(true);
    try {
      const r = await askDataQuestion({ tenant, input: { question: text, days: 30 }, headers });
      if (r.success && r.data) setAnswer(r.data);
      else message.error("查询失败");
    } finally {
      setAsking(false);
    }
  };

  // —— AI 报告 ——
  const [theme, setTheme] = useState("课程与知识点分析");
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  // 大纲调整：首次生成后允许编辑再重新生成
  const [outline, setOutline] = useState<any[] | null>(null);
  const [outlineEditing, setOutlineEditing] = useState(false);
  const [outlineDraft, setOutlineDraft] = useState<string>("");
  const [reportTemplateName, setReportTemplateName] = useState("");
  const [saveReportTemplateModal, setSaveReportTemplateModal] = useState(false);

  // —— AI 数据报表 ——
  const DATASETS: Array<{ value: string; label: string; desc: string; columns: string[] }> = [
    { value: "upload", label: "资源上传量统计", desc: "各院系资源上传量", columns: ["院系", "上传量"] },
    { value: "signin", label: "课程签到率", desc: "学生签到情况", columns: ["姓名", "院系", "签到次数"] },
    { value: "activity", label: "课堂活动统计", desc: "各类课堂活动次数", columns: ["活动类型", "次数"] },
    { value: "course", label: "课程知识点统计", desc: "各课程关联知识点数", columns: ["课程", "知识点数"] },
    { value: "homework", label: "作业统计", desc: "各课程作业数", columns: ["课程", "作业数"] },
    { value: "exam", label: "考试统计", desc: "各课程考试数", columns: ["课程", "考试数"] },
    { value: "knowledge", label: "知识点分类统计", desc: "各分类知识点数", columns: ["分类", "知识点数"] },
  ];
  const [tableDataset, setTableDataset] = useState("upload");
  const [tableDays, setTableDays] = useState(30);
  const [tableFields, setTableFields] = useState<string[]>(["院系", "上传量"]);
  const [tableSortBy, setTableSortBy] = useState<string | undefined>();
  const [tableSortDir, setTableSortDir] = useState("desc");
  const [tableData, setTableData] = useState<any>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [saveTableTemplateModal, setSaveTableTemplateModal] = useState(false);

  const loadTemplates = async () => {
    setTemplateLoading(true);
    try {
      const r = await listReportTemplates({ tenant, fields: ["id", "name", "kind", "config"], headers });
      const data = r.success ? (r.data as any) : null;
      const list = Array.isArray(data) ? data : data?.results || [];
      setTemplates(list);
    } finally {
      setTemplateLoading(false);
    }
  };

  const activeDataset = DATASETS.find((d) => d.value === tableDataset)!;

  const genReport = async () => {
    if (!theme.trim()) return;
    setReportLoading(true);
    try {
      const r = await buildDataReport({ tenant, input: { theme: theme.trim(), days: 30, outline: outline || undefined }, headers });
      if (r.success && r.data) {
        setReport(r.data);
        setOutline(r.data.outline || null);
        setOutlineEditing(false);
      } else message.error("生成失败");
    } finally {
      setReportLoading(false);
    }
  };

  const openOutlineEditor = () => {
    if (!outline) return;
    setOutlineDraft(JSON.stringify(outline, null, 2));
    setOutlineEditing(true);
  };

  const applyOutline = async () => {
    let parsed: any[];
    try {
      parsed = JSON.parse(outlineDraft);
      if (!Array.isArray(parsed)) throw new Error("非数组");
    } catch {
      message.error("大纲 JSON 格式有误");
      return;
    }
    setOutline(parsed);
    setOutlineEditing(false);
    // 用调整后的大纲重新生成
    setReportLoading(true);
    try {
      const r = await buildDataReport({ tenant, input: { theme: theme.trim(), days: 30, outline: parsed }, headers });
      if (r.success && r.data) {
        setReport(r.data);
        setOutline(r.data.outline || parsed);
      } else message.error("重新生成失败");
    } finally {
      setReportLoading(false);
    }
  };

  const saveReportTemplate = async () => {
    if (!reportTemplateName.trim()) {
      message.warning("请输入模板名称");
      return;
    }
    const r = await createReportTemplate({
      tenant,
      input: { name: reportTemplateName.trim(), kind: "report", config: { theme: theme.trim(), outline } },
      fields: ["id"],
      headers,
    });
    if (r.success) {
      message.success("报告模板已保存");
      setSaveReportTemplateModal(false);
      setReportTemplateName("");
      loadTemplates();
    } else message.error("保存失败");
  };

  const genTable = async () => {
    setTableLoading(true);
    try {
      const r = await buildDataTable({
        tenant,
        input: { dataset: tableDataset, days: tableDays, fields: tableFields, sortBy: tableSortBy, sortDir: tableSortDir },
        headers,
      });
      if (r.success && r.data) setTableData(r.data);
      else message.error("生成报表失败");
    } finally {
      setTableLoading(false);
    }
  };

  const exportTable = () => {
    if (!tableData || !tableData.columns?.length) {
      message.warning("请先生成报表");
      return;
    }
    const cols = tableData.columns as string[];
    const rows = (tableData.rows || []) as Record<string, any>[];
    const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => String(r[c] ?? "")).join(","))];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tableDataset}_${tableDays}天.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("已导出 CSV");
  };

  const saveTableTemplate = async () => {
    if (!templateName.trim()) {
      message.warning("请输入模板名称");
      return;
    }
    const r = await createReportTemplate({
      tenant,
      input: {
        name: templateName.trim(),
        kind: "table",
        config: { dataset: tableDataset, days: tableDays, fields: tableFields, sortBy: tableSortBy, sortDir: tableSortDir },
      },
      fields: ["id"],
      headers,
    });
    if (r.success) {
      message.success("报表模板已保存");
      setSaveTableTemplateModal(false);
      setTemplateName("");
      loadTemplates();
    } else message.error("保存失败");
  };

  const applyTableTemplate = (t: any) => {
    const cfg = t.config || {};
    if (cfg.dataset) setTableDataset(cfg.dataset);
    if (cfg.days) setTableDays(cfg.days);
    if (Array.isArray(cfg.fields)) setTableFields(cfg.fields);
    if (cfg.sortBy) setTableSortBy(cfg.sortBy);
    if (cfg.sortDir) setTableSortDir(cfg.sortDir);
    message.success(`已应用模板：${t.name}`);
  };

  useEffect(() => {
    if (user) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const answerCols = (answer?.columns || []).map((c: string) => ({
    title: c,
    dataIndex: c,
    key: c,
    render: (v: any) => String(v ?? "-"),
  }));
  const answerRows = (answer?.rows || []).map((r: any[], i: number) => {
    const obj: any = { key: i };
    (answer.columns || []).forEach((c: string, j: number) => (obj[c] = r[j]));
    return obj;
  });

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
        <Title level={4} style={{ margin: 0 }}>AI 数据智能</Title>
        <Text type="secondary" style={{ marginLeft: 8 }}>基于教学运行数据的智能问答与统计报告</Text>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        {/* 数据总览 */}
        <Card
          title="数据总览"
          loading={overviewLoading}
          extra={
            <Button type="link" icon={<ReloadOutlined />} size="small" onClick={loadOverview}>
              刷新
            </Button>
          }
        >
          {overviewSummary && <Paragraph style={{ marginBottom: 16 }}>{overviewSummary}</Paragraph>}
          <Row gutter={[12, 12]}>
            {kpis.map((k, i) => (
              <Col xs={8} sm={6} md={4} key={k.label || i}>
                <div style={{ border: "1px solid #f0f0f0", borderRadius: 10, padding: "14px 10px", textAlign: "center", background: "#fafafa" }}>
                  <div style={{ fontSize: 30, fontWeight: 700, color: KPI_COLORS[i % KPI_COLORS.length] }}>
                    {k.value}
                    <span style={{ fontSize: 13, fontWeight: 400, color: "#999", marginLeft: 2 }}>{k.suffix}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{k.label}</div>
                </div>
              </Col>
            ))}
          </Row>
          {overviewInsight && (
            <Card size="small" title="AI 解读" style={{ marginTop: 16, background: "#f6f0ff" }}>
              <Paragraph style={{ margin: 0 }}>{overviewInsight}</Paragraph>
            </Card>
          )}
        </Card>

        {/* AI 数据问答 */}
        <Card title="AI 数据问答" style={{ marginTop: 16 }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPressEnter={() => doAsk()}
              placeholder="输入问题，如：各课程知识点分布"
            />
            <Button type="primary" icon={<SendOutlined />} loading={asking} onClick={() => doAsk()}>
              提问
            </Button>
          </Space.Compact>
          <div style={{ marginTop: 8 }}>
            {QUICK_QUESTIONS.map((q) => (
              <Button key={q} type="link" size="small" onClick={() => { setQuestion(q); doAsk(q); }}>
                {q}
              </Button>
            ))}
          </div>
          {answer && (
            <div style={{ marginTop: 16 }}>
              <Paragraph strong>{answer.summary}</Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <ChartBlock option={answerChartOption(answer)} />
                </Col>
                <Col xs={24} md={12}>
                  {answerRows.length > 0 && (
                    <Table size="small" columns={answerCols} dataSource={answerRows} pagination={answerRows.length > 10 ? { pageSize: 10 } : false} />
                  )}
                </Col>
              </Row>
              {answer.ai_insight && (
                <Card size="small" title="AI 解读" style={{ marginTop: 12, background: "#f6f0ff" }}>
                  <Paragraph style={{ margin: 0 }}>{answer.ai_insight}</Paragraph>
                </Card>
              )}
            </div>
          )}
        </Card>

        {/* AI 数据报告 */}
        <Card title="AI 数据报告" style={{ marginTop: 16 }}>
          <Space.Compact style={{ width: "100%" }}>
            <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="分析主题，如：课程与知识点分析" onPressEnter={genReport} />
            <Button type="primary" loading={reportLoading} onClick={genReport}>
              生成报告
            </Button>
            {outline && (
              <>
                <Button onClick={openOutlineEditor}>调整大纲</Button>
                <Button icon={<SaveOutlined />} onClick={() => setSaveReportTemplateModal(true)}>保存模板</Button>
              </>
            )}
          </Space.Compact>
          <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            系统会根据主题自动生成包含文字解读、统计图与数据表的报告（基于课程、知识点、作业、考试、课堂活动等真实数据）。
            支持对生成的大纲进行调整后重新生成，并可保存为模板复用。
          </Text>

          {report?.sections?.map((s: any, i: number) => (
            <Card key={i} size="small" title={<span>{i + 1}. {s.title}　{s.dataset && <Tag color="blue">{s.dataset}</Tag>}</span>} style={{ marginTop: 16 }}>
              <Paragraph style={{ color: "#555" }}>{s.text}</Paragraph>
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <ChartBlock option={s.chart} />
                </Col>
                <Col xs={24} md={12}>
                  <Table
                    size="small"
                    pagination={false}
                    columns={(s.table?.columns || []).map((c: string) => ({ title: c, dataIndex: c, key: c, render: (v: any) => String(v ?? "-") }))}
                    dataSource={(s.table?.rows || []).slice(0, 20).map((r: any, j: number) => ({ key: j, ...r }))}
                  />
                </Col>
              </Row>
            </Card>
          ))}
          {report && (
            <Divider style={{ marginTop: 24 }}>报表与统计图已由 AI 基于真实数据生成</Divider>
          )}
        </Card>

        {report && (
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
              导出 PDF（打印）
            </Button>
          </div>
        )}

        {/* AI 数据报表 */}
        <Card
          title={<span><DatabaseOutlined /> AI 数据报表（自定义时间范围 / 导出字段 / 排序 / 模板）</span>}
          style={{ marginTop: 16 }}
          extra={<Tag color="blue">上传量 · 签到 · 活动等 7 类数据集</Tag>}
        >
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Text strong>数据集</Text>
              <Select
                style={{ width: "100%", marginTop: 4 }}
                value={tableDataset}
                onChange={(v) => { setTableDataset(v); const d = DATASETS.find((x) => x.value === v)!; setTableFields(d.columns); }}
                options={DATASETS.map((d) => ({ value: d.value, label: d.label }))}
              />
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 4 }}>{activeDataset.desc}</Text>
            </Col>
            <Col xs={24} md={8}>
              <Text strong>统计时间范围（近 N 天）</Text>
              <InputNumber min={1} max={365} value={tableDays} onChange={(v) => setTableDays(v || 30)} style={{ width: "100%", marginTop: 4 }} />
            </Col>
            <Col xs={24} md={8}>
              <Text strong>排序</Text>
              <Space style={{ width: "100%", marginTop: 4 }}>
                <Select
                  style={{ width: "60%" }}
                  placeholder="默认"
                  value={tableSortBy}
                  onChange={setTableSortBy}
                  allowClear
                  options={activeDataset.columns.map((c) => ({ value: c, label: c }))}
                />
                <Select value={tableSortDir} onChange={setTableSortDir} style={{ width: "40%" }} options={[
                  { value: "asc", label: "升序" },
                  { value: "desc", label: "降序" },
                ]} />
              </Space>
            </Col>
          </Row>
          <div style={{ marginTop: 12 }}>
            <Text strong>导出字段</Text>
            <div style={{ marginTop: 4 }}>
              <Checkbox.Group
                value={tableFields}
                onChange={(v) => setTableFields(v as string[])}
                options={activeDataset.columns.map((c) => ({ label: c, value: c }))}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <Button type="primary" icon={<SendOutlined />} loading={tableLoading} onClick={genTable}>
              生成报表
            </Button>
            <Button icon={<DownloadOutlined />} onClick={exportTable}>导出 CSV</Button>
            <Button icon={<SaveOutlined />} onClick={() => setSaveTableTemplateModal(true)}>保存模板</Button>
            <Button icon={<ReloadOutlined />} loading={templateLoading} onClick={loadTemplates}>刷新模板</Button>
          </div>

          {tableData && (
            <div style={{ marginTop: 16 }}>
              <Divider style={{ margin: "0 0 12px" }} />
              <Table
                size="small"
                rowKey={(_, i) => String(i)}
                pagination={tableData.rows?.length > 15 ? { pageSize: 15 } : false}
                columns={(tableData.columns || []).map((c: string) => ({ title: c, dataIndex: c, key: c, render: (v: any) => String(v ?? "-") }))}
                dataSource={(tableData.rows || []).map((r: any, j: number) => ({ key: j, ...r }))}
              />
              <Text type="secondary" style={{ display: "block", marginTop: 8, fontSize: 12 }}>
                共 {tableData.rows?.length || 0} 条记录
              </Text>
            </div>
          )}

          {templates.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Text strong>已保存模板</Text>
              <Table
                size="small"
                rowKey="id"
                style={{ marginTop: 8 }}
                pagination={false}
                dataSource={templates}
                columns={[
                  { title: "名称", dataIndex: "name" },
                  { title: "类型", dataIndex: "kind", width: 90, render: (k: string) => <Tag color={k === "report" ? "purple" : "blue"}>{k === "report" ? "报告" : "报表"}</Tag> },
                  { title: "配置", dataIndex: "config", render: (c: any) => <Text type="secondary" style={{ fontSize: 12 }}>{JSON.stringify(c || {})}</Text> },
                  {
                    title: "操作",
                    width: 160,
                    render: (_: any, t: any) => (
                      <Space size={4}>
                        {t.kind === "table" && (
                          <Button type="link" size="small" onClick={() => applyTableTemplate(t)}>应用</Button>
                        )}
                        <Popconfirm title="确认删除该模板？" onConfirm={async () => {
                          await deleteReportTemplate({ tenant, primaryKey: t.id, headers });
                          loadTemplates();
                        }}>
                          <Button type="link" size="small" danger icon={<DeleteOutlined />} />
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      {/* 报告大纲调整 */}
      <Modal
        title="调整报告大纲"
        open={outlineEditing}
        onCancel={() => setOutlineEditing(false)}
        onOk={applyOutline}
        okText="应用并重新生成"
        cancelText="取消"
        width={720}
      >
        <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          大纲为 JSON 数组，每个元素含 title / description / dataset 字段，可增删改章节后重新生成报告。
        </Text>
        <Input.TextArea rows={12} value={outlineDraft} onChange={(e) => setOutlineDraft(e.target.value)} style={{ fontFamily: "monospace", fontSize: 12 }} />
      </Modal>

      {/* 保存报告模板 */}
      <Modal
        title="保存报告模板"
        open={saveReportTemplateModal}
        onCancel={() => setSaveReportTemplateModal(false)}
        onOk={saveReportTemplate}
        okText="保存"
        cancelText="取消"
      >
        <Input value={reportTemplateName} onChange={(e) => setReportTemplateName(e.target.value)} placeholder="模板名称，如：学期课堂活动分析" />
      </Modal>

      {/* 保存报表模板 */}
      <Modal
        title="保存报表模板"
        open={saveTableTemplateModal}
        onCancel={() => setSaveTableTemplateModal(false)}
        onOk={saveTableTemplate}
        okText="保存"
        cancelText="取消"
      >
        <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="模板名称，如：各院系资源上传量月报" />
      </Modal>
    </div>
  );
}