import { useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Select,
  Table,
  Modal,
  Form,
  Input,
  Space,
  message,
  Alert,
  Spin,
  Popconfirm,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import EmptyState from "@/components/EmptyState";
import {
  listCourseInfos,
  createCourseInfo,
  updateCourseInfo,
  deleteCourseInfo,
} from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import type { ColumnsType } from "antd/es/table";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;

const getHeaders = (user: unknown): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  teacherId?: string;
}

interface CourseInfo {
  id: string;
  courseId: string;
  background: string;
  objectives?: string;
  target?: string;
  courseHighlights?: string;
  courseIntroduction?: string;
  courseStructure?: string;
  graduationRequirements?: string;
  course?: { title: string };
}

interface CourseInfoFormValues {
  background: string;
  objectives?: string;
  target?: string;
  courseHighlights?: string;
  courseIntroduction?: string;
  courseStructure?: string;
  graduationRequirements?: string;
}

const multiLineCellStyle: CSSProperties = {
  display: "-webkit-box",
  overflow: "hidden",
  WebkitBoxOrient: "vertical",
  WebkitLineClamp: 3,
  lineHeight: "22px",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const renderMultiLineText = (text?: string | null) => {
  const content = text?.trim() || "-";
  return (
    <Tooltip title={content}>
      <Text style={multiLineCellStyle}>{content}</Text>
    </Tooltip>
  );
};

export default function CourseInfoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const [form] = Form.useForm();
  const { canEdit } = useEditPermission();

  // 监听表单字段变化，实现响应式更新
  const [backgroundValue, setBackgroundValue] = useState<string>("");

  const handleValuesChange = (changedValues: Partial<CourseInfoFormValues>) => {
    if ("background" in changedValues) {
      setBackgroundValue(changedValues.background || "");
    }
  };

  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCourseInfo, setEditingCourseInfo] = useState<CourseInfo | null>(
    null,
  );

  const {
    courses,
    loading: coursesLoading,
    error: coursesError,
  } = useCourses({
    fields: ["id", "title", "description", "imageUrl", "teacherId"],
  });
  const activeCourseId = selectedCourseId || courses[0]?.id || "";

  const {
    data: courseInfos = [],
    isLoading: courseInfosLoading,
  } = useQuery({
    queryKey: ["courseInfos", activeCourseId, tenant],
    queryFn: async () => {
      if (!activeCourseId) return [];
      const result = await listCourseInfos({
        tenant,
        fields: [
          "id",
          "courseId",
          "background",
          "objectives",
          "target",
          "courseHighlights",
          "courseIntroduction",
          "courseStructure",
          "graduationRequirements",
          { course: ["title"] },
        ],
        filter: { courseId: { eq: activeCourseId } },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!activeCourseId && !!user,
  });

  const createMutation = useMutation({
    mutationFn: async (values: CourseInfoFormValues) => {
      const result = await createCourseInfo({
        tenant,
        input: {
          courseId: activeCourseId,
          background: values.background,
          objectives: values.objectives || null,
          target: values.target || null,
          courseHighlights: values.courseHighlights || null,
          courseIntroduction: values.courseIntroduction || null,
          courseStructure: values.courseStructure || null,
          graduationRequirements: values.graduationRequirements || null,
        },
        fields: [
          "id",
          "courseId",
          "background",
          "objectives",
          "target",
          "courseHighlights",
          "courseIntroduction",
          "courseStructure",
          "graduationRequirements",
        ],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to create course info");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseInfos"] });
      setCreateModalOpen(false);
      form.resetFields();
      message.success("课程信息创建成功");
    },
    onError: (error: unknown) => {
      message.error(`创建失败: ${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CourseInfoFormValues) => {
      if (!editingCourseInfo) return;
      const result = await updateCourseInfo({
        tenant,
        primaryKey: editingCourseInfo.id,
        input: {
          courseId: editingCourseInfo.courseId,
          background: values.background,
          objectives: values.objectives || null,
          target: values.target || null,
          courseHighlights: values.courseHighlights || null,
          courseIntroduction: values.courseIntroduction || null,
          courseStructure: values.courseStructure || null,
          graduationRequirements: values.graduationRequirements || null,
        },
        fields: [
          "id",
          "courseId",
          "background",
          "objectives",
          "target",
          "courseHighlights",
          "courseIntroduction",
          "courseStructure",
          "graduationRequirements",
        ],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to update course info");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseInfos"] });
      setEditModalOpen(false);
      setEditingCourseInfo(null);
      form.resetFields();
      message.success("课程信息更新成功");
    },
    onError: (error: unknown) => {
      message.error(`更新失败: ${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteCourseInfo({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to delete course info");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseInfos"] });
      message.success("课程信息删除成功");
    },
    onError: (error: unknown) => {
      message.error(`删除失败: ${error instanceof Error ? error.message : "未知错误"}`);
    },
  });

  const handleCreate = () => {
    if (!activeCourseId) {
      message.error("请先选择一个课程");
      return;
    }
    form.resetFields();
    setBackgroundValue("");
    setCreateModalOpen(true);
  };

  const handleEdit = (record: CourseInfo) => {
    setEditingCourseInfo(record);
    form.setFieldsValue({
      background: record.background,
      objectives: record.objectives || "",
      target: record.target || "",
      courseHighlights: record.courseHighlights || "",
      courseIntroduction: record.courseIntroduction || "",
      courseStructure: record.courseStructure || "",
      graduationRequirements: record.graduationRequirements || "",
    });
    setEditModalOpen(true);
  };

  const handleSubmit = (values: CourseInfoFormValues) => {
    if (editingCourseInfo) {
      updateMutation.mutate(values);
    } else {
      createMutation.mutate(values);
    }
  };

  const columns: ColumnsType<CourseInfo> = [
    {
      title: "背景",
      dataIndex: "background",
      key: "background",
      width: 150,
      render: (text: string) => renderMultiLineText(text),
      onCell: () => ({ style: { paddingTop: 14, paddingBottom: 14, verticalAlign: "top" } }),
    },
    {
      title: "目标",
      dataIndex: "objectives",
      key: "objectives",
      width: 100,
      render: (text: string) => renderMultiLineText(text),
      onCell: () => ({ style: { paddingTop: 14, paddingBottom: 14, verticalAlign: "top" } }),
    },
    {
      title: "对象",
      dataIndex: "target",
      key: "target",
      width: 80,
      render: (text: string) => renderMultiLineText(text),
      onCell: () => ({ style: { paddingTop: 14, paddingBottom: 14, verticalAlign: "top" } }),
    },
    {
      title: "课程亮点",
      dataIndex: "courseHighlights",
      key: "courseHighlights",
      width: 120,
      render: (text: string) => renderMultiLineText(text),
      onCell: () => ({ style: { paddingTop: 14, paddingBottom: 14, verticalAlign: "top" } }),
    },
    {
      title: "课程介绍",
      dataIndex: "courseIntroduction",
      key: "courseIntroduction",
      width: 120,
      render: (text: string) => renderMultiLineText(text),
      onCell: () => ({ style: { paddingTop: 14, paddingBottom: 14, verticalAlign: "top" } }),
    },
    {
      title: "课程结构",
      dataIndex: "courseStructure",
      key: "courseStructure",
      width: 120,
      render: (text: string) => renderMultiLineText(text),
      onCell: () => ({ style: { paddingTop: 14, paddingBottom: 14, verticalAlign: "top" } }),
    },
    {
      title: "毕业要求",
      dataIndex: "graduationRequirements",
      key: "graduationRequirements",
      width: 150,
      render: (text: string) => renderMultiLineText(text),
      onCell: () => ({ style: { paddingTop: 14, paddingBottom: 14, verticalAlign: "top" } }),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (_: unknown, record: CourseInfo) => (
        <Space>
          <Tooltip title="编辑">
            <ReadonlyActionButton
              type="text"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Popconfirm
            title="确定要删除这个课程信息吗？"
            description="此操作无法撤销。"
            onConfirm={() => deleteMutation.mutate(record.id)}
          >
            <Tooltip title="删除">
              <ReadonlyActionButton type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderForm = () => (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      onValuesChange={handleValuesChange}
    >
      <Form.Item
        name="background"
        label="背景"
        rules={[{ required: true, message: "请输入背景" }]}
      >
        <TextArea rows={3} placeholder="请输入背景" />
      </Form.Item>
      <Form.Item name="objectives" label="目标">
        <TextArea rows={2} placeholder="请输入目标" />
      </Form.Item>
      <Form.Item name="target" label="对象">
        <TextArea rows={2} placeholder="请输入对象" />
      </Form.Item>
      <Form.Item name="courseHighlights" label="课程亮点">
        <TextArea rows={2} placeholder="请输入课程亮点" />
      </Form.Item>
      <Form.Item name="courseIntroduction" label="课程介绍">
        <TextArea rows={3} placeholder="请输入课程介绍" />
      </Form.Item>
      <Form.Item name="courseStructure" label="课程结构">
        <TextArea rows={3} placeholder="请输入课程结构" />
      </Form.Item>
      <Form.Item name="graduationRequirements" label="毕业要求">
        <TextArea rows={3} placeholder="请输入毕业要求" />
      </Form.Item>
    </Form>
  );

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Spin size="large" />
        <Text style={{ marginLeft: 16 }}>正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Title level={4} style={{ color: "#ff4d4f", marginBottom: 8 }}>
          用户未登录
        </Title>
        <Text>请登录以访问课程信息管理。</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <InfoCircleOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                  <Button

                    className="teacher-page-back-btn"

                    type="text"

                    icon={<ArrowLeftOutlined />}

                    onClick={() => navigate("/teacher/dashboard")}

                    style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}

                  />

        <Title level={4} style={{ margin: 0 }}>
          课程信息管理
        </Title>
      </div>

      {coursesLoading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : coursesError ? (
        <Alert
          type="error"
          message={`加载课程列表失败: ${(coursesError as Error).message}`}
          style={{ marginBottom: 16 }}
        />
      ) : (
        <>
          <div style={{ marginTop: 16, marginBottom: 16 }}>
            <Space>
              <Text strong>选择课程：</Text>
              <Select
                style={{ width: 280 }}
                placeholder="请选择课程"
                value={activeCourseId || undefined}
                onChange={setSelectedCourseId}
                loading={coursesLoading}
                options={(Array.isArray(courses) ? courses : []).map((course: Course) => ({
                  value: course.id,
                  label: course.title,
                }))}
              />
            </Space>
          </div>

          <Card>
            <Table
              className="theme-table"
              columns={columns}
              dataSource={courseInfos}
              rowKey="id"
              loading={courseInfosLoading}
              title={() => (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={handleCreate}
                      disabled={!activeCourseId || createMutation.isPending}
                      style={canEdit ? undefined : { display: "none" }}
                    >
                      创建课程信息
                    </Button>
                  </Space>
                </div>
              )}
              locale={{
                emptyText: (
                  <EmptyState
                    description={
                      !activeCourseId
                        ? "请先选择一个课程"
                        : "暂无课程信息"
                    }
                  />
                ),
              }}
              pagination={false}
              scroll={{ x: 800 }}
            />
          </Card>
        </>
      )}

      <Modal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        title="创建课程信息"
        width={700}
        onOk={() => form.submit()}
        confirmLoading={createMutation.isPending}
        okButtonProps={{
          disabled: createMutation.isPending || !backgroundValue,
        }}
      >
        {renderForm()}
      </Modal>

      <Modal
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingCourseInfo(null);
        }}
        title="编辑课程信息"
        width={700}
        onOk={() => form.submit()}
        confirmLoading={updateMutation.isPending}
        okButtonProps={{
          disabled: updateMutation.isPending,
        }}
      >
        {renderForm()}
      </Modal>
    </div>
  );
}
