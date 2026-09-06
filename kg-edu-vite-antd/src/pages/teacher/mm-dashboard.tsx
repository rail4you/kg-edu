import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Input,
  Popconfirm,
  Form,
  Select,
  Upload,
  Progress,
  Row,
  Col,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ApartmentOutlined,
  BookOutlined,
  TeamOutlined,
  UploadOutlined,
  SendOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import {
  listMicroMajors,
  createMicroMajor,
  deleteMicroMajor,
  getMicroMajor,
  updateMicroMajor,
  publishMicroMajor,
  listUsers,
} from "@/lib/ash_rpc";
import { getSTSToken, uploadFileToOSS } from "@/lib/oss-upload";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "green", label: "已发布" },
  archived: { color: "red", label: "已归档" },
};

const STATUS_OPTIONS = [
  { value: "draft", label: "草稿" },
  { value: "active", label: "已发布" },
  { value: "archived", label: "已归档" },
];

interface MicroMajor {
  id: string;
  name: string;
  status: string;
  learningCycle?: string | null;
  responsibleTeacherId?: string | null;
  consultantTeacherId?: string | null;
  coverUrl?: string | null;
  intro?: string | null;
  insertedAt?: string;
}

export default function MicroMajorDashboard() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  // Create modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm] = Form.useForm();

  // Edit modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm] = Form.useForm();
  const [editInitialized, setEditInitialized] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

  // Fetch micro majors
  const { data: microMajorsData, isLoading } = useQuery({
    queryKey: ["micro-majors", tenant],
    queryFn: async () => {
      const result = await listMicroMajors({
        tenant: tenant!,
        fields: [
          "id", "name", "status", "learningCycle",
          "responsibleTeacherId", "consultantTeacherId",
          "coverUrl", "intro", "insertedAt",
        ],
        headers,
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  const microMajors: MicroMajor[] = (microMajorsData as MicroMajor[]) || [];

  // Teachers for edit modal
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-mm-edit", tenant],
    queryFn: async () => {
      const result = await listUsers({
        tenant: tenant!,
        fields: ["id", "name", "jobTitle"],
        filter: { role: { eq: "teacher" } },
        page: { limit: 500 },
        headers,
      });
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  const teacherOptions = teachers.map((t: any) => ({
    value: t.id,
    label: `${t.name || "未命名"}${t.jobTitle ? ` (${t.jobTitle})` : ""}`,
  }));

  // Fetch edit detail
  const { data: editMicroMajor } = useQuery({
    queryKey: ["micro-major-edit", editId, tenant],
    queryFn: async () => {
      if (!editId) return null;
      const result = await getMicroMajor({
        tenant: tenant!,
        input: { id: editId },
        fields: [
          "id", "name", "projectBackground", "knowledgeObjective", "abilityObjective",
          "qualityObjective", "projectFeatures", "learningCycle", "assessmentMethod",
          "tuitionFee", "coverUrl", "intro", "responsibleTeacherId", "consultantTeacherId",
          "status", "sortOrder",
        ],
        headers,
      });
      if (!result.success) return null;
      const data = result.data as any;
      return Array.isArray(data) ? data[0] : data;
    },
    enabled: !!editId && !!tenant,
  });

  // Initialize edit form when data loads
  useEffect(() => {
    if (editMicroMajor && !editInitialized) {
      editForm.setFieldsValue({
        name: editMicroMajor.name || "",
        projectBackground: editMicroMajor.projectBackground || "",
        knowledgeObjective: editMicroMajor.knowledgeObjective || "",
        abilityObjective: editMicroMajor.abilityObjective || "",
        qualityObjective: editMicroMajor.qualityObjective || "",
        projectFeatures: editMicroMajor.projectFeatures || "",
        learningCycle: editMicroMajor.learningCycle || "",
        assessmentMethod: editMicroMajor.assessmentMethod || "",
        tuitionFee: editMicroMajor.tuitionFee || "",
        coverUrl: editMicroMajor.coverUrl || "",
        intro: editMicroMajor.intro || "",
        responsibleTeacherId: editMicroMajor.responsibleTeacherId || undefined,
        consultantTeacherId: editMicroMajor.consultantTeacherId || undefined,
        status: editMicroMajor.status || "draft",
        sortOrder: editMicroMajor.sortOrder || 0,
      });
      setEditInitialized(true);
    }
  }, [editMicroMajor, editForm, editInitialized]);

  // Create micro major
  const createMutation = useMutation({
    mutationFn: async (values: { name: string; intro?: string }) => {
      return await createMicroMajor({
        tenant: tenant!,
        fields: ["id", "name", "status"],
        input: { name: values.name, intro: values.intro },
        headers,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success("微专业创建成功");
        setCreateModalOpen(false);
        createForm.resetFields();
        queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
        navigate(`/micro-major/dashboard`);
      } else {
        message.error("创建失败");
      }
    },
  });

  // Update micro major
  const updateMutation = useMutation({
    mutationFn: async (values: any) =>
      updateMicroMajor({
        tenant: tenant!,
        primaryKey: editId!,
        input: {
          name: values.name,
          projectBackground: values.projectBackground || null,
          knowledgeObjective: values.knowledgeObjective || null,
          abilityObjective: values.abilityObjective || null,
          qualityObjective: values.qualityObjective || null,
          projectFeatures: values.projectFeatures || null,
          learningCycle: values.learningCycle || null,
          assessmentMethod: values.assessmentMethod || null,
          tuitionFee: values.tuitionFee || null,
          coverUrl: values.coverUrl || null,
          intro: values.intro || null,
          responsibleTeacherId: values.responsibleTeacherId || null,
          consultantTeacherId: values.consultantTeacherId || null,
          status: values.status || "draft",
          sortOrder: values.sortOrder || 0,
        },
        fields: ["id"],
        headers,
      }),
    onSuccess: (result) => {
      if (result.success) {
        message.success("保存成功");
        setEditModalOpen(false);
        setEditId(null);
        setEditInitialized(false);
        editForm.resetFields();
        queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
        navigate(`/micro-major/dashboard`);
      } else {
        message.error((result as any).errors?.[0]?.message || "保存失败");
      }
    },
  });

  // Delete micro major
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await deleteMicroMajor({ tenant: tenant!, primaryKey: id, headers });
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
    },
  });

  // Publish micro major
  const publishMutation = useMutation({
    mutationFn: async (id: string) => {
      return await publishMicroMajor({
        tenant: tenant!,
        primaryKey: id,
        input: { status: "active" },
        fields: ["id", "status"],
        headers,
      });
    },
    onSuccess: (result) => {
      if (result.success) {
        message.success("已发布");
        queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
      } else {
        message.error((result as any).errors?.[0]?.message || "发布失败");
      }
    },
  });

  const openEditModal = (record: MicroMajor) => {
    setEditId(record.id);
    setEditInitialized(false);
    editForm.resetFields();
    setTimeout(() => setEditModalOpen(true), 0);
  };

  const columns: TableColumnsType<MicroMajor> = [
    {
      title: "微专业名称",
      dataIndex: "name",
      key: "name",
      width: 160,
      ellipsis: true,
      render: (name: string, record: MicroMajor) => (
        <a onClick={() => openEditModal(record)}>{name}</a>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (status: string) => {
        const config = STATUS_CONFIG[status] || { color: "default", label: status };
        return <Tag color={config.color}>{config.label}</Tag>;
      },
    },
    {
      title: "学习周期",
      dataIndex: "learningCycle",
      key: "learningCycle",
      width: 100,
      render: (v: string) => v || "-",
    },
    {
      title: "简介",
      dataIndex: "intro",
      key: "intro",
      width: 120,
      ellipsis: true,
      render: (v: string) => (
        <Text
          ellipsis={{ tooltip: v }}
          style={{ maxWidth: "100%" }}
        >
          {v || "-"}
        </Text>
      ),
    },
    {
      title: "创建时间",
      dataIndex: "insertedAt",
      key: "insertedAt",
      width: 160,
      render: (v: string) => (v ? new Date(v).toLocaleString("zh-CN") : "-"),
    },
    {
      title: "操作",
      key: "actions",
      width: 380,
      render: (_: any, record: MicroMajor) => (
        <Space size="small" wrap>
          {record.status !== "active" && (
            <ReadonlyActionButton
              size="small"
              type="link"
              icon={<SendOutlined />}
              onClick={() => publishMutation.mutate(record.id)}
              loading={publishMutation.isPending}
            >
              发布
            </ReadonlyActionButton>
          )}
          <ReadonlyActionButton
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </ReadonlyActionButton>
          <Button
            size="small"
            type="link"
            icon={<BookOutlined />}
            onClick={() => navigate(`/micro-major/${record.id}/courses`)}
          >
            课程
          </Button>

          <Popconfirm
            title="确定要删除此微专业吗？"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <ReadonlyActionButton size="small" type="link" danger icon={<DeleteOutlined />}>
              删除
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="mm-dashboard-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-dashboard-wrap{padding:12px!important}.mm-dashboard-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={3} style={{ margin: 0 }}>
          <ApartmentOutlined style={{ marginRight: 8 }} />
          微专业管理
        </Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => setCreateModalOpen(true)}
          style={canEdit ? undefined : { display: "none" }}
        >
          创建微专业
        </Button>
      </div>

      <Card>
        <Table
          columns={columns}
          dataSource={microMajors}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 20 }}
          scroll={{ x: 900 }}
        />
      </Card>

      {/* Create Modal */}
      <Modal
        title="创建微专业"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
        confirmLoading={createMutation.isPending}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={(values) => createMutation.mutate(values)}
        >
          <Form.Item
            name="name"
            label="微专业名称"
            rules={[{ required: true, message: "请输入微专业名称" }]}
          >
            <Input placeholder="请输入微专业名称" />
          </Form.Item>
          <Form.Item name="intro" label="简介">
            <Input.TextArea rows={3} placeholder="请输入简介" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑微专业"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditId(null);
          setEditInitialized(false);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={updateMutation.isPending}
        width={720}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => updateMutation.mutate(values)}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="微专业名称" rules={[{ required: true, message: "请输入名称" }]}>
                <Input placeholder="请输入微专业名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="状态">
                <Select options={STATUS_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="intro" label="简短介绍">
            <Input.TextArea rows={2} placeholder="一句话介绍微专业" />
          </Form.Item>

          <Form.Item label="封面图片">
            <Form.Item name="coverUrl" noStyle>
              <Input type="hidden" />
            </Form.Item>
            {editForm.getFieldValue("coverUrl") && (
              <div style={{ marginBottom: 8 }}>
                <img
                  src={editForm.getFieldValue("coverUrl")}
                  alt="封面预览"
                  style={{ width: 160, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #d9d9d9" }}
                />
              </div>
            )}
            {imageUploading ? (
              <Progress percent={imageProgress} size="small" style={{ width: 200 }} />
            ) : (
              <Upload
                beforeUpload={async (file) => {
                  if (file.size > 10 * 1024 * 1024) { message.error("图片不能超过10MB"); return false; }
                  if (!file.type.startsWith("image/")) { message.error("只能上传图片"); return false; }
                  setImageUploading(true);
                  setImageProgress(0);
                  try {
                    const sts = await getSTSToken(file.name, file.size, file.type);
                    const result = await uploadFileToOSS(sts, { file, onProgress: (p) => setImageProgress(Math.min(p.percent, 90)) });
                    editForm.setFieldValue("coverUrl", result.url);
                    setImageProgress(100);
                    message.success("封面上传成功");
                  } catch (err: any) {
                    message.error(err?.message || "上传失败");
                  } finally {
                    setImageUploading(false);
                  }
                  return false;
                }}
                showUploadList={false}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />} size="small">上传封面图片</Button>
              </Upload>
            )}
          </Form.Item>

          <Form.Item name="projectBackground" label="项目背景">
            <Input.TextArea rows={3} placeholder="介绍项目的背景和意义" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="knowledgeObjective" label="知识目标">
                <Input.TextArea rows={3} placeholder="知识体系" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="abilityObjective" label="能力目标">
                <Input.TextArea rows={3} placeholder="应具备的能力" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="qualityObjective" label="素养目标">
                <Input.TextArea rows={3} placeholder="应养成的素养" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="projectFeatures" label="项目特色">
            <Input.TextArea rows={3} placeholder="项目的特色和亮点" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="learningCycle" label="学习周期">
                <Input placeholder="如：8周" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="assessmentMethod" label="考核方式">
                <Input placeholder="如：过程考核+结业考试" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="tuitionFee" label="学费标准">
                <Input placeholder="如：免费/500元" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="responsibleTeacherId" label="微专业负责人">
                <Select options={teacherOptions} allowClear placeholder="选择教师" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="consultantTeacherId" label="微专业顾问">
                <Select options={teacherOptions} allowClear placeholder="选择教师" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
}
