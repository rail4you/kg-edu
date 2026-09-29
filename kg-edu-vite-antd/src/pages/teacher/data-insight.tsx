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
} from "antd";
import { ArrowLeftOutlined, SendOutlined, PrinterOutlined, ReloadOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import { askDataQuestion, buildDataReport } from "@/lib/ash_rpc";
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

  const genReport = async () => {
    if (!theme.trim()) return;
    setReportLoading(true);
    try {
      const r = await buildDataReport({ tenant, input: { theme: theme.trim(), days: 30 }, headers });
      if (r.success && r.data) setReport(r.data);
      else message.error("生成失败");
    } finally {
      setReportLoading(false);
    }
  };

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
          </Space.Compact>
          <Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            系统会根据主题自动生成包含文字解读、统计图与数据表的报告（基于课程、知识点、作业、考试、课堂活动等真实数据）。
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
      </div>
    </div>
  );
}