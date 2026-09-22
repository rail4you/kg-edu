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
  Tabs,
  Space,
  Select,
  InputNumber,
  Checkbox,
  message,
  Row,
  Col,
  List,
  Divider,
} from "antd";
import { ArrowLeftOutlined, SendOutlined, PrinterOutlined, SaveOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  askDataQuestion,
  buildDataReport,
  buildDataTable,
  createReportTemplate,
  listReportTemplates,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text, Paragraph } = Typography;

const QUICK_QUESTIONS = [
  "某院系近1个月课程签到率",
  "各院系资源上传量统计",
  "本学期课堂活动开展情况",
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

export default function DataInsight() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  // —— 问答 ——
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

  // —— 报告 ——
  const [theme, setTheme] = useState("某学期课堂活动开展情况分析");
  const [outline, setOutline] = useState<Array<{ title: string; dataset: string; description: string }>>([]);
  const [report, setReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const genOutline = async () => {
    setReportLoading(true);
    try {
      const r = await buildDataReport({ tenant, input: { theme, days: 30 }, headers });
      if (r.success && r.data) {
        const d = r.data as any;
        setOutline(d.outline || []);
        setReport(d);
      } else message.error("生成失败");
    } finally {
      setReportLoading(false);
    }
  };

  const regenWithOutline = async () => {
    setReportLoading(true);
    try {
      const r = await buildDataReport({
        tenant,
        input: { theme, days: 30, outline: outline as any },
        headers,
      });
      if (r.success && r.data) setReport(r.data);
      else message.error("生成失败");
    } finally {
      setReportLoading(false);
    }
  };

  // —— 报表 ——
  const [dataset, setDataset] = useState("upload");
  const [days, setDays] = useState(30);
  const [tableData, setTableData] = useState<any>(null);
  const [tableLoading, setTableLoading] = useState(false);

  const genTable = async () => {
    setTableLoading(true);
    try {
      const r = await buildDataTable({
        tenant,
        input: { dataset, days, sortDir: "desc" },
        headers,
      });
      if (r.success && r.data) setTableData(r.data);
      else message.error((r as any)?.errors?.[0]?.message || "生成失败");
    } finally {
      setTableLoading(false);
    }
  };

  const exportCsv = () => {
    if (!tableData) return;
    const cols: string[] = tableData.columns;
    const lines = [cols.join(",")].concat(
      tableData.rows.map((row: any) => cols.map((c) => JSON.stringify(row[c] ?? "")).join(",")),
    );
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${dataset}-报表.csv`;
    a.click();
  };

  const saveTemplate = async (kind: "report" | "table", name: string, config: any) => {
    const r = await createReportTemplate({ tenant, input: { name, kind, config }, fields: ["id", "name"], headers });
    if (r.success) {
      message.success("模板已保存");
      refetchTemplates();
    } else message.error("保存失败");
  };

  const { data: templates, refetch: refetchTemplates } = useQuery({
    queryKey: ["report-templates"],
    queryFn: async () => {
      const r = await listReportTemplates({ tenant, fields: ["id", "name", "kind", "config"], headers });
      return r.success ? (r.data as any[]) : [];
    },
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

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

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", paddingBottom: 24 }}>
      <style>{`@media print {.data-insight-noprint { display: none !important; }}`}</style>
      <div className="data-insight-noprint" style={{ padding: 24, background: "white", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>AI 数据智能</Title>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Tabs
          defaultActiveKey="qa"
          items={[
            {
              key: "qa",
              label: "AI 数据问答",
              children: (
                <Card>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onPressEnter={() => doAsk()}
                      placeholder="如：某院系近1个月课程签到率"
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
                      {answerRows.length > 0 && (
                        <Table size="small" columns={answerCols} dataSource={answerRows.slice(0, 50)} pagination={{ pageSize: 10 }} />
                      )}
                      {answer.ai_insight && (
                        <Card size="small" title="AI 解读" style={{ marginTop: 12, background: "#f6f0ff" }}>
                          <Paragraph>{answer.ai_insight}</Paragraph>
                        </Card>
                      )}
                    </div>
                  )}
                </Card>
              ),
            },
            {
              key: "report",
              label: "AI 数据报告",
              children: (
                <>
                  <Card className="data-insight-noprint">
                    <Space.Compact style={{ width: "100%" }}>
                      <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="分析主题" />
                      <Button type="primary" loading={reportLoading} onClick={genOutline}>
                        生成大纲与报告
                      </Button>
                    </Space.Compact>
                    {outline.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <Text strong>大纲（可改标题后重新生成）：</Text>
                        {outline.map((o, i) => (
                          <div key={i} style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <Input value={o.title} onChange={(e) => {
                              const n = [...outline];
                              n[i] = { ...n[i], title: e.target.value };
                              setOutline(n);
                            }} />
                            <Select value={o.dataset} onChange={(v) => {
                              const n = [...outline];
                              n[i] = { ...n[i], dataset: v };
                              setOutline(n);
                            }} style={{ width: 140 }} options={["signin", "upload", "activity"].map((d) => ({ value: d, label: d }))} />
                          </div>
                        ))}
                        <Button style={{ marginTop: 8 }} loading={reportLoading} onClick={regenWithOutline}>
                          按调整后大纲重新生成
                        </Button>
                      </div>
                    )}
                  </Card>
                  {report?.sections?.map((s: any, i: number) => (
                    <Card key={i} title={s.title} style={{ marginTop: 16 }}>
                      <Paragraph>{s.text}</Paragraph>
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
                    <div className="data-insight-noprint" style={{ marginTop: 16, display: "flex", gap: 8 }}>
                      <Button icon={<PrinterOutlined />} onClick={() => window.print()}>
                        导出 PDF（打印）
                      </Button>
                      <Button icon={<SaveOutlined />} onClick={() => saveTemplate("report", theme, { theme, outline })}>
                        保存为模板
                      </Button>
                    </div>
                  )}
                </>
              ),
            },
            {
              key: "table",
              label: "AI 数据报表",
              children: (
                <Card>
                  <Space wrap>
                    <Select value={dataset} onChange={setDataset} style={{ width: 200 }} options={[
                      { value: "signin", label: "课程签到明细" },
                      { value: "upload", label: "各院系资源上传量" },
                      { value: "activity", label: "课堂活动统计" },
                    ]} />
                    <span>近 <InputNumber value={days} onChange={(v) => setDays(v || 30)} min={1} max={365} /> 天</span>
                    <Button type="primary" loading={tableLoading} onClick={genTable}>
                      生成报表
                    </Button>
                    {tableData && (
                      <>
                        <Button onClick={exportCsv}>导出 CSV</Button>
                        <Button icon={<PrinterOutlined />} onClick={() => window.print()}>打印</Button>
                        <Button icon={<SaveOutlined />} onClick={() => saveTemplate("table", `${dataset}报表`, { dataset, days })}>
                          保存为模板
                        </Button>
                      </>
                    )}
                  </Space>
                  {tableData && (
                    <Table
                      style={{ marginTop: 16 }}
                      size="small"
                      columns={tableData.columns.map((c: string) => ({ title: c, dataIndex: c, key: c, sorter: (a: any, b: any) => (a[c] > b[c] ? 1 : -1), render: (v: any) => String(v ?? "-") }))}
                      dataSource={tableData.rows.map((r: any, i: number) => ({ key: i, ...r }))}
                    />
                  )}
                  {templates && templates.length > 0 && (
                    <>
                      <Divider>已保存模板</Divider>
                      <List
                        size="small"
                        dataSource={templates}
                        renderItem={(t: any) => (
                          <List.Item
                            actions={[
                              <Button key="load" type="link" size="small" onClick={() => {
                                const c = t.config || {};
                                if (t.kind === "table") {
                                  setDataset(c.dataset || "upload");
                                  setDays(c.days || 30);
                                  message.info("已载入报表模板配置，请点击生成报表");
                                } else {
                                  setTheme(c.theme || "");
                                  setOutline(c.outline || []);
                                  message.info("已载入报告模板，请到报告页生成");
                                }
                              }}>
                                载入
                              </Button>,
                            ]}
                          >
                            <Text>{t.name}</Text>
                            <Text type="secondary" style={{ marginLeft: 8 }}>{t.kind === "table" ? "报表" : "报告"}</Text>
                          </List.Item>
                        )}
                      />
                    </>
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
