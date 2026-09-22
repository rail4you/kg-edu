import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import {
  Card, Button, Typography, Spin, Switch, Table, Tag, Space, Select,
  Input, message, Row, Col, List, Divider,
} from "antd";
import { ArrowLeftOutlined, PlayCircleOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  createAssistantTool, updateAssistantTool, deleteAssistantTool, listAssistantTools,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text, Paragraph } = Typography;

interface BuiltinPlugin {
  name: string;
  label: string;
  desc: string;
}

const PLUGIN_PARAM_HINTS: Record<string, string> = {
  push: '{"title":"开课提醒","content":"高等数学本周开课","userId":"<用户ID>"}',
  email: '{"senderUserId":"<发件人ID>","receiverUserId":"<收件人ID>","subject":"主题","body":"正文"}',
  word_export: '{"title":"文档标题","content":"# 标题\\n正文 Markdown"}',
  chart: '{"title":"统计图","kind":"bar","data":[{"name":"理学院","value":8}]}',
  map: '{"query":"北京"}',
  excel_export: '{"title":"导出","rows":[["姓名","分数"],["张三",90]]}',
  ppt_generate: '{"title":"演示文稿","points":["要点一内容","要点二内容"]}',
  history: '{"threadId":"可选会话ID"}',
  web_parse: '{"url":"https://example.com"}',
  knowledge_rates: '{"courseId":"<课程ID>"}',
  course_search: '{"query":"数学"}',
};

export default function AssistantPlugins() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [fallback, setFallback] = useState(true);
  const [webSearch, setWebSearch] = useState(false);
  const [runPlugin, setRunPlugin] = useState("chart");
  const [runParams, setRunParams] = useState(PLUGIN_PARAM_HINTS.chart);
  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState<any>(null);
  const [newTool, setNewTool] = useState<{ name: string; kind: "plugin" | "builtin" | "mcp"; plugin: string }>({ name: "", kind: "plugin", plugin: "chart" });
  const chartRef = useRef<HTMLDivElement>(null);

  const loadSettings = async () => {
    const r = await fetch("/api/assistant/settings", { headers: { ...headers, "x-org-schema": tenant } }).then((x) => x.json());
    if (r.success) {
      setFallback(r.data.fallback_enabled);
      setWebSearch(r.data.web_search_enabled);
    }
  };

  const saveSettings = async (fb: boolean, ws: boolean) => {
    const r = await fetch("/api/assistant/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ tenant, fallbackEnabled: fb, webSearchEnabled: ws }),
    }).then((x) => x.json());
    if (r.success) {
      setFallback(r.data.fallback_enabled);
      setWebSearch(r.data.web_search_enabled);
      message.success("设置已保存");
    } else message.error("保存失败");
  };

  React.useEffect(() => {
    if (user) loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const { data: pluginData, refetch } = useQuery({
    queryKey: ["assistant-plugins"],
    queryFn: async () => {
      const r = await fetch("/api/assistant/plugins", { headers: { ...headers, "x-org-schema": tenant } }).then((x) => x.json());
      return r.success ? r.data : { builtin: [], registered: [] };
    },
    enabled: !!user,
  });

  const { data: mcpData } = useQuery({
    queryKey: ["mcp-tools"],
    queryFn: async () => {
      const r = await fetch("/api/assistant/mcp-tools", { headers: { ...headers, "x-org-schema": tenant } }).then((x) => x.json());
      return r.success ? r.data : null;
    },
    enabled: !!user,
  });

  const builtin: BuiltinPlugin[] = pluginData?.builtin || [];
  const registered: any[] = pluginData?.registered || [];

  const doRun = async () => {
    let params: any = {};
    try {
      params = runParams.trim() ? JSON.parse(runParams) : {};
    } catch {
      message.warning("参数不是合法 JSON");
      return;
    }
    if (params.userId === "<用户ID>") params.userId = user?.id;
    if (params.senderUserId === "<发件人ID>") params.senderUserId = user?.id;
    if (params.receiverUserId === "<收件人ID>") params.receiverUserId = user?.id;
    setRunning(true);
    try {
      const r = await fetch("/api/assistant/plugin-run", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ tenant, plugin: runPlugin, params }),
      }).then((x) => x.json());
      if (r.success) {
        setRunResult(r.data);
        message.success("插件执行成功");
      } else {
        setRunResult(null);
        message.error(r.error || "执行失败");
      }
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (runResult?.option && chartRef.current) {
      const chart = echarts.init(chartRef.current);
      chart.setOption(runResult.option);
      return () => chart.dispose();
    }
  }, [runResult]);

  const addTool = async () => {
    if (!newTool.name.trim()) {
      message.warning("请填写工具名");
      return;
    }
    const r = await createAssistantTool({
      tenant,
      input: { name: newTool.name, kind: newTool.kind, plugin: newTool.plugin },
      fields: ["id"],
      headers,
    });
    if (r.success) {
      message.success("已加入应用池");
      setNewTool({ name: "", kind: "plugin", plugin: "chart" });
      refetch();
    } else message.error("添加失败");
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
        <Title level={4} style={{ margin: 0 }}>AI 助教插件</Title>
      </div>

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="大模型能力开关">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <Text>大模型兜底回复（无命中时由大模型回答）</Text>
                <Switch checked={fallback} onChange={(v) => saveSettings(v, webSearch)} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>联网搜索（回答前检索最新信息）</Text>
                <Switch checked={webSearch} onChange={(v) => saveSettings(fallback, v)} />
              </div>
            </Card>

            <Card title="插件试运行控制台" style={{ marginTop: 16 }}>
              <Space.Compact style={{ width: "100%", marginBottom: 8 }}>
                <Select
                  value={runPlugin}
                  onChange={(v) => { setRunPlugin(v); setRunParams(PLUGIN_PARAM_HINTS[v] || "{}"); setRunResult(null); }}
                  style={{ width: 200 }}
                  options={builtin.map((b) => ({ value: b.name, label: b.label }))}
                />
                <Button type="primary" icon={<PlayCircleOutlined />} loading={running} onClick={doRun}>
                  执行
                </Button>
              </Space.Compact>
              <Input.TextArea rows={4} value={runParams} onChange={(e) => setRunParams(e.target.value)} style={{ fontFamily: "monospace", fontSize: 12 }} />
              {runResult && (
                <Card size="small" style={{ marginTop: 8, background: "#f6f0ff" }}>
                  <Paragraph strong>{runResult.message}</Paragraph>
                  {runResult.url && <a href={runResult.url} target="_blank" rel="noreferrer">{runResult.url}</a>}
                  {runResult.option && <div ref={chartRef} style={{ height: 260, marginTop: 8 }} />}
                  {!runResult.url && !runResult.option && (
                    <pre style={{ fontSize: 11, maxHeight: 220, overflow: "auto" }}>{JSON.stringify(runResult, null, 2).slice(0, 2000)}</pre>
                  )}
                </Card>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="应用池 / 自建插件 / MCP 服务">
              <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
                <Input value={newTool.name} onChange={(e) => setNewTool({ ...newTool, name: e.target.value })} placeholder="工具名，如：官网解析" />
                <Select value={newTool.kind} onChange={(v) => setNewTool({ ...newTool, kind: v })} style={{ width: 130 }} options={[
                  { value: "plugin", label: "自建插件" },
                  { value: "mcp", label: "MCP 服务" },
                  { value: "builtin", label: "内置能力" },
                ]} />
                <Select value={newTool.plugin} onChange={(v) => setNewTool({ ...newTool, plugin: v })} style={{ width: 150 }} options={builtin.map((b) => ({ value: b.name, label: b.label }))} />
                <Button icon={<PlusOutlined />} onClick={addTool}>加入</Button>
              </Space.Compact>
              <List
                size="small"
                dataSource={[{ kind: "header" as const }, ...registered]}
                renderItem={(t: any) =>
                  t.kind === "header" ? (
                    <List.Item>
                      <Text type="secondary">内置插件（{builtin.length} 种）：{builtin.map((b) => b.label).join("、")}</Text>
                    </List.Item>
                  ) : (
                    <List.Item
                      actions={[
                        <Switch key="sw" size="small" checked={t.enabled} onChange={async (v) => {
                          await updateAssistantTool({ tenant, primaryKey: t.id, input: { name: t.name, enabled: v }, fields: ["id"], headers });
                          refetch();
                        }} />,
                        <Button key="del" type="text" danger size="small" icon={<DeleteOutlined />} onClick={async () => {
                          await deleteAssistantTool({ tenant, primaryKey: t.id, headers });
                          refetch();
                        }} />,
                      ]}
                    >
                      <Tag color={t.kind === "mcp" ? "purple" : t.kind === "builtin" ? "green" : "blue"}>
                        {t.kind === "mcp" ? "MCP" : t.kind === "builtin" ? "内置" : "插件"}
                      </Tag>
                      <Text>{t.name}</Text>
                      <Text type="secondary" style={{ marginLeft: 8 }}>{t.plugin}</Text>
                    </List.Item>
                  )
                }
              />
            </Card>

            <Card title={`本 MCP 服务工具目录（${mcpData?.endpoint || "/mcp"}，${mcpData?.count || 0} 个）`} style={{ marginTop: 16 }}>
              <Space wrap>
                {(mcpData?.tools || []).map((t: any) => (
                  <Tag key={t.name} color="purple">{t.name}</Tag>
                ))}
              </Space>
              <Divider />
              <Text type="secondary" style={{ fontSize: 12 }}>
                MCP 服务能力：网页解析 / 联网搜索 / 图片 OCR / 天气预报 / 办公写作 / 教育教学 / 工作汇报 / 文案助手——
                前 2 项经插件试运行演示（web_parse；联网搜索走学术追踪数据源），OCR/天气等走外部 MCP 注册（应用池 kind=MCP，填 endpoint 即可接入）。
              </Text>
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
}
