import { forwardRef, useImperativeHandle, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Tag,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Empty,
  Table,
  Space,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReadOutlined,
} from "@ant-design/icons";
import ImageCropper from "@/components/ImageCropper";
import {
  createMicroMajorCourse,
  updateMicroMajorCourse,
  deleteMicroMajorCourse,
  listCoursesByMicroMajor,
  getMicroMajor,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { AppPage } from "@/components/proto";

const { Text } = Typography;
const { TextArea } = Input;

interface MicroMajorCourse {
  id: string;
  microMajorId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  teacherId?: string;
  semester?: string | null;
  semesterHours?: number | null;
  credits?: number | null;
  major?: string | null;
  publishStatus?: boolean;
  sortOrder: number;
  sourceCourseId?: string | null;
  insertedAt?: string;
}

export interface MicroMajorCourseListHandle {
  openCreate: () => void;
}

interface MicroMajorCourseListProps {
  mmId?: string;
  /** When false, padding and page title are suppressed (for embedding in MMCoursesPage) */
  standalone?: boolean;
}

const MicroMajorCourseList = forwardRef<MicroMajorCourseListHandle, MicroMajorCourseListProps>(
  function MicroMajorCourseList({ mmId, standalone = true }, ref) {
    const navigate = useNavigate();
    const { user } = useAuth();
    const currentTenant = getCurrentTenant();
    const queryClient = useQueryClient();
    const { canEdit } = useEditPermission();
    const [form] = Form.useForm();
    const [createModalOpen, setCreateModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [editingCourse, setEditingCourse] = useState<MicroMajorCourse | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 12;

    const tenant = currentTenant?.schemaName || "";

    // Use mmId from props if provided, otherwise extract from URL path
    // Guard: if fallback value is a known flat route keyword, treat as missing
    const pathFallback = window.location.pathname.split("/")[2];
    const microMajorId = mmId || (pathFallback && !["courses","chapters","videos","exercises","resources","students","settings","dashboard","create"].includes(pathFallback) ? pathFallback : undefined);

    // Fetch micro major info
    const { data: microMajor } = useQuery({
      queryKey: ["mm-course-mm", microMajorId],
      queryFn: async () => {
        const result = await getMicroMajor({
          tenant,
          input: { id: microMajorId },
          fields: ["id", "name"],
        });
        if (!result.success) return null;
        return (result.data as any) || null;
      },
      enabled: !!tenant && !!microMajorId,
    });

    // Fetch courses
    const {
      data: coursesData,
      isLoading,
    } = useQuery({
      queryKey: ["mm-courses", microMajorId],
      queryFn: async () => {
        const result = await listCoursesByMicroMajor({
          tenant,
          input: { microMajorId },
          fields: [
            "id",
            "microMajorId",
            "title",
            "description",
            "imageUrl",
            "teacherId",
            "semester",
            "semesterHours",
            "credits",
            "major",
            "publishStatus",
            "sortOrder",
            "insertedAt",
          ],
        });
        return extractArrayData(result);
      },
      enabled: !!tenant && !!microMajorId,
    });

    const courses: MicroMajorCourse[] = (extractArrayData(coursesData) as MicroMajorCourse[]) || [];

    // Create course
    const createMutation = useMutation({
      mutationFn: async (values: any) => {
        const result = await createMicroMajorCourse({
          tenant,
          input: {
            microMajorId,
            title: values.title,
            description: values.description || null,
            imageUrl: values.imageUrl || null,
            publishStatus: values.publishStatus || false,
            semester: values.semester || null,
            semesterHours: values.semesterHours ? parseInt(values.semesterHours) : null,
            credits: values.credits ? parseFloat(values.credits) : null,
            major: values.major || null,
            teacherId: user?.id || "",
          },
          fields: ["id", "title"],
          headers: getHeaders(user),
        });
        if (!result.success) throw new Error(result.errors?.[0]?.message || "创建失败");
        return result.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["mm-courses", microMajorId] });
        message.success("课程创建成功");
        setCreateModalOpen(false);
        form.resetFields();
      },
      onError: (err: any) => {
        message.error(err.message || "创建失败");
      },
    });

    // Update course
    const updateMutation = useMutation({
      mutationFn: async (values: any) => {
        if (!editingCourse) return;
        const result = await updateMicroMajorCourse({
          tenant,
          primaryKey: editingCourse.id,
          input: {
            title: values.title,
            description: values.description || null,
            imageUrl: values.imageUrl || null,
            publishStatus: values.publishStatus || false,
            semester: values.semester || null,
            semesterHours: values.semesterHours ? parseInt(values.semesterHours) : null,
            credits: values.credits ? parseFloat(values.credits) : null,
            major: values.major || null,
            sortOrder: values.sortOrder || 0,
          },
          fields: ["id", "title"],
          headers: getHeaders(user),
        });
        if (!result.success) throw new Error(result.errors?.[0]?.message || "更新失败");
        return result.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["mm-courses", microMajorId] });
        message.success("更新成功");
        setEditModalOpen(false);
        setEditingCourse(null);
        form.resetFields();
      },
      onError: (err: any) => {
        message.error(err.message || "更新失败");
      },
    });

    // Delete course
    const deleteMutation = useMutation({
      mutationFn: async (id: string) => {
        const result = await deleteMicroMajorCourse({
          tenant,
          primaryKey: id,
          headers: getHeaders(user),
        });
        if (!result.success) throw new Error(result.errors?.[0]?.message || "删除失败");
        return result.data;
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["mm-courses", microMajorId] });
        message.success("删除成功");
      },
      onError: (err: any) => {
        message.error(err.message || "删除失败");
      },
    });

    const openCreate = () => {
      form.resetFields();
      setCreateModalOpen(true);
    };

    useImperativeHandle(ref, () => ({ openCreate }));

    const handleEdit = (course: MicroMajorCourse) => {
      setEditingCourse(course);
      form.setFieldsValue({
        title: course.title,
        description: course.description,
        imageUrl: course.imageUrl,
        publishStatus: course.publishStatus,
        semester: course.semester,
        semesterHours: course.semesterHours?.toString(),
        credits: course.credits?.toString(),
        major: course.major,
        sortOrder: course.sortOrder,
      });
      setEditModalOpen(true);
    };

    const handleSubmit = (values: any) => {
      if (editingCourse) {
        updateMutation.mutate(values);
      } else {
        createMutation.mutate(values);
      }
    };

    const renderForm = () => (
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="title"
          label="课程名称"
          rules={[{ required: true, message: "请输入课程名称" }]}
        >
          <Input placeholder="请输入课程名称" />
        </Form.Item>
        <Form.Item name="description" label="课程描述">
          <TextArea rows={3} placeholder="请输入课程描述" />
        </Form.Item>
        <Space style={{ display: "flex" }} size="middle">
          <Form.Item name="semester" label="学期" style={{ flex: 1, minWidth: 220 }}>
            <Input placeholder="如：2024-2025学年第一学期" />
          </Form.Item>
          <Form.Item name="semesterHours" label="学时">
            <Input type="number" placeholder="请输入学时" style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="credits" label="学分">
            <Input type="number" step="0.5" placeholder="请输入学分" style={{ width: 120 }} />
          </Form.Item>
        </Space>
        <Form.Item name="major" label="专业">
          <Input placeholder="请输入专业" />
        </Form.Item>
        <Form.Item name="imageUrl" label="封面图片">
          <ImageCropper aspectRatio={16 / 9} maxWidth={800} maxHeight={450} />
        </Form.Item>
        <Form.Item name="publishStatus" label="发布状态" valuePropName="checked">
          <Switch checkedChildren="已发布" unCheckedChildren="草稿" />
        </Form.Item>
      </Form>
    );

    const tableColumns: ColumnsType<MicroMajorCourse> = [
      {
        title: "课程名称",
        dataIndex: "title",
        key: "title",
        ellipsis: true,
        render: (_, record) => (
          <Space style={{ maxWidth: "100%" }}>
            {record.imageUrl ? (
              <img src={record.imageUrl} alt={record.title} style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
            ) : (
              <div style={{ width: 60, height: 40, background: "#EEF1F5", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ReadOutlined style={{ color: "#94A3B8" }} />
              </div>
            )}
            <Tooltip title={record.title} mouseEnterDelay={0.3}>
              <Text strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{record.title}</Text>
            </Tooltip>
          </Space>
        ),
      },
      {
        title: "学期",
        dataIndex: "semester",
        key: "semester",
        responsive: ["md"],
        render: (semester) => semester ? <Tag>{semester}</Tag> : "-",
      },
      {
        title: "学分",
        dataIndex: "credits",
        key: "credits",
        responsive: ["md"],
        width: 100,
        render: (credits) => credits ? <Tag>{credits} 学分</Tag> : "-",
      },
      {
        title: "专业",
        dataIndex: "major",
        key: "major",
        responsive: ["lg"],
        render: (major) => major ? <Tag>{major}</Tag> : "-",
      },
      {
        title: "状态",
        dataIndex: "publishStatus",
        key: "publishStatus",
        width: 90,
        render: (status) => status ? <Tag>已发布</Tag> : <Tag>草稿</Tag>,
      },
      {
        title: "操作",
        key: "actions",
        width: 200,
        render: (_, record) => (
          <Space size={4}>
            <Button type="link" size="small" icon={<ReadOutlined />} onClick={() => {
              navigate(`/micro-major/chapters?mmId=${microMajorId}&courseId=${record.id}`);
            }}>
              管理
            </Button>
            <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
              编辑
            </ReadonlyActionButton>
            <Popconfirm title="确定要删除此课程吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
              <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
                删除
              </ReadonlyActionButton>
            </Popconfirm>
          </Space>
        ),
      },
    ];

    if (!user) {
      return (
        <AppPage title="课程管理" description="管理微专业下的课程">
          <div style={{ padding: 24, textAlign: "center" }}>
            <Text>请先登录</Text>
          </div>
        </AppPage>
      );
    }

    // Early return when no microMajorId
    if (!microMajorId) {
      return null;
    }

    const pageBody = (
      <>
        <Card className="mm-course-table">
          {canEdit && (
            <div style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                新增课程
              </Button>
            </div>
          )}
          <Table
            columns={tableColumns}
            dataSource={courses}
            rowKey="id"
            loading={isLoading}
            size="middle"
            scroll={{ x: "max-content" }}
            pagination={{
              current: currentPage,
              pageSize,
              total: courses.length,
              onChange: setCurrentPage,
              showSizeChanger: false,
              showTotal: (total) => `共 ${total} 条`,
            }}
            locale={{
              emptyText: <Empty description={canEdit ? "暂无课程，点击「新增课程」添加" : "暂无课程"} />,
            }}
          />
        </Card>

        <Modal open={createModalOpen} onCancel={() => setCreateModalOpen(false)} title="新增课程" width={640} onOk={() => form.submit()} confirmLoading={createMutation.isPending} destroyOnClose>
          {renderForm()}
        </Modal>

        <Modal open={editModalOpen} onCancel={() => { setEditModalOpen(false); setEditingCourse(null); }} title="编辑课程" width={640} onOk={() => form.submit()} confirmLoading={updateMutation.isPending} destroyOnClose>
          {renderForm()}
        </Modal>
      </>
    );

    if (standalone) {
      return (
        <AppPage
          title={`${microMajor?.name || "微专业"} — 课程管理`}
          description="管理微专业下的课程"
          breadcrumb={<>微专业&nbsp;&nbsp;/&nbsp;&nbsp;课程管理</>}
        >
          {pageBody}
        </AppPage>
      );
    }

    return pageBody;
  },
);

export default MicroMajorCourseList;
