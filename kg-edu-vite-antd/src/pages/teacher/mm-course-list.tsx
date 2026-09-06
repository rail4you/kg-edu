import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Grid,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  Empty,
  Spin,
  Table,
  Space,
  Pagination,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReadOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  ArrowLeftOutlined
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

const { Title, Text, Paragraph } = Typography;
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

interface MicroMajorCourseListProps {
  mmId?: string;
  /** When false, padding and page title are suppressed (for embedding in MMCoursesPage) */
  standalone?: boolean;
}

export default function MicroMajorCourseList({ mmId, standalone = true }: MicroMajorCourseListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const { canEdit } = useEditPermission();
  const [form] = Form.useForm();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<MicroMajorCourse | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
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
  const paginatedCourses = courses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="semester" label="学期">
            <Input placeholder="如：2024-2025学年第一学期" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="semesterHours" label="学时">
            <Input type="number" placeholder="请输入学时" />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="credits" label="学分">
            <Input type="number" step="0.5" placeholder="请输入学分" />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="major" label="专业">
            <Input placeholder="请输入专业" />
          </Form.Item>
        </Col>
      </Row>
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
      render: (_, record) => (
        <Space style={{ maxWidth: "100%" }}>
          {!isMobile && (record.imageUrl ? (
            <img src={record.imageUrl} alt={record.title} style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 60, height: 40, background: "#722ed1", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <ReadOutlined style={{ color: "#fff" }} />
            </div>
          ))}
          <Tooltip title={record.title} mouseEnterDelay={0.3}>
            <Text strong style={{ fontSize: isMobile ? 13 : 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{record.title}</Text>
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
      render: (credits) => credits ? <Tag color="orange">{credits} 学分</Tag> : "-",
    },
    {
      title: "专业",
      dataIndex: "major",
      key: "major",
      responsive: ["md"],
      render: (major) => major ? <Tag color="purple">{major}</Tag> : "-",
    },
    {
      title: "状态",
      dataIndex: "publishStatus",
      key: "publishStatus",
      render: (status) => status ? <Tag color="green">已发布</Tag> : <Tag>草稿</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      width: isMobile ? 80 : 120,
      render: (_, record) => (
        <Space size={isMobile ? 2 : 4}>
          <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {isMobile ? "" : "编辑"}
          </ReadonlyActionButton>
          <Popconfirm title="确定要删除此课程吗？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
              {isMobile ? "" : "删除"}
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  // Early return when no microMajorId
  if (!microMajorId) {
    return null;
  }

  return (
    <div style={{ padding: standalone ? 24 : 0 }}>
      {/* 标题区域 (only in standalone mode) */}
      {standalone && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <ReadOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                      <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
              {microMajor?.name || "微专业"} — 课程管理
            </Title>
          </div>
        </div>
      )}

      {/* 工具栏 */}
      <div style={{ marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Button type="primary" icon={<PlusOutlined />} size={isMobile ? "small" : "middle"} onClick={() => { form.resetFields(); setCreateModalOpen(true); }} style={canEdit ? undefined : { display: "none" }}>
          {isMobile ? "新增" : "新增课程"}
        </Button>
        <Space.Compact size={isMobile ? "small" : "middle"}>
          <Button type={viewMode === "card" ? "primary" : "default"} icon={<AppstoreOutlined />} onClick={() => setViewMode("card")}>
            卡片
          </Button>
          <Button type={viewMode === "table" ? "primary" : "default"} icon={<UnorderedListOutlined />} onClick={() => setViewMode("table")}>
            表格
          </Button>
        </Space.Compact>
      </div>

      {/* 内容区域 */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 48 }}><Spin size="large" /></div>
      ) : !Array.isArray(courses) || courses.length === 0 ? (
        <Empty description="暂无课程，请点击新增课程" />
      ) : viewMode === "card" ? (
        <>
          <Row gutter={isMobile ? [0, 10] : [16, 16]}>
            {paginatedCourses.map((course: MicroMajorCourse) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={course.id}>
                <Card
                  style={{ borderRadius: isMobile ? 10 : 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
                  styles={{ body: { padding: 0 } }}
                  hoverable
                >
                  {/* 封面区域 */}
                  <div style={{ position: "relative", height: isMobile ? 100 : 140, flexShrink: 0 }}>
                    {course.imageUrl ? (
                      <img alt={course.title} src={course.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #722ed1 0%, #9254de 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ReadOutlined style={{ fontSize: isMobile ? 24 : 36, color: "#fff" }} />
                      </div>
                    )}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
                      padding: "20px 10px 6px",
                      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                    }}>
                      <span style={{ color: "#fff", fontSize: isMobile ? 11 : 12, opacity: 0.95 }}>
                        {course.semester || ""}
                      </span>
                      {course.credits && (
                        <span style={{ color: "#fff", fontSize: isMobile ? 10 : 11, background: "rgba(255,255,255,0.2)", padding: "1px 6px", borderRadius: 10 }}>
                          {course.credits} 学分
                        </span>
                      )}
                    </div>
                    {course.publishStatus && (
                      <Tag color="green" style={{ position: "absolute", top: isMobile ? 6 : 8, right: isMobile ? 6 : 8, margin: 0, fontSize: isMobile ? 10 : 11 }}>
                        已发布
                      </Tag>
                    )}
                  </div>

                  {/* 信息区域 */}
                  <div style={{ padding: isMobile ? "10px 12px 8px" : "14px 16px 12px", flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <Text strong style={{ fontSize: isMobile ? 14 : 15, lineHeight: 1.4, flex: 1, minWidth: 0 }} ellipsis={{ tooltip: course.title }}>
                        {course.title}
                      </Text>
                      {course.major && (
                        <Tag color="purple" style={{ margin: 0, flexShrink: 0, fontSize: isMobile ? 10 : 11 }}>
                          {course.major}
                        </Tag>
                      )}
                    </div>
                    {!isMobile && (
                      <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 12, color: "#8c8c8c", lineHeight: 1.6 }}>
                        {course.description || "暂无描述"}
                      </Paragraph>
                    )}
                  </div>

                  {/* 操作栏 - 移动端只保留编辑 */}
                  <div style={{ padding: isMobile ? "0 12px 8px" : "8px 16px 12px", display: "flex", justifyContent: isMobile ? "flex-end" : "flex-end" }}>
                    <Space size={isMobile ? 2 : 4}>
                      <Button type="link" size="small" icon={<ReadOutlined />} onClick={() => {
                        navigate(`/micro-major/chapters?mmId=${microMajorId}&courseId=${course.id}`);
                      }}>
                        {isMobile ? "" : "管理"}
                      </Button>
                      <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(course)}>
                        {isMobile ? "" : "编辑"}
                      </ReadonlyActionButton>
                      <Popconfirm title="确定要删除此课程吗？" onConfirm={() => deleteMutation.mutate(course.id)}>
                        <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
                          {isMobile ? "" : "删除"}
                        </ReadonlyActionButton>
                      </Popconfirm>
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Pagination current={currentPage} pageSize={pageSize} total={courses.length} onChange={setCurrentPage} />
          </div>
        </>
      ) : (
        <Card style={{ borderRadius: 8 }}>
          <Table dataSource={paginatedCourses} columns={tableColumns} rowKey="id" pagination={false} size="small" />
          <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
            <Pagination current={currentPage} pageSize={pageSize} total={courses.length} onChange={setCurrentPage} />
          </div>
        </Card>
      )}

      <Modal open={createModalOpen} onCancel={() => setCreateModalOpen(false)} title="新增课程" width={600} onOk={() => form.submit()} confirmLoading={createMutation.isPending}>
        {renderForm()}
      </Modal>

      <Modal open={editModalOpen} onCancel={() => { setEditModalOpen(false); setEditingCourse(null); }} title="编辑课程" width={600} onOk={() => form.submit()} confirmLoading={updateMutation.isPending}>
        {renderForm()}
      </Modal>
    </div>
  );
}