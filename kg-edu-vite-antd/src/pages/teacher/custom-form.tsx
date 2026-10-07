import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Input, Select, Switch, Table, Tag, Space,
  Modal, message, Row, Col, DatePicker, Tabs, Empty, Popconfirm, Form, Dropdown,
} from "antd";
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, FunctionOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UserAddOutlined,
  UndoOutlined, EditOutlined, FileTextOutlined, TeamOutlined, AuditOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  createFormDef, updateFormDef, deleteFormDef, listFormDefs,
  listFormAssignments, revokeFormAssignment,
  listFormSubmissions, reviewSubmission, getFormDef,
  getUsersFromTenant, assignFormToStudents, getUser, listClasses,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { evaluateFormula } from "@/lib/practice";
import dayjs, { Dayjs } from "dayjs";
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

interface FormPreset {
  title: string;
  category: string;
  fields: FieldItem[];
}

const FORM_PRESETS: FormPreset[] = [
  {
    title: "调查问卷",
    category: "问卷",
    fields: [
      { key: "name", label: "姓名", type: "text", required: true },
      { key: "grade", label: "年级/班级", type: "text", required: false },
      { key: "satisfaction", label: "总体满意度", type: "radio", required: true, options: ["非常满意", "满意", "一般", "不满意"] },
      { key: "likes", label: "您最喜欢的课程或环节", type: "checkbox", required: false, options: ["课堂教学", "实践操作", "小组讨论", "课后作业"] },
      { key: "comment", label: "意见建议", type: "textarea", required: false },
      { key: "join_again", label: "是否愿意参加后续活动", type: "radio", required: true, options: ["愿意", "不愿意"] },
    ],
  },
  {
    title: "请假申请",
    category: "请假",
    fields: [
      { key: "name", label: "姓名", type: "text", required: true },
      { key: "leave_type", label: "请假类型", type: "select", required: true, options: ["事假", "病假", "年假"] },
      { key: "start_date", label: "开始日期", type: "date", required: true },
      { key: "end_date", label: "结束日期", type: "date", required: true },
      { key: "reason", label: "请假事由", type: "textarea", required: false },
    ],
  },
  {
    title: "报名表",
    category: "报名",
    fields: [
      { key: "name", label: "姓名", type: "text", required: true },
      { key: "student_no", label: "学号", type: "text", required: true },
      { key: "class", label: "班级", type: "select", required: false, options: ["一年级", "二年级", "三年级", "四年级"] },
      { key: "phone", label: "联系电话", type: "number", required: true },
      { key: "projects", label: "报名项目", type: "checkbox", required: true, options: ["编程", "美术", "音乐", "体育"] },
      { key: "note", label: "备注", type: "textarea", required: false },
    ],
  },
  {
    title: "报销申请",
    category: "报销",
    fields: [
      { key: "name", label: "报销人", type: "text", required: true },
      { key: "item", label: "报销项目", type: "text", required: true },
      { key: "amount", label: "金额（元）", type: "number", required: true },
      { key: "date", label: "报销日期", type: "date", required: true },
      { key: "invoice", label: "发票附件", type: "attachment", required: false },
      { key: "note", label: "说明", type: "textarea", required: false },
    ],
  },
];

export default function CustomForm() {
  const navigate = useNavigate();
  const { user, tenant: authTenant, loading: authLoading } = useAuth();
  // 优先使用登录态里的当前租户（JWT 同一来源），fallback 到 localStorage。
  const currentTenant = getCurrentTenant();
  const tenant = authTenant || currentTenant?.schemaName || "";
  const tenantLabel =
    currentTenant?.name || currentTenant?.schemaName || tenant || "当前租户";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [builderTitle, setBuilderTitle] = useState("");
  const [builderCategory, setBuilderCategory] = useState("申请");
  const [builderFields, setBuilderFields] = useState<FieldItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formulaGoal, setFormulaGoal] = useState("");
  const [formulaIdx, setFormulaIdx] = useState<number | null>(null);
  const [formulaLoading, setFormulaLoading] = useState(false);
  const [formulaExplain, setFormulaExplain] = useState("");

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignFormId, setAssignFormId] = useState<string | null>(null);
  const [assignFormTitle, setAssignFormTitle] = useState("");
  const [assignStudentIds, setAssignStudentIds] = useState<string[]>([]);
  const [assignDueAt, setAssignDueAt] = useState<Dayjs | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [classFilter, setClassFilter] = useState<string[]>([]);

  const formsQuery = useQuery({
    queryKey: ["form-defs", tenant],
    queryFn: async () => {
      const r = await listFormDefs({
        tenant,
        fields: ["id", "title", "category", "description"],
        headers,
      });
      return r.success ? (r.data as any[]) : [];
    },
    enabled: !!user,
  });

  const formsList: any[] = formsQuery.data || [];
  const formsById = Object.fromEntries(formsList.map((f: any) => [f.id, f]));

  const assignmentsQuery = useQuery({
    queryKey: ["form-assignments", tenant],
    queryFn: async () => {
      const r = await listFormAssignments({
        tenant,
        fields: [
          "id", "formId", "studentId", "status", "dueAt",
          "assignedById", "submissionId",
        ],
        page: { limit: 500, count: false },
        headers,
      });
      if (!r.success) return [];
      const data = r.data as any;
      return Array.isArray(data) ? data : data?.results || [];
    },
    enabled: !!user,
  });
  const assignments: any[] = assignmentsQuery.data || [];

  const submissionsQuery = useQuery({
    queryKey: ["form-submissions-all", tenant],
    queryFn: async () => {
      const r = await listFormSubmissions({
        tenant,
        fields: [
          "id", "formId", "submitterId", "values", "status",
          "assignmentId", "reviewNote",
        ],
        page: { limit: 500, count: false },
        headers,
      });
      if (!r.success) return [];
      const data = r.data as any;
      return Array.isArray(data) ? data : data?.results || [];
    },
    enabled: !!user,
  });
  const submissions: any[] = submissionsQuery.data || [];

  const studentsQuery = useQuery({
    queryKey: ["tenant-students-for-assign", tenant, studentSearch],
    queryFn: async () => {
      const r = await getUsersFromTenant({
        tenant,
        fields: ["id", "memberId", "name", "classId"],
        filter: { role: { eq: "user" } },
        page: { limit: 500, count: false },
        headers,
      });
      if (!r.success) return [];
      const data = r.data as any;
      const list: any[] = Array.isArray(data) ? data : data?.results || [];
      const kw = studentSearch.trim().toLowerCase();
      if (!kw) return list;
      return list.filter((u: any) =>
        (u.name || "").toLowerCase().includes(kw) ||
        (u.memberId || "").toLowerCase().includes(kw),
      );
    },
    enabled: !!user && assignModalOpen,
  });

  const allStudentsQuery = useQuery({
    queryKey: ["tenant-students-all", tenant],
    queryFn: async () => {
      const r = await getUsersFromTenant({
        tenant,
        fields: ["id", "memberId", "name"],
        filter: { role: { eq: "user" } },
        page: { limit: 1000, count: false },
        headers,
      });
      if (!r.success) return [];
      const data = r.data as any;
      return (Array.isArray(data) ? data : data?.results || []) as any[];
    },
    enabled: !!user,
  });
  const classesQuery = useQuery({
    queryKey: ["tenant-classes-for-assign", tenant],
    queryFn: async () => {
      const r = await listClasses({
        tenant,
        fields: ["id", "name", "major"],
        sort: "+name",
        page: { limit: 500, offset: 0 },
        headers,
      });
      if (!r.success) return [];
      const data = r.data as any;
      return (Array.isArray(data) ? data : data?.results || []) as any[];
    },
    enabled: !!user && assignModalOpen,
  });

  const classMap: Record<string, string> = React.useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of classesQuery.data || []) {
      if (c?.id) m[c.id] = c.name || c.major || c.id.slice(0, 6);
    }
    return m;
  }, [classesQuery.data]);

  const classOptions = React.useMemo(
    () =>
      (classesQuery.data || []).map((c: any) => ({
        value: c.id,
        label: c.name || c.major || String(c.id).slice(0, 6),
      })),
    [classesQuery.data],
  );

  const assignStudents: any[] = studentsQuery.data || [];

  const filteredStudents = React.useMemo(() => {
    const list = classFilter.length
      ? assignStudents.filter((s) => classFilter.includes(s.classId))
      : assignStudents;
    return [...list].sort((a, b) => {
      const ca = classMap[a.classId] || "";
      const cb = classMap[b.classId] || "";
      if (ca !== cb) return ca.localeCompare(cb, "zh");
      return (a.name || "").localeCompare(b.name || "", "zh");
    });
  }, [assignStudents, classFilter, classMap]);

  const studentsMap: Record<string, { name: string; memberId?: string }> =
    React.useMemo(() => {
      const list = allStudentsQuery.data || [];
      const m: Record<string, { name: string; memberId?: string }> = {};
      for (const u of list) {
        if (u?.id) m[u.id] = { name: u.name || "(无名)", memberId: u.memberId };
      }
      return m;
    }, [allStudentsQuery.data]);

  const studentLabel = (id: string) => {
    const s = studentsMap[id];
    if (!s) return id?.slice(0, 8) + "…";
    return `${s.name}${s.memberId ? `（${s.memberId}）` : ""}`;
  };

  const renderSubmissionValues = (values: any, formId: string) => {
    if (!values || typeof values !== "object") return <Text type="secondary">-</Text>;
    const schema = Array.isArray(formsById[formId]?.schema) ? formsById[formId].schema : [];
    const labelMap = Object.fromEntries(schema.map((f: any) => [f.key, f.label || f.key]));
    const entries = Object.entries(values);
    if (entries.length === 0) return <Text type="secondary">-</Text>;
    return (
      <div style={{ fontSize: 12, maxWidth: 320 }}>
        {entries.map(([k, val]) => {
          const label = labelMap[k] || k;
          const display = Array.isArray(val) ? val.join("、") : val == null ? "-" : String(val);
          return (
            <div key={k} style={{ lineHeight: 1.7, whiteSpace: "normal" }}>
              <Text type="secondary">{label}：</Text>
              {display}
            </div>
          );
        })}
      </div>
    );
  };

  const addField = () => {
    const n = builderFields.length + 1;
    setBuilderFields([...builderFields, { key: `field${n}`, label: `字段${n}`, type: "text", required: false }]);
  };

  const [builderOpen, setBuilderOpen] = useState(false);

  const openBuilderWith = (preset?: FormPreset) => {
    resetBuilder();
    if (preset) {
      setBuilderTitle(preset.title);
      setBuilderCategory(preset.category);
      setBuilderFields(preset.fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined })));
    }
    setBuilderOpen(true);
  };

  const openBuilder = () => openBuilderWith();

  const closeBuilder = () => {
    setBuilderOpen(false);
  };

  const resetBuilder = () => {
    setBuilderTitle("");
    setBuilderCategory("申请");
    setBuilderFields([]);
    setEditingId(null);
    setFormulaIdx(null);
    setFormulaExplain("");
  };

  const editForm = async (id: string) => {
    const r = await getFormDef({
      tenant,
      filter: { id: { eq: id } },
      fields: ["id", "title", "category", "schema", "description"],
      headers,
    });
    if (r.success && Array.isArray(r.data)) {
      const f = (r.data as any[])[0];
      setBuilderTitle(f.title || "");
      setBuilderCategory(f.category || "申请");
      setBuilderFields((f.schema || []) as FieldItem[]);
      setEditingId(f.id);
      setBuilderOpen(true);
    } else {
      message.error("加载表单失败");
    }
  };

  const saveForm = async () => {
    if (!builderTitle.trim() || builderFields.length === 0) {
      message.warning("请填写标题并添加字段");
      return;
    }
    const input = { title: builderTitle, category: builderCategory, schema: builderFields as any };
    const r = editingId
      ? await updateFormDef({ tenant, primaryKey: editingId, input, fields: ["id"], headers })
      : await createFormDef({ tenant, input, fields: ["id"], headers });
    if (r.success) {
      message.success("表单已保存");
      resetBuilder();
      setBuilderOpen(false);
      formsQuery.refetch();
    } else message.error("保存失败");
  };

  const deleteForm = async (id: string) => {
    const r = await deleteFormDef({ tenant, primaryKey: id, headers });
    if (r.success) {
      message.success("已删除");
      formsQuery.refetch();
    } else message.error("删除失败");
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
        body: JSON.stringify({ tenant, fields: builderFields, goal: formulaGoal }),
      }).then((x) => x.json());
      if (r.success) {
        const next = [...builderFields];
        next[formulaIdx] = { ...next[formulaIdx], expression: r.expression };
        setBuilderFields(next);
        setFormulaExplain(r.explanation || "");
        try {
          const demo = evaluateFormula(r.expression, Object.fromEntries(builderFields.map((f) => [f.key, 1])));
          message.success(`公式已生成，示例验算=${demo}`);
        } catch {
          message.success("公式已生成（示例值无法验算，请检查字段）");
        }
      } else message.error(r.error || "生成失败");
    } finally {
      setFormulaLoading(false);
    }
  };

  const openAssignModal = (id: string, title: string) => {
    setAssignFormId(id);
    setAssignFormTitle(title);
    setAssignStudentIds([]);
    setAssignDueAt(null);
    setAssignModalOpen(true);
  };

  const submitAssign = async () => {
    if (!assignFormId) return;
    if (assignStudentIds.length === 0) {
      message.warning("请至少选择一名学生");
      return;
    }
    setAssignSubmitting(true);
    try {
      const r = await assignFormToStudents({
        tenant,
        input: {
          formId: assignFormId,
          studentIds: assignStudentIds,
          dueAt: assignDueAt ? assignDueAt.toISOString() : undefined,
          assignedById: user?.id,
        },
        headers,
      });
      if (r.success) {
        const data = (r as any).data || {};
        message.success(
          `已分配 ${data.created ?? 0} 条` +
            (data.skipped ? `（跳过 ${data.skipped} 条已存在）` : ""),
        );
        setAssignModalOpen(false);
        assignmentsQuery.refetch();
      } else {
        message.error("分配失败");
      }
    } finally {
      setAssignSubmitting(false);
    }
  };

  const revokeAssignment = async (id: string) => {
    const r = await revokeFormAssignment({ tenant, primaryKey: id, headers });
    if (r.success) {
      message.success("已撤回");
      assignmentsQuery.refetch();
    } else message.error("撤回失败");
  };

  const doReview = async (id: string, status: "approved" | "rejected") => {
    const r = await reviewSubmission({
      tenant,
      primaryKey: id,
      input: { status, reviewerId: user?.id },
      fields: ["id", "status"],
      headers,
    });
    if (r.success) {
      message.success(status === "approved" ? "已批准" : "已驳回");
      submissionsQuery.refetch();
      assignmentsQuery.refetch();
    } else message.error("审核失败");
  };

  if (authLoading || formsQuery.isLoading) {
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
        <Title level={4} style={{ margin: 0 }}>自定义表单</Title>
      </div>

      <div style={{ padding: 24 }}>
        <Tabs
          defaultActiveKey="templates"
          items={[
            {
              key: "templates",
              label: (
                <span><FileTextOutlined /> 表单模板</span>
              ),
              children: (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Text strong style={{ fontSize: 16 }}>表单模板列表</Text>
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: [
                          { key: "blank", label: "空白表单", onClick: () => openBuilderWith() },
                          { type: "divider" },
                          ...FORM_PRESETS.map((p) => ({
                            key: p.title,
                            label: p.title,
                            onClick: () => openBuilderWith(p),
                          })),
                        ],
                      }}
                    >
                      <Button type="primary" icon={<PlusOutlined />}>
                        新建表单模板
                      </Button>
                    </Dropdown>
                  </div>
                  <Card>
                    {formsList.length === 0 ? (
                      <Empty description="还没有表单模板，点击右上「新建表单模板」开始" />
                    ) : (
                      <Table
                        size="middle"
                        rowKey="id"
                        pagination={{ pageSize: 10 }}
                        dataSource={formsList}
                        columns={[
                          {
                            title: "标题",
                            dataIndex: "title",
                            render: (v: string, r: any) => (
                              <div>
                                <Text strong>{v}</Text>
                                <div><Tag>{r.category}</Tag></div>
                              </div>
                            ),
                          },
                          {
                            title: "操作",
                            width: 260,
                            render: (_: any, r: any) => (
                              <Space size={4} wrap>
                                <Button
                                  type="link" size="small" icon={<EditOutlined />}
                                  onClick={() => editForm(r.id)}
                                >
                                  编辑
                                </Button>
                                <Button
                                  type="primary" size="small" icon={<UserAddOutlined />}
                                  onClick={() => openAssignModal(r.id, r.title)}
                                >
                                  分配
                                </Button>
                                <Popconfirm title="确认删除该模板？" onConfirm={() => deleteForm(r.id)}>
                                  <Button type="link" size="small" danger icon={<DeleteOutlined />}>
                                    删除
                                  </Button>
                                </Popconfirm>
                              </Space>
                            ),
                          },
                        ]}
                      />
                    )}
                  </Card>
                </>
              ),
            },
            {
              key: "assignments",
              label: (
                <span><TeamOutlined /> 分配记录</span>
              ),
              children: (
                <Card title="分配记录" extra={<Tag color="blue">{assignments.length}</Tag>}>
                  {assignments.length === 0 ? (
                    <Empty description="暂未分配任何表单" />
                  ) : (
                    <Table
                      size="small"
                      rowKey="id"
                      pagination={{ pageSize: 20 }}
                      dataSource={assignments}
                      columns={[
                        {
                          title: "表单",
                          dataIndex: "formId",
                          render: (id: string) => (formsById[id]?.title || id.slice(0, 8) + "…"),
                        },
                        {
                          title: "学生",
                          dataIndex: "studentId",
                          render: (v: string) => studentLabel(v),
                        },
                        {
                          title: "截止时间",
                          dataIndex: "dueAt",
                          render: (v: string) => v ? dayjs(v).format("YYYY-MM-DD") : <Text type="secondary">不限</Text>,
                        },
                        {
                          title: "状态",
                          dataIndex: "status",
                          width: 100,
                          render: (v: string) => (
                            <Tag color={v === "submitted" ? "green" : "orange"}>
                              {v === "submitted" ? "已提交" : "待填写"}
                            </Tag>
                          ),
                        },
                        {
                          title: "操作",
                          width: 120,
                          render: (_: any, r: any) =>
                            r.status === "pending" ? (
                              <Popconfirm title="撤回后该学生将看不到此表单，确认？" onConfirm={() => revokeAssignment(r.id)}>
                                <Button type="link" size="small" danger icon={<UndoOutlined />}>
                                  撤回
                                </Button>
                              </Popconfirm>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                已绑定提交 {r.submissionId?.slice(0, 8) || ""}
                              </Text>
                            ),
                        },
                      ]}
                    />
                  )}
                </Card>
              ),
            },
            {
              key: "submissions",
              label: (
                <span><AuditOutlined /> 学生表单</span>
              ),
              children: (
                <Card title="学生提交（待审批）" extra={<Tag color="blue">{submissions.filter((s: any) => s.status === "submitted").length}</Tag>}>
                  {submissions.length === 0 ? (
                    <Empty description="暂未收到任何学生提交" />
                  ) : (
                    <Table
                      size="small"
                      rowKey="id"
                      pagination={{ pageSize: 20 }}
                      dataSource={submissions}
                      columns={[
                        {
                          title: "表单",
                          dataIndex: "formId",
                          render: (id: string) => (formsById[id]?.title || id.slice(0, 8) + "…"),
                        },
{
                          title: "学生",
                          dataIndex: "submitterId",
                          render: (v: string) => studentLabel(v),
                        },
                        {
                          title: "填报内容",
                          dataIndex: "values",
                          render: (v: any, r: any) => renderSubmissionValues(v, r.formId),
                        },
                        {
                          title: "状态",
                          dataIndex: "status",
                          width: 100,
                          render: (v: string) => (
                            <Tag color={v === "approved" ? "green" : v === "rejected" ? "red" : "orange"}>
                              {v === "approved" ? "已批准" : v === "rejected" ? "已驳回" : "待审核"}
                            </Tag>
                          ),
                        },
                        {
                          title: "操作",
                          width: 160,
                          render: (_: any, r: any) =>
                            r.status === "submitted" ? (
                              <Space size={4}>
                                <Button
                                  type="link" size="small" icon={<CheckCircleOutlined />}
                                  onClick={() => doReview(r.id, "approved")}
                                  style={{ color: "#52c41a" }}
                                >
                                  批准
                                </Button>
                                <Button
                                  type="link" size="small" danger icon={<CloseCircleOutlined />}
                                  onClick={() => doReview(r.id, "rejected")}
                                >
                                  驳回
                                </Button>
                              </Space>
                            ) : (
                              <Text type="secondary" style={{ fontSize: 12 }}>
                                {r.reviewNote || "已处理"}
                              </Text>
                            ),
                        },
                      ]}
                    />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title={`分配表单：${assignFormTitle}`}
        open={assignModalOpen}
        onCancel={() => setAssignModalOpen(false)}
        onOk={submitAssign}
        okText="确认分配"
        cancelText="取消"
        confirmLoading={assignSubmitting}
        width={620}
        destroyOnClose
      >
        <Form layout="vertical">
          <Form.Item label="截止时间（可选）">
            <DatePicker
              style={{ width: "100%" }}
              value={assignDueAt}
              onChange={(d) => setAssignDueAt(d)}
              placeholder="不限制截止时间"
            />
          </Form.Item>
          <Form.Item
            label={
              <span>
                选择学生{" "}
                <Text type="secondary" style={{ fontSize: 12 }}>
                  （仅显示当前租户 <Text code>{tenantLabel}</Text> 的学生）
                </Text>
              </span>
            }
          >
            <Space style={{ width: "100%", marginBottom: 8 }} wrap>
              <Input
                placeholder="按姓名 / 学号搜索"
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                allowClear
                style={{ width: 220 }}
                prefix={<SearchOutlined style={{ color: "#bfbfbf" }} />}
              />
              <Select
                mode="multiple"
                allowClear
                placeholder="按班级筛选 / 分组"
                value={classFilter}
                onChange={setClassFilter}
                loading={classesQuery.isLoading}
                options={classOptions}
                style={{ minWidth: 220, maxWidth: 360 }}
                maxTagCount={2}
                optionFilterProp="label"
              />
              <Button
                size="small"
                onClick={() =>
                  setAssignStudentIds((prev) =>
                    Array.from(new Set([...prev, ...filteredStudents.map((s: any) => s.id)])),
                  )
                }
              >
                全选当前结果（{filteredStudents.length}）
              </Button>
              <Button size="small" onClick={() => setAssignStudentIds([])}>
                清空
              </Button>
            </Space>
            <Table
              size="small"
              rowKey="id"
              dataSource={filteredStudents}
              loading={studentsQuery.isLoading}
              pagination={{ pageSize: 8, showTotal: (t) => `共 ${t} 人` }}
              scroll={{ y: 320 }}
              rowSelection={{
                selectedRowKeys: assignStudentIds,
                preserveSelectedRowKeys: true,
                onChange: (keys) => setAssignStudentIds(keys as string[]),
              }}
              columns={[
                { title: "姓名", dataIndex: "name", render: (v: string) => v || "(无名)" },
                {
                  title: "学号",
                  dataIndex: "memberId",
                  render: (v: string, r: any) => v || String(r.id).slice(0, 8),
                },
                {
                  title: "班级",
                  dataIndex: "classId",
                  render: (v: string) => (v ? classMap[v] || String(v).slice(0, 8) : "—"),
                },
              ]}
            />
            <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
              {tenant ? (
                <>
                  已选 {assignStudentIds.length} 人 ｜ 租户 <Text code>{tenantLabel}</Text>
                </>
              ) : (
                <Text type="warning">
                  ⚠ 当前未识别到租户，请重新登录后再分配
                </Text>
              )}
            </Text>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingId ? "编辑表单模板" : "新建表单模板"}
        open={builderOpen}
        onCancel={closeBuilder}
        width={720}
        destroyOnClose
        footer={null}
      >
        <Space.Compact style={{ width: "100%", marginBottom: 12 }}>
          <Input
            value={builderTitle}
            onChange={(e) => setBuilderTitle(e.target.value)}
            placeholder="表单标题，如：请假申请"
          />
          <Select
            value={builderCategory}
            onChange={setBuilderCategory}
            style={{ width: 130 }}
            options={["请假", "报销", "申请", "报修", "信息采集"].map((c) => ({ value: c, label: c }))}
          />
        </Space.Compact>
        <div style={{ maxHeight: "50vh", overflowY: "auto", paddingRight: 4 }}>
          {builderFields.map((f, i) => (
            <Card key={i} size="small" style={{ marginBottom: 8 }} title={`${i + 1}. ${f.label || "(未命名)"}`}>
              <Space wrap>
                <Input
                  value={f.key}
                  onChange={(e) => { const n = [...builderFields]; n[i] = { ...n[i], key: e.target.value }; setBuilderFields(n); }}
                  style={{ width: 110 }} placeholder="key"
                />
                <Input
                  value={f.label}
                  onChange={(e) => { const n = [...builderFields]; n[i] = { ...n[i], label: e.target.value }; setBuilderFields(n); }}
                  style={{ width: 150 }} placeholder="字段名"
                />
                <Select
                  value={f.type}
                  onChange={(v) => { const n = [...builderFields]; n[i] = { ...n[i], type: v }; setBuilderFields(n); }}
                  style={{ width: 120 }} options={FIELD_TYPES}
                />
                <span>
                  必填 <Switch
                    checked={f.required}
                    onChange={(v) => { const n = [...builderFields]; n[i] = { ...n[i], required: v }; setBuilderFields(n); }}
                  />
                </span>
                <Button
                  danger type="text" icon={<DeleteOutlined />}
                  onClick={() => setBuilderFields(builderFields.filter((_, j) => j !== i))}
                />
              </Space>
              {["radio", "checkbox", "select"].includes(f.type) && (
                <Input
                  style={{ marginTop: 8 }}
                  value={(f.options || []).join(",")}
                  onChange={(e) => {
                    const n = [...builderFields];
                    n[i] = { ...n[i], options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) };
                    setBuilderFields(n);
                  }}
                  placeholder="选项逗号分隔，如：事假,病假"
                />
              )}
              {f.type === "formula" && (
                <div style={{ marginTop: 8 }}>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input
                      value={formulaIdx === i ? formulaGoal : ""}
                      onFocus={() => setFormulaIdx(i)}
                      onChange={(e) => { setFormulaIdx(i); setFormulaGoal(e.target.value); }}
                      placeholder="描述计算目标，如：天数乘以每天200元"
                    />
                    <Button
                      icon={<FunctionOutlined />}
                      loading={formulaLoading && formulaIdx === i}
                      onClick={aiFormula}
                    >
                      AI 生成公式
                    </Button>
                  </Space.Compact>
                  {f.expression && (
                    <Text type="success" style={{ display: "block", marginTop: 4 }}>
                      公式：{f.expression}
                    </Text>
                  )}
                  {formulaIdx === i && formulaExplain && (
                    <Text type="secondary" style={{ display: "block" }}>
                      {formulaExplain}
                    </Text>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
        <Space style={{ marginTop: 16 }}>
          <Button icon={<PlusOutlined />} onClick={addField}>添加字段</Button>
          <Button type="primary" onClick={saveForm}>
            {editingId ? "保存修改" : "保存表单"}
          </Button>
          <Button onClick={closeBuilder}>取消</Button>
        </Space>
      </Modal>
    </div>
  );
}
