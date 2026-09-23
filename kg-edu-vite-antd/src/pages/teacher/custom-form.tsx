import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Input, Select, Switch, Table, Tag, Space,
  Modal, message, Row, Col, DatePicker, Tabs, Empty, Popconfirm, Form,
} from "antd";
import {
  ArrowLeftOutlined, PlusOutlined, DeleteOutlined, FunctionOutlined,
  CheckCircleOutlined, CloseCircleOutlined, UserAddOutlined,
  UndoOutlined, EditOutlined, FileTextOutlined, TeamOutlined, AuditOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import {
  createFormDef, updateFormDef, deleteFormDef, listFormDefs,
  listFormAssignments, revokeFormAssignment,
  listFormSubmissions, reviewSubmission, getFormDef,
  getUsersFromTenant, assignFormToStudents, getUser,
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

export default function CustomForm() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
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

  const addField = () => {
    const n = builderFields.length + 1;
    setBuilderFields([...builderFields, { key: `field${n}`, label: `题目${n}`, type: "text", required: false }]);
  };

  const [builderOpen, setBuilderOpen] = useState(false);

  const openBuilder = () => {
    resetBuilder();
    setBuilderOpen(true);
  };

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
      input: { id },
      fields: ["id", "title", "category", "schema", "description"],
      headers,
    });
    if (r.success && r.data) {
      const f = r.data as any;
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
      message.warning("请填写标题并添加题目");
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

      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
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
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openBuilder}
                    >
                      新建表单模板
                    </Button>
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
                          render: (v: any) => (
                            <Text style={{ fontSize: 12 }} ellipsis>
                              {v ? JSON.stringify(v).slice(0, 80) : "-"}
                            </Text>
                          ),
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
          <Form.Item label="选择学生（可搜索）">
            <Input
              placeholder="按姓名 / 学号搜索"
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              allowClear
              style={{ marginBottom: 8 }}
            />
            <Select
              mode="multiple"
              style={{ width: "100%" }}
              placeholder="选择学生"
              value={assignStudentIds}
              onChange={setAssignStudentIds}
              loading={studentsQuery.isLoading}
              showSearch
              filterOption={false}
              onSearch={setStudentSearch}
              options={(studentsQuery.data || []).map((u: any) => ({
                value: u.id,
                label: `${u.name || "(无名)"}（${u.memberId || u.id.slice(0, 6)}）`,
              }))}
              maxTagCount={3}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              已选 {assignStudentIds.length} 人
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
                  style={{ width: 150 }} placeholder="题干"
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
          <Button icon={<PlusOutlined />} onClick={addField}>添加题目</Button>
          <Button type="primary" onClick={saveForm}>
            {editingId ? "保存修改" : "保存表单"}
          </Button>
          <Button onClick={closeBuilder}>取消</Button>
        </Space>
      </Modal>
    </div>
  );
}
