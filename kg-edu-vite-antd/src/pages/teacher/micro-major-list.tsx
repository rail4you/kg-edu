import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button, Card, Col, Modal, Row, Select, Space, Table, Tag, Typography, Upload, message, Input, Popconfirm, Progress as ProgressComponent, Tooltip,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined, BookOutlined, TeamOutlined, UploadOutlined, SendOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import { getSTSToken, uploadFileToOSS } from "@/lib/oss-upload";
import {
  listMicroMajors, createMicroMajor, updateMicroMajor, deleteMicroMajor, publishMicroMajor,
  listUsers,
} from "@/lib/ash_rpc";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  draft: { color: "default", label: "草稿" },
  active: { color: "green", label: "已发布" },
  archived: { color: "red", label: "已归档" },
};

interface MicroMajor {
  id: string;
  name: string;
  status: string;
  learningCycle?: string | null;
  assessmentMethod?: string | null;
  tuitionFee?: string | null;
  responsibleTeacherId?: string | null;
  consultantTeacherId?: string | null;
  coverUrl?: string | null;
  intro?: string | null;
  projectBackground?: string | null;
  knowledgeObjective?: string | null;
  abilityObjective?: string | null;
  qualityObjective?: string | null;
  projectFeatures?: string | null;
  insertedAt?: string;
}

type MicroMajorFormData = {
  id?: string;
  name: string;
  projectBackground?: string;
  knowledgeObjective?: string;
  abilityObjective?: string;
  qualityObjective?: string;
  projectFeatures?: string;
  learningCycle?: string;
  assessmentMethod?: string;
  tuitionFee?: string;
  coverUrl?: string;
  intro?: string;
  responsibleTeacherId?: string | null;
  consultantTeacherId?: string | null;
};

const EMPTY_FORM: MicroMajorFormData = { name: "" };

export default function MicroMajorList() {
  const { user, tenant } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  // 创建弹窗状态
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<MicroMajorFormData>({ name: "" });
  const [imageUploading, setImageUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);

  // 编辑弹窗状态
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<MicroMajorFormData>({ name: "" });
  const [editImageUploading, setEditImageUploading] = useState(false);
  const [editImageProgress, setEditImageProgress] = useState(0);

  // 获取教师列表（用于选择负责人和顾问）
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers-for-micro-major", tenant],
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

  // 获取微专业列表（包含所有字段用于编辑）
  const { data: result, isLoading } = useQuery({
    queryKey: ["micro-majors", tenant],
    queryFn: async () => {
      const r = await listMicroMajors({
        tenant: tenant!,
        fields: [
          "id", "name", "status", "learningCycle", "assessmentMethod",
          "tuitionFee", "responsibleTeacherId", "consultantTeacherId", "intro",
          "insertedAt", "projectBackground", "knowledgeObjective",
          "abilityObjective", "qualityObjective", "projectFeatures", "coverUrl",
        ],
        sort: "-insertedAt",
        page: { limit: 100 },
        headers,
      });
      return extractArrayData(r) as MicroMajor[];
    },
    enabled: !!tenant,
  });

  const microMajors: MicroMajor[] = result || [];

  // 创建微专业
  const createMutation = useMutation({
    mutationFn: async () => {
      return createMicroMajor({
        tenant: tenant!,
        input: {
          name: formData.name,
          projectBackground: formData.projectBackground || null,
          knowledgeObjective: formData.knowledgeObjective || null,
          abilityObjective: formData.abilityObjective || null,
          qualityObjective: formData.qualityObjective || null,
          projectFeatures: formData.projectFeatures || null,
          learningCycle: formData.learningCycle || null,
          assessmentMethod: formData.assessmentMethod || null,
          tuitionFee: formData.tuitionFee || null,
          coverUrl: formData.coverUrl || null,
          intro: formData.intro || null,
          responsibleTeacherId: formData.responsibleTeacherId || null,
          consultantTeacherId: formData.consultantTeacherId || null,
        },
        fields: ["id"],
        headers,
      });
    },
    onSuccess: (res: any) => {
      message.success("已创建");
      queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
      setDialogOpen(false);
      setFormData(EMPTY_FORM);
      setImageUploading(false);
      setImageProgress(0);
      if (res?.success && res.data?.id) {
        navigate(`/micro-major/dashboard`);
      }
    },
    onError: () => message.error("创建失败"),
  });

  // 更新微专业
  const updateMutation = useMutation({
    mutationFn: async () => {
      return updateMicroMajor({
        tenant: tenant!,
        primaryKey: editFormData.id!,
        input: {
          name: editFormData.name,
          projectBackground: editFormData.projectBackground || null,
          knowledgeObjective: editFormData.knowledgeObjective || null,
          abilityObjective: editFormData.abilityObjective || null,
          qualityObjective: editFormData.qualityObjective || null,
          projectFeatures: editFormData.projectFeatures || null,
          learningCycle: editFormData.learningCycle || null,
          assessmentMethod: editFormData.assessmentMethod || null,
          tuitionFee: editFormData.tuitionFee || null,
          coverUrl: editFormData.coverUrl || null,
          intro: editFormData.intro || null,
          responsibleTeacherId: editFormData.responsibleTeacherId || null,
          consultantTeacherId: editFormData.consultantTeacherId || null,
        },
        fields: ["id"],
        headers,
      });
    },
    onSuccess: (res: any) => {
      if (res.success) {
        message.success("已保存");
        queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
        setEditDialogOpen(false);
        setEditFormData(EMPTY_FORM);
        setEditImageUploading(false);
        setEditImageProgress(0);
      } else {
        message.error(res.errors?.[0]?.message || "保存失败");
      }
    },
    onError: () => message.error("保存失败"),
  });

  // 删除微专业
  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      deleteMicroMajor({ tenant: tenant!, primaryKey: id, headers }),
    onSuccess: () => {
      message.success("已删除");
      queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
    },
  });

  // 发布微专业
  const publishMutation = useMutation({
    mutationFn: async (id: string) =>
      publishMicroMajor({
        tenant: tenant!,
        primaryKey: id,
        input: { status: "active" },
        fields: ["id", "status"],
        headers,
      }),
    onSuccess: (result: any) => {
      if (result.success) {
        message.success("已发布");
        queryClient.invalidateQueries({ queryKey: ["micro-majors"] });
      } else {
        message.error(result.errors?.[0]?.message || "发布失败");
      }
    },
    onError: () => message.error("发布失败"),
  });

  // 打开编辑弹窗
  const openEditDialog = (record: MicroMajor) => {
    setEditFormData({
      id: record.id,
      name: record.name || "",
      projectBackground: record.projectBackground || "",
      knowledgeObjective: record.knowledgeObjective || "",
      abilityObjective: record.abilityObjective || "",
      qualityObjective: record.qualityObjective || "",
      projectFeatures: record.projectFeatures || "",
      learningCycle: record.learningCycle || "",
      assessmentMethod: record.assessmentMethod || "",
      tuitionFee: record.tuitionFee || "",
      coverUrl: record.coverUrl || "",
      intro: record.intro || "",
      responsibleTeacherId: record.responsibleTeacherId || undefined,
      consultantTeacherId: record.consultantTeacherId || undefined,
    });
    setEditDialogOpen(true);
  };

  const columns: TableColumnsType<MicroMajor> = [
    {
      title: "微专业名称",
      dataIndex: "name",
      key: "name",
      render: (name: string, r: MicroMajor) => (
        <Space direction="vertical" size={0} style={{ maxWidth: "100%" }}>
          <Tooltip title={name} mouseEnterDelay={0.3}>
            <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</Text>
          </Tooltip>
          {r.intro && (
            <Tooltip title={r.intro} mouseEnterDelay={0.3}>
              <Text type="secondary" style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.intro}</Text>
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: "学习周期",
      dataIndex: "learningCycle",
      key: "learningCycle",
      width: 120,
      render: (v: string) => v || "-",
    },
    {
      title: "考核方式",
      dataIndex: "assessmentMethod",
      key: "assessmentMethod",
      width: 120,
      render: (v: string) => v || "-",
    },
    {
      title: "学费",
      dataIndex: "tuitionFee",
      key: "tuitionFee",
      width: 100,
      render: (v: string) => v || "-",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (s: string) => {
        const c = STATUS_CONFIG[s] || { color: "default", label: s };
        return <Tag color={c.color}>{c.label}</Tag>;
      },
    },
    {
      title: "创建时间",
      dataIndex: "insertedAt",
      key: "insertedAt",
      width: 170,
      render: (v: string) => (v ? new Date(v).toLocaleString("zh-CN") : "-"),
    },
    {
      title: "操作",
      key: "actions",
      width: 320,
      render: (_: unknown, r: MicroMajor) => (
        <Space size="small">
          {r.status !== "active" && (
            <ReadonlyActionButton
              size="small"
              type="primary"
              icon={<SendOutlined />}
              loading={publishMutation.isPending}
              onClick={() => publishMutation.mutate(r.id)}
            >
              发布
            </ReadonlyActionButton>
          )}
          {r.status === "active" && (
            <Tag color="green">已发布</Tag>
          )}
          <ReadonlyActionButton
            size="small"
            type="link"
            icon={<EditOutlined />}
            onClick={() => openEditDialog(r)}
          >
            编辑
          </ReadonlyActionButton>
          <Button
            size="small"
            type="link"
            icon={<BookOutlined />}
            onClick={() => navigate(`/teacher/dashboard/micro-major-courses/${r.id}`)}
          >
            课程
          </Button>
          <Button
            size="small"
            type="link"
            icon={<TeamOutlined />}
            onClick={() => navigate(`/micro-major/student-management?mmId=${r.id}`)}
          >
            学生
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => deleteMutation.mutate(r.id)}>
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 表单内容组件（创建和编辑共用）
  const renderFormContent = (isEdit: boolean) => {
    const currentFormData = isEdit ? editFormData : formData;
    const setFormDataFn = isEdit ? setEditFormData : setFormData;
    const isUploading = isEdit ? editImageUploading : imageUploading;
    const setImageUploadingFn = isEdit ? setEditImageUploading : setImageUploading;
    const imageProgressVal = isEdit ? editImageProgress : imageProgress;
    const setImageProgressFn = isEdit ? setEditImageProgress : setImageProgress;

    return (
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        {/* 基本信息 */}
        <Card type="inner" title="基本信息" size="small">
          <div style={{ marginBottom: 16 }}>
            <Text>微专业名称 *</Text>
            <Input
              value={currentFormData.name}
              onChange={(e) => setFormDataFn({ ...currentFormData, name: e.target.value })}
              placeholder="请输入微专业名称"
            />
          </div>

          {/* 封面图片 - 单独一行 */}
          <div style={{ marginBottom: 12 }}>
            <Text>封面图片</Text>
            {currentFormData.coverUrl && (
              <div style={{ marginBottom: 8, marginTop: 8 }}>
                <img
                  src={currentFormData.coverUrl}
                  alt="封面预览"
                  style={{ width: 160, height: 100, objectFit: "cover", borderRadius: 8, border: "1px solid #d9d9d9" }}
                />
              </div>
            )}
            {isUploading ? (
              <ProgressComponent percent={imageProgressVal} size="small" style={{ width: 200, marginTop: 8 }} />
            ) : (
              <Upload
                beforeUpload={async (file) => {
                  if (file.size > 10 * 1024 * 1024) { message.error("图片不能超过10MB"); return false; }
                  if (!file.type.startsWith("image/")) { message.error("只能上传图片"); return false; }
                  setImageUploadingFn(true);
                  setImageProgressFn(0);
                  try {
                    const sts = await getSTSToken(file.name, file.size, file.type);
                    const result = await uploadFileToOSS(sts, { file, onProgress: (p) => setImageProgressFn(Math.min(p.percent, 90)) });
                    setFormDataFn({ ...currentFormData, coverUrl: result.url });
                    setImageProgressFn(100);
                    message.success("封面上传成功");
                  } catch (err: any) {
                    message.error(err?.message || "上传失败");
                  } finally {
                    setImageUploadingFn(false);
                  }
                  return false;
                }}
                showUploadList={false}
                accept="image/*"
              >
                <Button icon={<UploadOutlined />} size="small">上传封面图片</Button>
              </Upload>
            )}
          </div>

          <div>
            <Text>简短介绍</Text>
            <Input.TextArea
              value={currentFormData.intro || ""}
              onChange={(e) => setFormDataFn({ ...currentFormData, intro: e.target.value })}
              placeholder="一句话介绍微专业"
              rows={2}
            />
          </div>
        </Card>

        {/* 项目信息 */}
        <Card type="inner" title="项目信息" size="small">
          <div style={{ marginBottom: 12 }}>
            <Text>项目背景</Text>
            <Input.TextArea
              value={currentFormData.projectBackground || ""}
              onChange={(e) => setFormDataFn({ ...currentFormData, projectBackground: e.target.value })}
              placeholder="介绍项目的背景和意义"
              rows={3}
            />
          </div>
          <Card type="inner" title="培养目标" size="small" style={{ marginBottom: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <Text>知识目标</Text>
              <Input.TextArea
                value={currentFormData.knowledgeObjective || ""}
                onChange={(e) => setFormDataFn({ ...currentFormData, knowledgeObjective: e.target.value })}
                placeholder="学生应掌握的知识体系"
                rows={2}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <Text>能力目标</Text>
              <Input.TextArea
                value={currentFormData.abilityObjective || ""}
                onChange={(e) => setFormDataFn({ ...currentFormData, abilityObjective: e.target.value })}
                placeholder="学生应具备的能力"
                rows={2}
              />
            </div>
            <div>
              <Text>素养目标</Text>
              <Input.TextArea
                value={currentFormData.qualityObjective || ""}
                onChange={(e) => setFormDataFn({ ...currentFormData, qualityObjective: e.target.value })}
                placeholder="学生应养成的素养"
                rows={2}
              />
            </div>
          </Card>
          <div>
            <Text>项目特色</Text>
            <Input.TextArea
              value={currentFormData.projectFeatures || ""}
              onChange={(e) => setFormDataFn({ ...currentFormData, projectFeatures: e.target.value })}
              placeholder="微专业的特色与亮点"
              rows={2}
            />
          </div>
        </Card>

        {/* 学习信息 */}
        <Card type="inner" title="学习信息" size="small">
          <Row gutter={16}>
            <Col span={8}>
              <Text>学习周期</Text>
              <Input
                value={currentFormData.learningCycle || ""}
                onChange={(e) => setFormDataFn({ ...currentFormData, learningCycle: e.target.value })}
                placeholder="如：一学期、6个月"
              />
            </Col>
            <Col span={8}>
              <Text>考核方式</Text>
              <Input
                value={currentFormData.assessmentMethod || ""}
                onChange={(e) => setFormDataFn({ ...currentFormData, assessmentMethod: e.target.value })}
                placeholder="如：过程性评价+终结性评价"
              />
            </Col>
            <Col span={8}>
              <Text>学费标准</Text>
              <Input
                value={currentFormData.tuitionFee || ""}
                onChange={(e) => setFormDataFn({ ...currentFormData, tuitionFee: e.target.value })}
                placeholder="如：免费、2000元"
              />
            </Col>
          </Row>
        </Card>

        {/* 负责人 */}
        <Card type="inner" title="负责人" size="small">
          <Row gutter={16}>
            <Col span={12}>
              <Text>微专业负责人</Text>
              <Select
                allowClear
                placeholder="选择负责人"
                options={teacherOptions}
                showSearch
                optionFilterProp="label"
                value={currentFormData.responsibleTeacherId || undefined}
                onChange={(v) => setFormDataFn({ ...currentFormData, responsibleTeacherId: v || undefined })}
                style={{ width: "100%" }}
              />
            </Col>
            <Col span={12}>
              <Text>微专业顾问</Text>
              <Select
                allowClear
                placeholder="选择顾问"
                options={teacherOptions}
                showSearch
                optionFilterProp="label"
                value={currentFormData.consultantTeacherId || undefined}
                onChange={(v) => setFormDataFn({ ...currentFormData, consultantTeacherId: v || undefined })}
                style={{ width: "100%" }}
              />
            </Col>
          </Row>
        </Card>
      </Space>
    );
  };

  return (
    <div className="micro-major-list-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.micro-major-list-wrap{padding:12px!important}.micro-major-list-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Space>
              <ApartmentOutlined style={{ fontSize: 20, color: "#1890ff" }} />
                        <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>微专业管理</Title>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setFormData(EMPTY_FORM);
                setDialogOpen(true);
              }}
              style={canEdit ? undefined : { display: "none" }}
            >
              创建微专业
            </Button>
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={microMajors}
          rowKey="id"
          loading={isLoading}
          pagination={{ pageSize: 15, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      {/* 创建微专业弹窗 */}
      <Modal
        title="创建微专业"
        open={dialogOpen}
        onCancel={() => setDialogOpen(false)}
        onOk={() => createMutation.mutate()}
        confirmLoading={createMutation.isPending}
        width={720}
        style={{ top: 20 }}
      >
        <div style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto", paddingRight: 8 }}>
          {renderFormContent(false)}
        </div>
      </Modal>

      {/* 编辑微专业弹窗 */}
      <Modal
        title="编辑微专业"
        open={editDialogOpen}
        onCancel={() => setEditDialogOpen(false)}
        onOk={() => updateMutation.mutate()}
        confirmLoading={updateMutation.isPending}
        width={720}
        style={{ top: 20 }}
      >
        <div style={{ maxHeight: "calc(100vh - 200px)", overflowY: "auto", paddingRight: 8 }}>
          {renderFormContent(true)}
        </div>
      </Modal>
    </div>
  );
}