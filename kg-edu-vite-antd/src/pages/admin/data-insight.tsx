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
  Tabs,
  Alert,
  Collapse,
  Dropdown,
} from "antd";
import { ArrowLeftOutlined, SendOutlined, PrinterOutlined, ReloadOutlined, DownloadOutlined, SaveOutlined, DeleteOutlined, DatabaseOutlined, FilePdfOutlined, RobotOutlined, UserOutlined, LoadingOutlined, FileTextOutlined, PlusOutlined, DownOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  askDataQuestion,
  buildDataReport,
  buildDataTable,
  createReportTemplate,
  listReportTemplates,
  deleteReportTemplate,
  listOrganizations,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { AppPage, StatGrid } from "@/components/proto";

const { Title, Text, Paragraph } = Typography;

const QUICK_QUESTIONS = [
  "数据总览",
  "各课程知识点分布",
  "知识点分类分布",
  "作业分布",
  "考试分布",
  "课堂活动分布",
];

const REPORT_THEMES = [
  "第一学期课堂活动开展情况分析",
  "各课程知识点分布分析",
  "作业布置与完成情况分析",
  "考试情况分析",
  "资源使用情况分析",
];

const OUTLINE_DATASETS = [
  { value: "course", label: "课程知识点" },
  { value: "knowledge", label: "知识点分类" },
  { value: "homework", label: "作业" },
  { value: "exam", label: "考试" },
  { value: "activity", label: "课堂活动" },
  { value: "upload", label: "资源上传" },
  { value: "signin", label: "课程签到" },
];

const DATASET_LABELS: Record<string, string> = {
  course: "课程知识点",
  knowledge: "知识点分类",
  homework: "作业",
  exam: "考试",
  activity: "课堂活动",
  upload: "资源上传",
  signin: "课程签到",
  user: "用户",
};
const datasetLabel = (d?: string) => (d ? DATASET_LABELS[d] || d : "");

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

/** 把问答返回的 [label, value] 行构造成柱状图 option */function answerChartOption(answer: any) {
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

/** 智能体对话气泡 */
function AgentBubble({ role, children }: { role: "user" | "ai"; children: React.ReactNode }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
      <div
        style={{
          maxWidth: isUser ? "72%" : "100%",
          width: isUser ? undefined : "100%",
          minWidth: 60,
          background: isUser ? "#1677ff" : "#fff",
          color: isUser ? "#fff" : undefined,
          border: isUser ? "none" : "1px solid #eef1f6",
          borderRadius: 12,
          padding: "10px 14px",
          boxShadow: isUser ? "none" : "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        {!isUser && (
          <div style={{ fontSize: 12, color: "#8c8c8c", marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
            <RobotOutlined /> AI 智能体
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** 问答结果（表格优先） */
function AnswerResult({ answer }: { answer: any }) {
  const cols: string[] = answer?.columns || [];
  const rows: any[] = (answer?.rows || []).map((r: any[], i: number) => {
    const o: any = { key: i };
    cols.forEach((c, j) => (o[c] = r[j]));
    return o;
  });
  return (
    <div>
      {answer?.summary && (
        <Paragraph style={{ marginBottom: 12, color: "#333" }}>{answer.summary}</Paragraph>
      )}
      <Row gutter={16}>
        <Col xs={24} md={rows.length > 0 && answerChartOption(answer) ? 14 : 24}>
          {rows.length > 0 && (
            <Table
              size="small"
              rowKey="key"
              columns={cols.map((c) => ({ title: c, dataIndex: c, key: c, render: (v: any) => String(v ?? "-") }))}
              dataSource={rows}
              pagination={rows.length > 10 ? { pageSize: 10 } : false}
            />
          )}
        </Col>
        <Col xs={24} md={rows.length > 0 && answerChartOption(answer) ? 10 : 24}>
          <ChartBlock option={answerChartOption(answer)} />
        </Col>
      </Row>
      {answer?.ai_insight && (
        <Alert type="info" showIcon message="AI 解读" description={answer.ai_insight} style={{ marginTop: 12 }} />
      )}
    </div>
  );
}

export default function AdminDataInsight() {
  const { user, loading: authLoading } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const [tenant, setTenant] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
  const [reportExporting, setReportExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const { data: orgs } = useQuery({
    queryKey: ["admin-data-insight-orgs"],
    queryFn: async () => {
      const r = await listOrganizations({
        tenant: "public",
        fields: ["id", "name", "schemaName"],
        headers,
      });
      if (!r.success) return [];
      const d = r.data as any;
      return ((Array.isArray(d) ? d : d?.results || []) as any[]).filter((o) => o?.schemaName);
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (tenant || !orgs || orgs.length === 0) return;
    const cur = getCurrentTenant()?.schemaName;
    const match = orgs.find((o: any) => o.schemaName === cur);
    setTenant(match?.schemaName || orgs[0].schemaName);
  }, [orgs, tenant]);

  // —— 数据总览 KPI ——
  const [kpis, setKpis] = useState<any[]>([]);
  const [overviewSummary, setOverviewSummary] = useState("");
  const [overviewInsight, setOverviewInsight] = useState("");
  const [overviewLoading, setOverviewLoading] = useState(false);

  const loadOverview = async () => {
    if (!tenant) return;
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
    if (user && tenant) loadOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenant]);

  // —— AI 问答（智能体对话） ——
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [qaMessages, setQaMessages] = useState<Array<{ role: "user" | "ai"; text?: string; answer?: any; loading?: boolean }>>([]);
  const [qaLoadedFor, setQaLoadedFor] = useState("");

  // 按院系（租户）持久化问答历史，刷新/切换后仍保留
  useEffect(() => {
    if (!tenant) return;
    try {
      const raw = localStorage.getItem(`data-insight-qa:${tenant}`);
      setQaMessages(raw ? JSON.parse(raw) : []);
    } catch {
      setQaMessages([]);
    }
    setQaLoadedFor(tenant);
  }, [tenant]);

  useEffect(() => {
    if (!tenant || qaLoadedFor !== tenant) return;
    try {
      localStorage.setItem(`data-insight-qa:${tenant}`, JSON.stringify(qaMessages));
    } catch {
      /* ignore quota errors */
    }
  }, [qaMessages, tenant, qaLoadedFor]);

  const doAsk = async (q?: string) => {
    const text = (q ?? question).trim();
    if (!text || asking) return;
    setQuestion("");
    setAsking(true);
    setQaMessages((m) => [...m, { role: "user", text }, { role: "ai", loading: true }]);
    try {
      const r = await askDataQuestion({ tenant, input: { question: text, days: 30 }, headers });
      setQaMessages((m) => {
        const next = [...m];
        next[next.length - 1] =
          r.success && r.data ? { role: "ai", answer: r.data } : { role: "ai", text: "查询失败，请重试" };
        return next;
      });
    } finally {
      setAsking(false);
    }
  };

  // —— AI 报告（对话式，多份历史，可折叠） ——
  const [theme, setTheme] = useState("第一学期课堂活动开展情况分析");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportLog, setReportLog] = useState<
    Array<{ role: "user" | "ai"; id: string; text?: string; theme?: string; report?: any; outline?: any; time?: string; loading?: boolean }>
  >([]);
  const [reportLoadedFor, setReportLoadedFor] = useState("");
  const [reportActiveKeys, setReportActiveKeys] = useState<string[]>([]);
  const [editReportId, setEditReportId] = useState<string | null>(null);
  const [outlineEditing, setOutlineEditing] = useState(false);
  const [outlineSections, setOutlineSections] = useState<Array<{ title: string; description?: string; dataset?: string }>>([]);
  const [outlineTemplateName, setOutlineTemplateName] = useState("");

  // 按院系（租户）持久化报告历史
  useEffect(() => {
    if (!tenant) return;
    try {
      const raw = localStorage.getItem(`data-insight-report:${tenant}`);
      const list = raw ? JSON.parse(raw) : [];
      setReportLog(list);
      setReportActiveKeys(list.length ? [list[list.length - 1].id] : []);
    } catch {
      setReportLog([]);
    }
    setReportLoadedFor(tenant);
  }, [tenant]);

  useEffect(() => {
    if (!tenant || reportLoadedFor !== tenant) return;
    try {
      localStorage.setItem(`data-insight-report:${tenant}`, JSON.stringify(reportLog));
    } catch {
      /* ignore */
    }
  }, [reportLog, tenant, reportLoadedFor]);

  // —— AI 数据报表 ——
  const DATASETS: Array<{ value: string; label: string; desc: string; columns: string[] }> = [
    { value: "upload", label: "资源上传量统计", desc: "各院系资源上传量", columns: ["院系", "上传量"] },
    { value: "signin", label: "课程签到率", desc: "各课程分配（签到）情况", columns: ["课程", "签到次数"] },
    { value: "activity", label: "课堂活动统计", desc: "各类课堂活动次数", columns: ["活动类型", "次数"] },
    { value: "course", label: "课程知识点统计", desc: "各课程关联知识点数", columns: ["课程", "知识点数"] },
    { value: "homework", label: "作业统计", desc: "各课程作业数", columns: ["课程", "作业数"] },
    { value: "exam", label: "考试统计", desc: "各课程考试数", columns: ["课程", "考试数"] },
    { value: "knowledge", label: "知识点分类统计", desc: "各分类知识点数", columns: ["分类", "知识点数"] },
  ];
  type TableCfg = { dataset: string; days: number; fields: string[]; sortBy?: string; sortDir: string };
  const [tableLog, setTableLog] = useState<
    Array<{ role: "user" | "ai"; id: string; text?: string; config?: TableCfg; data?: any; loading?: boolean }>
  >([]);
  const [tableLoadedFor, setTableLoadedFor] = useState("");
  const [tableInput, setTableInput] = useState("");
  const [tableActiveKeys, setTableActiveKeys] = useState<string[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [tableTemplateName, setTableTemplateName] = useState("");
  const [tableTemplateId, setTableTemplateId] = useState<string | null>(null);

  // 按院系（租户）持久化报表历史
  useEffect(() => {
    if (!tenant) return;
    try {
      const raw = localStorage.getItem(`data-insight-table:${tenant}`);
      setTableLog(raw ? JSON.parse(raw) : []);
    } catch {
      setTableLog([]);
    }
    setTableLoadedFor(tenant);
  }, [tenant]);

  useEffect(() => {
    if (!tenant || tableLoadedFor !== tenant) return;
    try {
      localStorage.setItem(`data-insight-table:${tenant}`, JSON.stringify(tableLog));
    } catch {
      /* ignore */
    }
  }, [tableLog, tenant, tableLoadedFor]);

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

  const defaultTableCfg = (datasetVal: string): TableCfg => {
    const d = DATASETS.find((x) => x.value === datasetVal) || DATASETS[0];
    return { dataset: d.value, days: 30, fields: d.columns, sortBy: undefined, sortDir: "desc" };
  };

  const matchDataset = (text: string): string => {
    const kw = text.trim();
    const found = DATASETS.find((d) => kw.includes(d.label) || d.label.includes(kw) || kw.includes(d.desc));
    return found?.value || "upload";
  };

  const sendTableRequest = (text: string, datasetVal?: string) => {
    const t = text.trim();
    if (!t) return;
    const ds = datasetVal || matchDataset(t);
    const uid = `u-${Date.now()}`;
    const aid = `a-${Date.now()}`;
    setTableLog((m) => [...m, { role: "user", id: uid, text: t }, { role: "ai", id: aid, config: defaultTableCfg(ds) }]);
  };

  const updateTableCfg = (id: string, patch: Partial<TableCfg>) => {
    setTableLog((m) => m.map((x) => (x.id === id && x.config ? { ...x, config: { ...x.config, ...patch } } : x)));
  };

  const genTableEntry = async (id: string) => {
    const entry = tableLog.find((x) => x.id === id);
    if (!entry?.config) return;
    const cfg = entry.config;
    setTableLog((m) => m.map((x) => (x.id === id ? { ...x, loading: true } : x)));
    try {
      const r = await buildDataTable({
        tenant,
        input: { dataset: cfg.dataset, days: cfg.days, fields: cfg.fields, sortBy: cfg.sortBy, sortDir: cfg.sortDir },
        headers,
      });
      setTableLog((m) => m.map((x) => (x.id === id ? { ...x, loading: false, data: r.success ? r.data : null } : x)));
      if (r.success) setTableActiveKeys((k) => Array.from(new Set([...k, id])));
      if (!r.success) message.error("生成报表失败");
    } catch {
      setTableLog((m) => m.map((x) => (x.id === id ? { ...x, loading: false } : x)));
      message.error("生成报表失败");
    }
  };

  const exportTableEntry = (id: string) => {
    const entry = tableLog.find((x) => x.id === id);
    const data = entry?.data;
    if (!data || !data.columns?.length) {
      message.warning("请先生成报表");
      return;
    }
    const cols = data.columns as string[];
    const rows = (data.rows || []) as Record<string, any>[];
    const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => String(r[c] ?? "")).join(","))];
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entry?.config?.dataset || "报表"}_${entry?.config?.days || 30}天.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success("已导出 CSV");
  };

  const saveTableTemplate = async () => {
    const entry = tableLog.find((x) => x.id === tableTemplateId);
    if (!tableTemplateName.trim()) {
      message.warning("请输入模板名称");
      return;
    }
    const r = await createReportTemplate({
      tenant,
      input: { name: tableTemplateName.trim(), kind: "table", config: entry?.config || {} },
      fields: ["id"],
      headers,
    });
    if (r.success) {
      message.success("参数模板已保存");
      setTableTemplateName("");
      setTableTemplateId(null);
      loadTemplates();
    } else message.error("保存失败");
  };

  // 将参数模板套用到某个 AI 气泡的配置
  const applyTableTemplateToEntry = (entryId: string, templateId: string) => {
    const t = templates.find((x: any) => x.id === templateId);
    const cfg = t?.config || {};
    updateTableCfg(entryId, {
      dataset: cfg.dataset || "upload",
      days: cfg.days ?? 30,
      fields: Array.isArray(cfg.fields) ? cfg.fields : defaultTableCfg(cfg.dataset || "upload").fields,
      sortBy: cfg.sortBy,
      sortDir: cfg.sortDir || "desc",
    });
    message.success(`已应用参数模板：${t?.name}`);
  };

  const genReport = async (t?: string) => {
    const th = (t ?? theme).trim();
    if (!th || reportLoading) return;
    setTheme(th);
    const uid = `u-${Date.now()}`;
    const aid = `a-${Date.now()}`;
    setReportLog((m) => [
      ...m,
      { role: "user", id: uid, text: th },
      { role: "ai", id: aid, loading: true, theme: th },
    ]);
    setReportActiveKeys((k) => [...k, aid]);
    setReportLoading(true);
    try {
      const r = await buildDataReport({ tenant, input: { theme: th, days: 30 }, headers });
      setReportLog((m) =>
        m.map((x) =>
          x.id === aid
            ? r.success && r.data
              ? { role: "ai" as const, id: aid, theme: th, report: r.data, outline: r.data.outline || [], time: new Date().toLocaleString("zh-CN") }
              : { role: "ai" as const, id: aid, text: "生成失败，请重试" }
            : x
        )
      );
    } finally {
      setReportLoading(false);
    }
  };

  const openOutlineEditor = (id: string) => {
    const msg = reportLog.find((x) => x.id === id);
    if (!msg?.outline) return;
    setEditReportId(id);
    setOutlineSections(
      (msg.outline || []).map((s: any) => ({
        title: s.title || "",
        description: s.description || "",
        dataset: s.dataset || "",
      })),
    );
    setOutlineEditing(true);
  };

  const applyOutline = async () => {
    if (!editReportId) return;
    const parsed = outlineSections.filter((s) => (s.title || "").trim() !== "");
    if (parsed.length === 0) {
      message.error("请至少保留一个章节");
      return;
    }
    const msg = reportLog.find((x) => x.id === editReportId);
    if (!msg?.theme) return;
    setOutlineEditing(false);
    setReportLoading(true);
    try {
      const r = await buildDataReport({ tenant, input: { theme: msg.theme, days: 30, outline: parsed }, headers });
      if (r.success && r.data) {
        const targetId = editReportId;
        setReportLog((m) =>
          m.map((x) =>
            x.id === targetId
              ? { ...x, report: r.data, outline: r.data.outline || parsed, time: new Date().toLocaleString("zh-CN") }
              : x
          )
        );
      } else message.error("重新生成失败");
    } finally {
      setReportLoading(false);
      setEditReportId(null);
    }
  };

  const moveOutline = (i: number, dir: number) => {
    setOutlineSections((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };

  const outlineTemplates = templates.filter((t: any) => t.kind === "outline");
  const tableTemplates = templates.filter((t: any) => t.kind === "table");

  const saveOutlineTemplate = async () => {
    if (!outlineTemplateName.trim()) {
      message.warning("请输入模板名称");
      return;
    }
    if (outlineSections.filter((s) => (s.title || "").trim()).length === 0) {
      message.warning("请先填写章节标题");
      return;
    }
    const r = await createReportTemplate({
      tenant,
      input: { name: outlineTemplateName.trim(), kind: "outline", config: { outline: outlineSections } },
      fields: ["id"],
      headers,
    });
    if (r.success) {
      message.success("大纲模板已保存");
      setOutlineTemplateName("");
      loadTemplates();
    } else message.error("保存失败");
  };

  const applyOutlineTemplate = (id: string) => {
    const t = templates.find((x: any) => x.id === id);
    const outline = t?.config?.outline;
    if (Array.isArray(outline)) {
      setOutlineSections(
        outline.map((s: any) => ({ title: s.title || "", description: s.description || "", dataset: s.dataset || "" })),
      );
      message.success(`已应用大纲模板：${t?.name}`);
    }
  };

  useEffect(() => {
    if (user) loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const exportReportPdf = async (id: string) => {
    const el = document.querySelector(`[data-report-id="${id}"]`) as HTMLElement | null;
    if (!el) return;
    setReportExporting(true);
    const hide = message.loading("正在生成 PDF…", 0);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: el.scrollWidth,
      });
      const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;
      const imgData = canvas.toDataURL("image/jpeg", 0.95);

      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgW, imgH);
        heightLeft -= pageH;
      }
      const msg = reportLog.find((x) => x.id === id);
      const name = (msg?.theme || "数据报告").replace(/[\\/:*?"<>|]/g, "_");
      pdf.save(`${name}.pdf`);
    } catch (e: any) {
      message.error(e?.message || "导出失败");
    } finally {
      hide();
      setReportExporting(false);
    }
  };

  const printReport = (id: string) => {
    const el = document.querySelector(`[data-report-id="${id}"]`);
    if (!el) return;
    el.classList.add("data-report-print--active");
    window.print();
    setTimeout(() => el.classList.remove("data-report-print--active"), 1500);
  };

  if (authLoading) {
    return (
      <AppPage title="数据智能" description="按院系统计教学运行数据并导出">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
          <Spin size="large" />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="数据智能"
      description="按院系统计教学运行数据并导出"
      actions={
        <Space>
          <Text strong>院系（租户）：</Text>
          <Select
            style={{ minWidth: 220 }}
            placeholder="选择院系"
            value={tenant || undefined}
            loading={!orgs}
            onChange={setTenant}
            showSearch
            optionFilterProp="label"
            options={(orgs || []).map((o: any) => ({ value: o.schemaName, label: o.name || o.schemaName }))}
          />
        </Space>
      }
    >
      <style>{`
        @media print {
          html, body { height: auto !important; overflow: visible !important; background: #fff !important; }
          body * { visibility: hidden !important; }
          .data-report-print--active, .data-report-print--active * { visibility: visible !important; }
          .data-report-print--active {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .data-report-print--active .ant-card { break-inside: avoid; box-shadow: none !important; }
          .ant-layout, .ant-layout-content, .ant-pro-layout, .ant-pro-layout-content {
            height: auto !important; min-height: 0 !important; overflow: visible !important;
          }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "overview",
              label: "数据总览",
              children: (
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
          <StatGrid
            items={kpis.map((k) => ({ label: k.label, value: k.value, unit: k.suffix }))}
          />
          {overviewInsight && (
            <Card size="small" title="AI 解读" style={{ marginTop: 16, background: "#f6f0ff" }}>
              <Paragraph style={{ margin: 0 }}>{overviewInsight}</Paragraph>
            </Card>
          )}
        </Card>
              ),
            },
            {
              key: "qa",
              label: "AI 数据问答",
              children: (
        <Card styles={{ body: { padding: 16, height: "calc(100vh - 240px)", minHeight: 440, display: "flex", flexDirection: "column" } }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
            {qaMessages.length === 0 && (
              <div style={{ padding: "48px 0", textAlign: "center", color: "#8c8c8c" }}>
                <RobotOutlined style={{ fontSize: 34, color: "#1677ff" }} />
                <div style={{ marginTop: 10 }}>用自然语言提问，我会以表格 / 统计图返回结果</div>
              </div>
            )}
            {qaMessages.map((m, i) => (
              <AgentBubble key={i} role={m.role}>
                {m.role === "user" ? (
                  <span>{m.text}</span>
                ) : m.loading ? (
                  <Space><LoadingOutlined /> 正在查询教学运行数据…</Space>
                ) : m.answer ? (
                  <AnswerResult answer={m.answer} />
                ) : (
                  <span>{m.text}</span>
                )}
              </AgentBubble>
            ))}
          </div>
          <div style={{ flexShrink: 0, marginTop: 8, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>快捷提问：</Text>
            {QUICK_QUESTIONS.map((q) => (
              <Button key={q} size="small" style={{ marginBottom: 4 }} onClick={() => doAsk(q)}>{q}</Button>
            ))}
          </div>
          <div style={{ flexShrink: 0, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onPressEnter={() => doAsk()}
                placeholder="输入问题，如：各院系资源上传量统计"
              />
              <Button type="primary" icon={<SendOutlined />} loading={asking} onClick={() => doAsk()}>
                发送
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => {
                  setQaMessages([]);
                  message.success("已清空问答记录");
                }}
              >
                清空
              </Button>
            </Space.Compact>
          </div>
        </Card>
              ),
            },
            {
              key: "report",
              label: "AI 数据报告",
              children: (
        <Card styles={{ body: { padding: 16, height: "calc(100vh - 240px)", minHeight: 440, display: "flex", flexDirection: "column" } }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
            {reportLog.length === 0 && (
              <div style={{ padding: "48px 0", textAlign: "center", color: "#8c8c8c" }}>
                <RobotOutlined style={{ fontSize: 34, color: "#1677ff" }} />
                <div style={{ marginTop: 10 }}>描述一个分析主题，我会生成大纲并产出含文本 / 统计图 / 数据表的报告</div>
              </div>
            )}
            {reportLog.map((m) =>
              m.role === "user" ? (
                <AgentBubble key={m.id} role="user"><span>{m.text}</span></AgentBubble>
              ) : (
                <AgentBubble key={m.id} role="ai">
                  {m.loading ? (
                    <Space><LoadingOutlined /> 正在生成报告（大纲 → 分节 → 图表）…</Space>
                  ) : !m.report ? (
                    <span>{m.text}</span>
                  ) : (
                    <Collapse
                      activeKey={reportActiveKeys}
                      onChange={(k) => setReportActiveKeys(k as string[])}
                      items={[
                        {
                          key: m.id,
                          forceRender: true,
                          label: (
                            <span>
                              <FileTextOutlined /> {m.theme}
                              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>{m.time}</Text>
                            </span>
                          ),
                          extra: (
                            <Space onClick={(e) => e.stopPropagation()} wrap>
                              <Button size="small" onClick={() => openOutlineEditor(m.id)}>调整大纲</Button>
                              <Button size="small" icon={<PrinterOutlined />} onClick={() => printReport(m.id)}>打印</Button>
                              <Button size="small" type="primary" icon={<FilePdfOutlined />} loading={reportExporting} onClick={() => exportReportPdf(m.id)}>导出 PDF</Button>
                            </Space>
                          ),
                          children: (
                            <div className="data-report-print" data-report-id={m.id} style={{ background: "#fff" }}>
                              <Title level={4} style={{ textAlign: "center", marginBottom: 4 }}>{m.theme}</Title>
                              <Text type="secondary" style={{ display: "block", textAlign: "center", marginBottom: 12, fontSize: 12 }}>
                                院系：{(orgs || []).find((o: any) => o.schemaName === tenant)?.name || tenant} · {m.time}
                              </Text>
                              {m.report.sections?.map((s: any, i: number) => (
                                <Card key={i} size="small" title={<span>{i + 1}. {s.title}　{s.dataset && <Tag color="blue">{datasetLabel(s.dataset)}</Tag>}</span>} style={{ marginTop: 12 }}>
                                  <Paragraph style={{ color: "#555" }}>{s.text}</Paragraph>
                                  <Row gutter={16}>
                                    <Col xs={24} md={14}>
                                      <Table
                                        size="small"
                                        pagination={false}
                                        columns={(s.table?.columns || []).map((c: string) => ({ title: c, dataIndex: c, key: c, render: (v: any) => String(v ?? "-") }))}
                                        dataSource={(s.table?.rows || []).slice(0, 20).map((r: any, j: number) => ({ key: j, ...r }))}
                                      />
                                    </Col>
                                    <Col xs={24} md={10}>
                                      <ChartBlock option={s.chart} />
                                    </Col>
                                  </Row>
                                </Card>
                              ))}
                              <Divider style={{ marginTop: 16 }}>报表与统计图已由 AI 基于真实数据生成</Divider>
                            </div>
                          ),
                        },
                      ]}
                    />
                  )}
                </AgentBubble>
              )
            )}
          </div>
          <div style={{ flexShrink: 0, marginTop: 8, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>快捷主题：</Text>
            {REPORT_THEMES.map((t) => (
              <Button key={t} size="small" style={{ marginBottom: 4 }} onClick={() => genReport(t)}>{t}</Button>
            ))}
          </div>
          <div style={{ flexShrink: 0, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="描述分析主题，如：第一学期课堂活动开展情况分析" onPressEnter={() => genReport()} />
              <Button type="primary" loading={reportLoading} onClick={() => genReport()}>
                生成报告
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => {
                  setReportLog([]);
                  setReportActiveKeys([]);
                  message.success("已清空报告历史");
                }}
              >
                清空
              </Button>
            </Space.Compact>
          </div>
        </Card>
              ),
            },
            {
              key: "table",
              label: "AI 数据报表",
              children: (
        <Card styles={{ body: { padding: 16, height: "calc(100vh - 240px)", minHeight: 440, display: "flex", flexDirection: "column" } }}>
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
            {tableLog.length === 0 && (
              <div style={{ padding: "48px 0", textAlign: "center", color: "#8c8c8c" }}>
                <RobotOutlined style={{ fontSize: 34, color: "#1677ff" }} />
                <div style={{ marginTop: 10 }}>输入或选择报表需求，我会先给出参数表单，确认后生成可导出的数据表</div>
              </div>
            )}
            {tableLog.map((m) =>
              m.role === "user" ? (
                <AgentBubble key={m.id} role="user"><span>{m.text}</span></AgentBubble>
              ) : (
                <AgentBubble key={m.id} role="ai">
                  {!m.config ? (
                    <span>{m.text}</span>
                  ) : (
                    <>
                      <Space style={{ marginBottom: 8 }} wrap>
                        <Dropdown
                          trigger={["click"]}
                          menu={{
                            items: tableTemplates.length
                              ? tableTemplates.map((t: any) => ({ key: t.id, label: t.name }))
                              : [{ key: "__empty", label: "暂无参数模板", disabled: true }],
                            onClick: ({ key }) => key !== "__empty" && applyTableTemplateToEntry(m.id, key),
                          }}
                        >
                          <Button size="small" icon={<DatabaseOutlined />}>
                            模板 <DownOutlined />
                          </Button>
                        </Dropdown>
                        <Input
                          style={{ width: 160 }}
                          value={tableTemplateName}
                          onChange={(e) => setTableTemplateName(e.target.value)}
                          placeholder="参数模板名称"
                        />
                        <Button
                          size="small"
                          icon={<SaveOutlined />}
                          onClick={() => { setTableTemplateId(m.id); saveTableTemplate(); }}
                        >
                          保存为参数模板
                        </Button>
                      </Space>
                      <Row gutter={[12, 12]}>
                        <Col xs={24} md={8}>
                          <Text strong>数据集</Text>
                          <Select
                            style={{ width: "100%", marginTop: 4 }}
                            value={m.config.dataset}
                            onChange={(v) => { const d = DATASETS.find((x) => x.value === v)!; updateTableCfg(m.id, { dataset: v, fields: d.columns }); }}
                            options={DATASETS.map((d) => ({ value: d.value, label: d.label }))}
                          />
                        </Col>
                        <Col xs={24} md={8}>
                          <Text strong>时间范围（近 N 天）</Text>
                          <InputNumber min={1} max={365} value={m.config.days} onChange={(v) => updateTableCfg(m.id, { days: v || 30 })} style={{ width: "100%", marginTop: 4 }} />
                        </Col>
                        <Col xs={24} md={8}>
                          <Text strong>排序字段</Text>
                          <Select
                            style={{ width: "100%", marginTop: 4 }}
                            placeholder="默认"
                            allowClear
                            value={m.config.sortBy}
                            onChange={(v) => updateTableCfg(m.id, { sortBy: v })}
                            options={(DATASETS.find((d) => d.value === m.config!.dataset)?.columns || []).map((c) => ({ value: c, label: c }))}
                          />
                        </Col>
                        <Col xs={24} md={8}>
                          <Text strong>排序方向</Text>
                          <Select
                            style={{ width: "100%", marginTop: 4 }}
                            value={m.config.sortDir}
                            onChange={(v) => updateTableCfg(m.id, { sortDir: v })}
                            options={[{ value: "asc", label: "升序" }, { value: "desc", label: "降序" }]}
                          />
                        </Col>
                        <Col xs={24} md={16}>
                          <Text strong>导出字段</Text>
                          <div style={{ marginTop: 4 }}>
                            <Checkbox.Group
                              value={m.config.fields}
                              onChange={(v) => updateTableCfg(m.id, { fields: v as string[] })}
                              options={(DATASETS.find((d) => d.value === m.config!.dataset)?.columns || []).map((c) => ({ label: c, value: c }))}
                            />
                          </div>
                        </Col>
                      </Row>
                      <div style={{ marginTop: 12 }}>
                        <Button type="primary" loading={m.loading} onClick={() => genTableEntry(m.id)}>确认生成报表</Button>
                      </div>
                      {m.loading && <div style={{ marginTop: 8 }}><Space><LoadingOutlined /> 正在生成报表…</Space></div>}
                      {m.data && (
                        <div style={{ marginTop: 12 }}>
                          <Collapse
                            activeKey={tableActiveKeys}
                            onChange={(k) => setTableActiveKeys(k as string[])}
                            items={[
                              {
                                key: m.id,
                                forceRender: true,
                                label: (
                                  <span>
                                    <DatabaseOutlined /> {DATASETS.find((d) => d.value === m.config!.dataset)?.label || "数据表"}
                                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
                                      共 {Array.isArray(m.data.rows) ? m.data.rows.length : 0} 条
                                    </Text>
                                  </span>
                                ),
                                extra: (
                                  <Space onClick={(e) => e.stopPropagation()} wrap>
                                    <Button size="small" icon={<DownloadOutlined />} onClick={() => exportTableEntry(m.id)}>导出 CSV</Button>
                                  </Space>
                                ),
                                children: (
                                  <Table
                                    size="small"
                                    rowKey={(_, i) => String(i)}
                                    pagination={Array.isArray(m.data.rows) && m.data.rows.length > 15 ? { pageSize: 15 } : false}
                                    columns={(Array.isArray(m.data.columns) ? m.data.columns : []).map((c: string) => ({ title: c, dataIndex: c, key: c, render: (v: any) => String(v ?? "-") }))}
                                    dataSource={(Array.isArray(m.data.rows) ? m.data.rows : []).map((r: any, j: number) => ({ key: j, ...r }))}
                                  />
                                ),
                              },
                            ]}
                          />
                        </div>
                      )}
                    </>
                  )}
                </AgentBubble>
              )
            )}
          </div>
          <div style={{ flexShrink: 0, marginTop: 8, marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12, marginRight: 4 }}>快捷报表：</Text>
            {DATASETS.map((d) => (
              <Button key={d.value} size="small" style={{ marginBottom: 4 }} onClick={() => sendTableRequest(d.label, d.value)}>{d.label}</Button>
            ))}
          </div>
          <div style={{ flexShrink: 0, borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
            <Space.Compact style={{ width: "100%" }}>
              <Input
                value={tableInput}
                onChange={(e) => setTableInput(e.target.value)}
                onPressEnter={() => { sendTableRequest(tableInput); setTableInput(""); }}
                placeholder="输入报表需求，如：资源上传量统计"
              />
              <Button type="primary" icon={<SendOutlined />} onClick={() => { sendTableRequest(tableInput); setTableInput(""); }}>
                发送
              </Button>
              <Button
                icon={<DeleteOutlined />}
                onClick={() => {
                  setTableLog([]);
                  setTableActiveKeys([]);
                  message.success("已清空报表历史");
                }}
              >
                清空
              </Button>
            </Space.Compact>
          </div>
        </Card>
              ),
            },
          ]}
        />

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
        <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
          可调整每个章节的标题、数据来源与说明，支持增删与排序后再重新生成报告；也可保存为自定义大纲模板复用。
        </Text>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <Dropdown
            trigger={["click"]}
            menu={{
              items: outlineTemplates.length
                ? outlineTemplates.map((t: any) => ({ key: t.id, label: t.name }))
                : [{ key: "__empty", label: "暂无大纲模板", disabled: true }],
              onClick: ({ key }) => key !== "__empty" && applyOutlineTemplate(key),
            }}
          >
            <Button icon={<FileTextOutlined />}>大纲模板 <DownOutlined /></Button>
          </Dropdown>
          <Input
            style={{ width: 200 }}
            value={outlineTemplateName}
            onChange={(e) => setOutlineTemplateName(e.target.value)}
            placeholder="大纲模板名称"
          />
          <Button icon={<SaveOutlined />} onClick={saveOutlineTemplate}>保存为大纲模板</Button>
        </div>
        <div style={{ maxHeight: "48vh", overflowY: "auto", paddingRight: 4 }}>
          {outlineSections.map((s, i) => (
            <Card
              key={i}
              size="small"
              style={{ marginBottom: 8 }}
              title={`第 ${i + 1} 节`}
              extra={
                <Space size={4}>
                  <Button size="small" disabled={i === 0} onClick={() => moveOutline(i, -1)}>上移</Button>
                  <Button size="small" disabled={i === outlineSections.length - 1} onClick={() => moveOutline(i, 1)}>下移</Button>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => setOutlineSections((arr) => arr.filter((_, idx) => idx !== i))} />
                </Space>
              }
            >
              <Input
                addonBefore="标题"
                value={s.title}
                onChange={(e) => setOutlineSections((arr) => arr.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))}
                placeholder="章节标题"
              />
              <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
                <Text style={{ fontSize: 13, whiteSpace: "nowrap" }}>数据来源</Text>
                <Select
                  style={{ flex: 1 }}
                  value={s.dataset || undefined}
                  onChange={(v) => setOutlineSections((arr) => arr.map((x, idx) => (idx === i ? { ...x, dataset: v } : x)))}
                  options={OUTLINE_DATASETS}
                  placeholder="选择数据来源"
                  allowClear
                />
              </div>
              <Input.TextArea
                style={{ marginTop: 8 }}
                rows={2}
                value={s.description}
                onChange={(e) => setOutlineSections((arr) => arr.map((x, idx) => (idx === i ? { ...x, description: e.target.value } : x)))}
                placeholder="章节说明（可选）"
              />
            </Card>
          ))}
          <Button
            block
            icon={<PlusOutlined />}
            onClick={() => setOutlineSections((arr) => [...arr, { title: "", description: "", dataset: "" }])}
          >
            添加章节
          </Button>
        </div>
      </Modal>

    </AppPage>
  );
}