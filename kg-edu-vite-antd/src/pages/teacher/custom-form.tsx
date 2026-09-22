import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Input, Select, Switch, Table, Tag, Space,
  Modal, message, Row, Col, InputNumber,
} from "antd";
import { ArrowLeftOutlined, PlusOutlined, DeleteOutlined, FunctionOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  createFormDef, updateFormDef, deleteFormDef, listFormDefs,
  listFormSubmissionsByForm, reviewSubmission,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { evaluateFormula } from "@/lib/practice";

const { Title, Text } = Typography;

const FIELD_TYPES = [
  { value: "text", label: "单行文本" },
  { value: "textarea", label: "多行文本" },
  { value: "number", label: "数字" },
  { value: "date", label: "日期" },
  { value: "radio", label: "单选" },
  { value: "checkbox", label: "多选" },
  { value: "select", label: "下拉框" },
  { value: "image", label: "图片上传" },
  { value: "attachment", label: "附件上传" },
  { value: "formula", label: "计算字段" },
];

interface FieldItem {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  expression?: string;
}

export default function CustomForm() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("申请");
  const [fields, setFields] = useState<FieldItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviewFormId, setReviewFormId] = useState<string | null>(null);
  const [formulaGoal, setFormulaGoal] = useState("");
  const [formulaIdx, setFormulaIdx] = useState<number | null>(null);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [formulaExplain, setFormulaExplain] = useState("");

  const { data: forms, refetch, isLoading } = useQuery({
    queryKey: ["form-defs"],
    queryFn: async () => {
      const r = await listFormDefs({ tenant, fields: ["id", "title", "category"], headers });
      return r.success ? (r.data as any[]) : [];
    },
    enabled: !!user,
  });

  const { data: submissions, refetch: refetchSubs } = useQuery({
    queryKey: ["form-subs", reviewFormId],
    queryFn: async () => {
      if (!reviewFormId) return [];
      const r = await listFormSubmissionsByForm({
        tenant, input: { formId: reviewFormId }, fields: ["id", "values", "status", "reviewNote"], headers,
      });
      return r.success ? (r.data as any[]) : [];
    },
    enabled: !!reviewFormId && !!user,
  });

  const addField = () => {
    const n = fields.length + 1;
    setFields([...fields, { key: `field${n}`, label: `题目${n}`, type: "text", required: false }]);
  };

  const saveForm = async () => {
    if (!title.trim() || fields.length === 0) {
      message.warning("请填写标题并添加题目");
      return;
    }
    const input = { title, category, schema: fields as any };
    const r = editingId
      ? await updateFormDef({ tenant, primaryKey: editingId, input, fields: ["id"], headers })
      : await createFormDef({ tenant, input, fields: ["id"], headers });
    if (r.success) {
      message.success("表单已保存");
      setTitle("");
      setFields([]);
      setEditingId(null);
      refetch();
    } else message.error("保存失败");
  };

  const aiFormula = async () => {
    if (formulaIdx == null || !formulaGoal.trim()) {
      message.warning("请描述计算目标");
      return;
    }
    setFormulaLoading(true);
    try {
      const r = await fetch("/api/forms/ai-formula", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ tenant, fields, goal: formulaGoal }),
      }).then((x) => x.json());
      if (r.success) {
        const next = [...fields];
        next[formulaIdx] = { ...next[formulaIdx], expression: r.expression };
        setFields(next);
        setFormulaExplain(r.explanation || "");
        // 即时验算（示例值全取 1）
        try {
          const demo = evaluateFormula(r.expression, Object.fromEntries(fields.map((f) => [f.key, 1])));
          message.success(`公式已生成，示例验算=${demo}`);
        } catch {
          message.success("公式已生成（示例值无法验算，请检查字段）");
        }
      } else message.error(r.error || "生成失败");
    } finally {
      setFormulaLoading(false);
    }
  };

  const doReview = async (id: string, status: "approved" | "rejected") => {
    const r = await reviewSubmission({
      tenant, primaryKey: id, input: { status, reviewerId: user?.id }, fields: ["id", "status"], headers,
    });
    if (r.success) {
      message.success(status === "approved" ? "已批准" : "已驳回");
      refetchSubs();
    } else message.error("审核失败");
  };

  if (authLoading || isLoading) {
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
        <Title level={4} style={{ margin: 0 }}>移动端自定义表单</Title>
      </div>

      <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={editingId ? "编辑表单" : "创建表单（单选/多选/下拉/图片/附件/必填）"}>
              <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="表单标题，如：请假申请" />
                <Select value={category} onChange={setCategory} style={{ width: 130 }} options={["请假", "报销", "申请", "报修", "信息采集"].map((c) => ({ value: c, label: c }))} />
              </Space.Compact>
              {fields.map((f, i) => (
                <Card key={i} size="small" style={{ marginBottom: 8 }} title={`${i + 1}. ${f.label || "(未命名)"}`}>
                  <Space wrap>
                    <Input value={f.key} onChange={(e) => { const n = [...fields]; n[i] = { ...n[i], key: e.target.value }; setFields(n); }} style={{ width: 110 }} placeholder="key" />
                    <Input value={f.label} onChange={(e) => { const n = [...fields]; n[i] = { ...n[i], label: e.target.value }; setFields(n); }} style={{ width: 150 }} placeholder="题干" />
                    <Select value={f.type} onChange={(v) => { const n = [...fields]; n[i] = { ...n[i], type: v }; setFields(n); }} style={{ width: 120 }} options={FIELD_TYPES} />
                    <span>必填 <Switch checked={f.required} onChange={(v) => { const n = [...fields]; n[i] = { ...n[i], required: v }; setFields(n); }} /></span>
                    <Button danger type="text" icon={<DeleteOutlined />} onClick={() => setFields(fields.filter((_, j) => j !== i))} />
                  </Space>
                  {["radio", "checkbox", "select"].includes(f.type) && (
                    <Input
                      style={{ marginTop: 8 }}
                      value={(f.options || []).join(",")}
                      onChange={(e) => { const n = [...fields]; n[i] = { ...n[i], options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) }; setFields(n); }}
                      placeholder="选项逗号分隔，如：事假,病假"
                    />
                  )}
                  {f.type === "formula" && (
                    <div style={{ marginTop: 8 }}>
                      <Space.Compact style={{ width: "100%" }}>
                        <Input value={formulaIdx === i ? formulaGoal : ""} onFocus={() => setFormulaIdx(i)} onChange={(e) => { setFormulaIdx(i); setFormulaGoal(e.target.value); }} placeholder="描述计算目标，如：天数乘以每天200元" />
                        <Button icon={<FunctionOutlined />} loading={formulaLoading && formulaIdx === i} onClick={aiFormula}>
                          AI 生成公式
                        </Button>
                      </Space.Compact>
                      {f.expression && <Text type="success" style={{ display: "block", marginTop: 4 }}>公式：{f.expression}</Text>}
                      {formulaIdx === i && formulaExplain && <Text type="secondary" style={{ display: "block" }}>{formulaExplain}</Text>}
                    </div>
                  )}
                </Card>
              ))}
              <Space>
                <Button icon={<PlusOutlined />} onClick={addField}>添加题目</Button>
                <Button type="primary" onClick={saveForm}>保存表单</Button>
                {editingId && <Button onClick={() => { setEditingId(null); setTitle(""); setFields([]); }}>取消编辑</Button>}
              </Space>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title="已创建表单">
              <Table
                size="small"
                rowKey="id"
                pagination={false}
                dataSource={forms || []}
                columns={[
                  { title: "标题", dataIndex: "title" },
                  { title: "分类", dataIndex: "category", render: (v: string) => <Tag>{v}</Tag> },
                  {
                    title: "操作",
                    render: (_: any, r: any) => (
                      <Space>
                        <Button type="link" size="small" onClick={() => setReviewFormId(r.id)}>审批</Button>
                        <Button type="link" size="small" danger onClick={async () => { await deleteFormDef({ tenant, primaryKey: r.id, headers }); refetch(); }}>删除</Button>
                      </Space>
                    ),
                  },
                ]}
              />
            </Card>

            {reviewFormId && (
              <Card title="审批：学生提交 → 教师审核" style={{ marginTop: 16 }}>
                <Table
                  size="small"
                  rowKey="id"
                  pagination={false}
                  dataSource={submissions || []}
                  columns={[
                    {
                      title: "填报内容",
                      dataIndex: "values",
                      render: (v: any) => <Text style={{ fontSize: 12 }}>{JSON.stringify(v)}</Text>,
                    },
                    {
                      title: "状态",
                      dataIndex: "status",
                      width: 90,
                      render: (v: string) => (
                        <Tag color={v === "approved" ? "green" : v === "rejected" ? "red" : "orange"}>
                          {v === "approved" ? "已批准" : v === "rejected" ? "已驳回" : "待审核"}
                        </Tag>
                      ),
                    },
                    {
                      title: "操作",
                      width: 130,
                      render: (_: any, r: any) =>
                        r.status === "submitted" ? (
                          <Space>
                            <Button type="link" size="small" onClick={() => doReview(r.id, "approved")}>批准</Button>
                            <Button type="link" size="small" danger onClick={() => doReview(r.id, "rejected")}>驳回</Button>
                          </Space>
                        ) : (
                          <Text type="secondary" style={{ fontSize: 12 }}>{r.reviewNote || "-"}</Text>
                        ),
                    },
                  ]}
                />
              </Card>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
}
