import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Input, Select, Radio, Checkbox,
  Upload, message, Tag, Space, Empty, Tabs, Modal, Alert, Row, Col,
} from "antd";
import {
  ArrowLeftOutlined, UploadOutlined, RobotOutlined, SendOutlined,
  FileTextOutlined, EditOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate, useSearchParams } from "react-router-dom";
import { removeCurrentTenant } from "@/lib/tenant";
import {
  listFormAssignmentsByStudent, getFormDef,
  submitForm, markFormSubmitted, getFormSubmission,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { uploadFileViaServer } from "@/lib/oss-upload";
import { evaluateFormula } from "@/lib/practice";
import dayjs from "dayjs";

const { Title, Text } = Typography;

interface Assignment {
  id: string;
  formId: string;
  status: "pending" | "submitted";
  dueAt?: string | null;
  submissionId?: string | null;
}

export default function StudentDataForms() {
  const navigate = useNavigate();
  const { user, tenant: authTenant, loading: authLoading } = useAuth();

  // 监听 sessionStorage 修改事件（登录/退出时改值触发），
  // 触发本地 bump，让 React 重新计算 tenant 下面的查询。
  const [tenantTick, setTenantTick] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "tenant" || e.key === "user_data") setTenantTick((t) => t + 1);
    };
    window.addEventListener("storage", onStorage);
    // 也监听同 tab 内手动 sessionStorage.setItem — 抛个 setTimeout 触发自定义事件
    const orig = sessionStorage.setItem.bind(sessionStorage);
    sessionStorage.setItem = function (k: string, v: string) {
      const ret = orig(k, v);
      if (k === "tenant" || k === "user_data") {
        window.dispatchEvent(
          new StorageEvent("storage", { key: k, newValue: v }),
        );
      }
      return ret;
    };
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // 每帧直接从 sessionStorage 读最新租户，避免依赖 React Context 的状态时序。
  // 兜底链：sessionStorage["tenant"] -> useAuth() 的同步状态 -> localStorage -> ""。
  const tenant = (() => {
    // 读 tenantTick 触发依赖，登录/退出时刷新
    void tenantTick;
    if (typeof window === "undefined") return authTenant || "";
    return (
      sessionStorage.getItem("tenant") ||
      authTenant ||
      getCurrentTenant()?.schemaName ||
      ""
    );
  })();

  const [urlTenant] = useSearchParams();
  const urlTenantHint = urlTenant.get("tenant") || "";
  const tenantMismatch =
    !!urlTenantHint && !!tenant && urlTenantHint !== tenant;

  const switchToUrlTenant = () => {
    try {
      sessionStorage.removeItem("user_data");
      sessionStorage.removeItem("tenant");
      sessionStorage.removeItem("user_role");
      sessionStorage.removeItem("jwt_access_token");
    } catch {}
    try {
      removeCurrentTenant();
      localStorage.removeItem("selectedCourse");
    } catch {}
    // 重新登录后丢掉 ?tenant=，避免被错误租户再次带跑；保留 courseId 等业务参数。
    const sp = new URLSearchParams(window.location.search);
    sp.delete("tenant");
    const qs = sp.toString();
    const redirect = window.location.pathname + (qs ? `?${qs}` : "");
    navigate(`/login?role=student&redirect=${encodeURIComponent(redirect)}`, {
      replace: true,
    });
  };

  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [activeForm, setActiveForm] = useState<any | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [submission, setSubmission] = useState<any | null>(null);
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const headers = getAuthHeaders(user) as Record<string, string>;

  const assignmentsQuery = useQuery({
    queryKey: ["my-form-assignments", tenant, user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const r = await listFormAssignmentsByStudent({
        tenant,
        input: { studentId: user.id },
        fields: [
          "id", "formId", "status", "dueAt", "submissionId",
        ],
        headers,
      });
      if (!r.success) return [];
      return (r.data as any) || [];
    },
    enabled: !!user?.id && !!tenant,
  });
  const assignments: Assignment[] = assignmentsQuery.data || [];

  const formIds = useMemo(
    () => Array.from(new Set(assignments.map((a) => a.formId).filter(Boolean))),
    [assignments],
  );

  const formsMapQuery = useQuery({
    queryKey: ["my-form-defs-map", tenant, formIds],
    queryFn: async () => {
      const out: Record<string, any> = {};
      await Promise.all(
        formIds.map(async (fid) => {
          const r = await getFormDef({
            tenant,
            filter: { id: { eq: fid } },
            fields: ["id", "title", "category", "schema"],
            headers,
          });
          const row = r.success && Array.isArray(r.data) ? (r.data as any[])[0] : null;
          if (row) out[fid] = row;
        }),
      );
      return out;
    },
    enabled: formIds.length > 0,
  });
  const formsById: Record<string, any> = formsMapQuery.data || {};

  const openAssignment = async (a: Assignment) => {
    setActiveAssignmentId(a.id);
    setValues({});
    setSubmission(null);

    let form: any = formsById[a.formId];
    if (!form) {
      const r = await getFormDef({
        tenant,
        filter: { id: { eq: a.formId } },
        fields: ["id", "title", "category", "schema"],
        headers,
      });
      if (r.success && Array.isArray(r.data)) form = (r.data as any[])[0];
    }
    setActiveForm(form || null);

    if (a.status === "submitted" && a.submissionId) {
      const sR = await getFormSubmission({
        tenant,
        filter: { id: { eq: a.submissionId } },
        fields: ["id", "values", "status", "reviewNote"],
        headers,
      });
      if (sR.success && Array.isArray(sR.data)) {
        const sub = (sR.data as any[])[0];
        setSubmission(sub);
        setValues(sub.values || {});
      }
    }
  };

  const closeAssignment = () => {
    setActiveAssignmentId(null);
    setActiveForm(null);
    setSubmission(null);
    setValues({});
    setAiText("");
  };

  const aiFill = async (kind: "text" | "image") => {
    if (!activeForm) return;
    const payload = kind === "text" ? aiText.trim() : "";
    if (kind === "text" && !payload) {
      message.warning("请先输入自然语言描述");
      return;
    }
    setAiLoading(true);
    try {
      const r = await fetch("/api/forms/ai-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          tenant,
          schema: activeForm.schema,
          ...(kind === "text" ? { text: payload } : { imageUrl: "" }),
        }),
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
    if (!activeForm || !activeAssignmentId) return;
    for (const f of activeForm.schema || []) {
      if (f.required && (values[f.key] == null || values[f.key] === "")) {
        message.warning(`「${f.label}」为必填项`);
        return;
      }
    }
    const finalValues = { ...values };
    for (const f of activeForm.schema || []) {
      if (f.type === "formula" && f.expression) {
        try {
          finalValues[f.key] = evaluateFormula(f.expression, finalValues);
        } catch (e: any) {
          message.warning(`计算字段「${f.label}」求值失败：${e.message}`);
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      const submitR = await submitForm({
        tenant,
        input: {
          formId: activeForm.id,
          submitterId: user?.id,
          values: finalValues,
          assignmentId: activeAssignmentId,
        },
        fields: ["id"],
        headers,
      });
      if (!submitR.success) {
        message.error("提交失败");
        return;
      }
      const submissionId = (submitR as any).data?.id;
      if (!submissionId) {
        message.error("提交返回异常");
        return;
      }
      const markR = await markFormSubmitted({
        tenant,
        primaryKey: activeAssignmentId,
        input: { submissionId },
        fields: ["id", "status", "submissionId"],
        headers,
      });
      if (!markR.success) {
        message.warning("提交已记录，但分配状态更新失败");
      } else {
        message.success("提交成功，等待教师审核");
      }
      assignmentsQuery.refetch();
      closeAssignment();
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (f: any, readOnly = false) => {
    const common = { key: f.key, disabled: readOnly };
    switch (f.type) {
      case "textarea":
        return (
          <Input.TextArea
            rows={3}
            value={values[f.key] || ""}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            {...common}
          />
        );
      case "number":
        return (
          <Input
            type="number"
            value={values[f.key] ?? ""}
            onChange={(e) => setValues({ ...values, [f.key]: Number(e.target.value) })}
            style={{ width: "100%" }}
            {...common}
          />
        );
      case "date":
        return (
          <Input
            type="date"
            value={values[f.key] || ""}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            {...common}
          />
        );
      case "radio":
        return (
          <Radio.Group
            value={values[f.key]}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            options={f.options || []}
            {...common}
          />
        );
      case "checkbox":
        return (
          <Checkbox.Group
            value={values[f.key] || []}
            onChange={(v) => setValues({ ...values, [f.key]: v })}
            options={f.options || []}
            {...common}
          />
        );
      case "select":
        return (
          <Select
            value={values[f.key]}
            onChange={(v) => setValues({ ...values, [f.key]: v })}
            style={{ width: "100%" }}
            options={(f.options || []).map((o: string) => ({ value: o, label: o }))}
            {...common}
          />
        );
      case "image":
      case "attachment":
        return (
          <div>
            {!readOnly && (
              <Upload
                beforeUpload={(file) => doUpload(f.key, file)}
                showUploadList={false}
                accept={f.type === "image" ? "image/*" : undefined}
              >
                <Button icon={<UploadOutlined />} loading={uploadingKey === f.key}>
                  上传{f.type === "image" ? "图片" : "附件"}
                </Button>
              </Upload>
            )}
            {values[f.key] && (
              <div style={{ marginTop: 4 }}>
                <a href={values[f.key]} target="_blank" rel="noreferrer">
                  {values[f.key]}
                </a>
              </div>
            )}
          </div>
        );
      case "formula":
        return (
          <Input
            disabled
            value={f.expression ? `= ${f.expression}` : "（教师配置计算公式）"}
            {...common}
          />
        );
      default:
        return (
          <Input
            value={values[f.key] || ""}
            onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
            {...common}
          />
        );
    }
  };

  if (authLoading || assignmentsQuery.isLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  const activeAssignment = assignments.find((a) => a.id === activeAssignmentId) || null;
  const readOnly = !activeAssignment || activeAssignment.status !== "pending";
  const pendingList = assignments.filter((a) => a.status === "pending");
  const submittedList = assignments.filter((a) => a.status === "submitted");

  const renderAssignmentCard = (a: Assignment, mode: "pending" | "submitted") => {
    const f = formsById[a.formId];
    const title = f?.title || a.formId.slice(0, 8) + "…";
    const category = f?.category;
    const fieldCount = Array.isArray(f?.schema) ? f.schema.length : 0;
    return (
      <Card
        key={a.id}
        size="small"
        hoverable
        onClick={() => openAssignment(a)}
        style={{ height: "100%", borderRadius: 12 }}
        styles={{ body: { display: "flex", flexDirection: "column", height: "100%" } }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <Text strong style={{ fontSize: 16, lineHeight: 1.4 }}>{title}</Text>
            <Tag color={mode === "pending" ? "orange" : "green"} style={{ margin: 0 }}>
              {mode === "pending" ? "待填写" : "已提交"}
            </Tag>
          </div>
          <div style={{ marginTop: 10 }}>
            {category && <Tag color="blue">{category}</Tag>}
            {fieldCount > 0 && <Tag color="purple">{fieldCount} 个字段</Tag>}
          </div>
          <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 12 }}>
            {a.dueAt ? `截止：${dayjs(a.dueAt).format("YYYY-MM-DD")}` : "不限截止时间"}
          </Text>
        </div>
        <Button
          type={mode === "pending" ? "primary" : "default"}
          icon={mode === "pending" ? <EditOutlined /> : <FileTextOutlined />}
          block
          style={{ marginTop: 12 }}
          onClick={(e) => { e.stopPropagation(); openAssignment(a); }}
        >
          {mode === "pending" ? "去填写" : "查看详情"}
        </Button>
      </Card>
    );
  };

  if (activeAssignmentId && activeForm) {
    return (
      <div style={{ padding: "20px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={closeAssignment}>
            返回
          </Button>
        </div>
        <Title level={4} style={{ marginBottom: 4 }}>{activeForm.title}</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
          填写表单内容并提交，等待教师审核
        </Text>
        <Card>
          {submission && (
            <Card
              size="small"
              style={{ marginBottom: 16, background: "#f6ffed", borderColor: "#b7eb8f" }}
              title={
                <Space>
                  <Text strong>提交状态：</Text>
                  <Tag color={submission.status === "approved" ? "green" : submission.status === "rejected" ? "red" : "orange"}>
                    {submission.status === "approved" ? "已批准" : submission.status === "rejected" ? "已驳回" : "待审核"}
                  </Tag>
                </Space>
              }
            >
              {submission.reviewNote && (
                <Text type="secondary">教师备注：{submission.reviewNote}</Text>
              )}
            </Card>
          )}

          {!readOnly && (
            <Card
              size="small"
              title={<span><RobotOutlined /> AI 填表（自然语言回填）</span>}
              style={{ marginBottom: 16, background: "#f6f0ff" }}
            >
              <Input.TextArea
                rows={2}
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                placeholder="如：因感冒请假三天，从明天开始"
                style={{ marginBottom: 8 }}
              />
              <Button loading={aiLoading} onClick={() => aiFill("text")}>
                按描述回填
              </Button>
            </Card>
          )}

          <Row gutter={[16, 16]}>
            {(activeForm.schema || []).map((f: any) => (
              <Col xs={24} md={12} key={f.key}>
                <div style={{ border: "1px solid #f0f0f0", borderRadius: 8, padding: "12px 14px", background: "#fafafa" }}>
                  <Text strong>
                    {f.required && <span style={{ color: "red" }}>* </span>}
                    {f.label}
                  </Text>
                  <div style={{ marginTop: 8 }}>{renderField(f, readOnly)}</div>
                </div>
              </Col>
            ))}
          </Row>

          {!readOnly && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={doSubmit}
              loading={submitting}
              block
              size="large"
              style={{ marginTop: 16 }}
            >
              提交（进入教师审核）
            </Button>
          )}
        </Card>
      </div>
    );
  }

return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ marginBottom: 16 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
      <Title level={4} style={{ marginBottom: 4 }}>数据表单</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 16 }}>
        填写教师分配的表单，并跟踪提交审核状态
      </Text>
      {tenantMismatch && (
        <Alert
          type="warning"
          showIcon
          style={{ margin: "0 0 16px" }}
          message="租户不一致"
          description={
            <span>
              本链接属于租户 <Text code>{urlTenantHint}</Text>，但你当前登录的是 <Text code>{tenant}</Text>。
              看到的可能是空数据。点击下方按钮退出并重新登录，会自动跳回此链接。
              <br />
              <Button
                danger
                type="primary"
                size="small"
                style={{ marginTop: 8 }}
                onClick={switchToUrlTenant}
              >
                退出并用本链接的租户重新登录
              </Button>
            </span>
          }
        />
      )}
      <Card>
        <Tabs
          defaultActiveKey="pending"
          items={[
            {
              key: "pending",
              label: <span><EditOutlined /> 待填写 <Tag color="orange">{pendingList.length}</Tag></span>,
              children:
                pendingList.length === 0 ? (
                  <Empty description="暂无待填写的表单" />
                ) : (
                  <Row gutter={[16, 16]}>
                    {pendingList.map((a) => (
                      <Col xs={24} sm={12} md={8} key={a.id}>
                        {renderAssignmentCard(a, "pending")}
                      </Col>
                    ))}
                  </Row>
                ),
            },
            {
              key: "submitted",
              label: <span><FileTextOutlined /> 已提交 <Tag color="green">{submittedList.length}</Tag></span>,
              children:
                submittedList.length === 0 ? (
                  <Empty description="暂无已提交的表单" />
                ) : (
                  <Row gutter={[16, 16]}>
                    {submittedList.map((a) => (
                      <Col xs={24} sm={12} md={8} key={a.id}>
                        {renderAssignmentCard(a, "submitted")}
                      </Col>
                    ))}
                  </Row>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
