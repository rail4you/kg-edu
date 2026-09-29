import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Input, Select, DatePicker, Radio, Checkbox,
  Upload, message, Tag, Space, Modal,
} from "antd";
import { ArrowLeftOutlined, UploadOutlined, RobotOutlined, SendOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  listFormDefs, getFormDef, submitForm, listFormSubmissionsBySubmitter,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { uploadFileViaServer } from "@/lib/oss-upload";
import { evaluateFormula } from "@/lib/practice";

const { Title, Text } = Typography;

export default function MyForms() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [activeFormId, setActiveFormId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [aiText, setAiText] = useState("");
  const [aiImage, setAiImage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const { data: forms } = useQuery({
    queryKey: ["my-form-defs"],
    queryFn: async () => {
      const r = await listFormDefs({ tenant, fields: ["id", "title", "category"], headers });
      return r.success ? (r.data as any[]) : [];
    },
    enabled: !!user,
  });

  const { data: form } = useQuery({
    queryKey: ["my-form-def", activeFormId],
    queryFn: async () => {
      if (!activeFormId) return null;
      const r = await getFormDef({ tenant, filter: { id: { eq: activeFormId } }, fields: ["id", "title", "schema"], headers });
      return r.success && Array.isArray(r.data) ? (r.data as any[])[0] : null;
    },
    enabled: !!activeFormId && !!user,
  });

  const { data: mine, refetch: refetchMine } = useQuery({
    queryKey: ["my-subs"],
    queryFn: async () => {
      if (!user?.id) return [];
      const r = await listFormSubmissionsBySubmitter({
        tenant, input: { submitterId: user.id }, fields: ["id", "status", "formId"], headers,
      });
      return r.success ? (r.data as any[]) : [];
    },
    enabled: !!user?.id,
  });

  const aiFill = async (kind: "text" | "image") => {
    if (!form) return;
    const payload = kind === "text" ? aiText.trim() : aiImage.trim();
    if (!payload) {
      message.warning(kind === "text" ? "请先输入自然语言描述" : "请先填写图片 URL");
      return;
    }
    setAiLoading(true);
    try {
      const r = await fetch("/api/forms/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ tenant, schema: form.schema, ...(kind === "text" ? { text: payload } : { imageUrl: payload }) }),
      }).then((x) => x.json());
      if (r.success) {
        setValues((v) => ({ ...v, ...r.values }));
        message.success(`AI 已回填 ${Object.keys(r.values).length} 个字段`);
      } else message.error(r.error || "回填失败");
    } finally {
      setAiLoading(false);
    }
  };

  const doUpload = async (key: string, file: File) => {
    setUploadingKey(key);
    try {
      const { url } = await uploadFileViaServer(file);
      setValues((v) => ({ ...v, [key]: url }));
      message.success("上传成功");
    } catch {
      message.error("上传失败");
    } finally {
      setUploadingKey(null);
    }
    return false;
  };

  const doSubmit = async () => {
    if (!form) return;
    for (const f of form.schema || []) {
      if (f.required && (values[f.key] == null || values[f.key] === "")) {
        message.warning(`「${f.label}」为必填项`);
        return;
      }
    }
    // 计算字段即时求值
    const finalValues = { ...values };
    for (const f of form.schema || []) {
      if (f.type === "formula" && f.expression) {
        try {
          finalValues[f.key] = evaluateFormula(f.expression, finalValues);
        } catch (e: any) {
          message.warning(`计算字段「${f.label}」求值失败：${e.message}`);
          return;
        }
      }
    }
    const r = await submitForm({
      tenant, input: { formId: form.id, submitterId: user?.id, values: finalValues }, fields: ["id", "status"], headers,
    });
    if (r.success) {
      message.success("提交成功，等待教师审核");
      setValues({});
      setActiveFormId(null);
      refetchMine();
    } else message.error("提交失败");
  };

  const renderField = (f: any) => {
    const common = { key: f.key };
    switch (f.type) {
      case "textarea":
        return <Input.TextArea rows={3} value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} {...common} />;
      case "number":
        return <Input type="number" value={values[f.key] ?? ""} onChange={(e) => setValues({ ...values, [f.key]: Number(e.target.value) })} style={{ width: "100%" }} {...common} />;
      case "date":
        return <Input type="date" value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} {...common} />;
      case "radio":
        return <Radio.Group value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} options={f.options || []} {...common} />;
      case "checkbox":
        return <Checkbox.Group value={values[f.key] || []} onChange={(v) => setValues({ ...values, [f.key]: v })} options={f.options || []} {...common} />;
      case "select":
        return <Select value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} style={{ width: "100%" }} options={(f.options || []).map((o: string) => ({ value: o, label: o }))} {...common} />;
      case "image":
      case "attachment":
        return (
          <div>
            <Upload beforeUpload={(file) => doUpload(f.key, file)} showUploadList={false} accept={f.type === "image" ? "image/*" : undefined}>
              <Button icon={<UploadOutlined />} loading={uploadingKey === f.key}>上传{f.type === "image" ? "图片" : "附件"}</Button>
            </Upload>
            {values[f.key] && <div style={{ marginTop: 4 }}><a href={values[f.key]} target="_blank" rel="noreferrer">{values[f.key]}</a></div>}
          </div>
        );
      case "formula":
        return <Input disabled value={f.expression ? `= ${f.expression}` : "（教师配置计算公式）"} {...common} />;
      default:
        return <Input value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} {...common} />;
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
        <Title level={4} style={{ margin: 0 }}>我的表单</Title>
      </div>

      <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
        {!activeFormId ? (
          <>
            <Card title="可填报单">
              {(forms || []).map((f: any) => (
                <Card.Grid key={f.id} style={{ width: "50%", cursor: "pointer" }} onClick={() => { setActiveFormId(f.id); setValues({}); }}>
                  <Text strong>{f.title}</Text>
                  <div><Tag>{f.category}</Tag></div>
                </Card.Grid>
              ))}
              {(!forms || forms.length === 0) && <Text type="secondary">暂无可填报单</Text>}
            </Card>
            <Card title="我的提交" style={{ marginTop: 16 }}>
              {(mine || []).map((s: any) => (
                <div key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <Text style={{ fontSize: 12 }}>{s.id.slice(0, 8)}…</Text>
                  <Tag color={s.status === "approved" ? "green" : s.status === "rejected" ? "red" : "orange"}>
                    {s.status === "approved" ? "已批准" : s.status === "rejected" ? "已驳回" : "待审核"}
                  </Tag>
                </div>
              ))}
            </Card>
          </>
        ) : (
          <Card title={form?.title || "填报"} extra={<Button type="link" onClick={() => setActiveFormId(null)}>返回</Button>}>
            <Card size="small" title={<span><RobotOutlined /> AI 填表（自然语言 / 图片回填）</span>} style={{ marginBottom: 16, background: "#f6f0ff" }}>
              <Input.TextArea rows={2} value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="如：因感冒请假三天，从明天开始" style={{ marginBottom: 8 }} />
              <Space wrap>
                <Button loading={aiLoading} onClick={() => aiFill("text")}>按描述回填</Button>
                <Input value={aiImage} onChange={(e) => setAiImage(e.target.value)} placeholder="图片 URL（识别回填）" style={{ width: 260 }} />
                <Button loading={aiLoading} onClick={() => aiFill("image")}>识别图片回填</Button>
              </Space>
            </Card>
            {(form?.schema || []).map((f: any) => (
              <div key={f.key} style={{ marginBottom: 12 }}>
                <Text strong>{f.required && <span style={{ color: "red" }}>* </span>}{f.label}</Text>
                <div style={{ marginTop: 4 }}>{renderField(f)}</div>
              </div>
            ))}
            <Button type="primary" icon={<SendOutlined />} onClick={doSubmit}>
              提交（进入教师审核）
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
