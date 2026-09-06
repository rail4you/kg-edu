import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Row,
  Col,
  Tag,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
  Empty,
  Spin,
  Table,
  Space,
  Pagination,
} from "antd";
import { useNavigate } from "react-router-dom";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReadOutlined,
  EyeOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  BgColorsOutlined,
  ArrowLeftOutlined,
} from "@ant-design/icons";
import ImageCropper from "@/components/ImageCropper";
import ColorSchemeSelector from "@/components/course/ColorSchemeSelector";
import {
  createCourse,
  updateCourse,
  destroyCourse,
  getSubjectCategoryByName,
  createSubjectCategory,
} from "@/lib/ash_rpc";
import { STANDARD_SUBJECT_TEMPLATES } from "@/hooks/use-course-catalog";
import { useCourses } from "@/hooks/use-courses";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders } from "@/utils/api-helpers";
import { useTranslate } from "@/locales/use-locales";

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const EDUCATION_LEVEL_OPTIONS = [
  { value: "graduate", label: "研究生" },
  { value: "undergraduate", label: "本科" },
  { value: "higher_vocational", label: "高职" },
  { value: "secondary_vocational", label: "中职" },
];

interface Course {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  teacherId?: string;
  publishStatus?: boolean;
  semester?: string;
  semesterHours?: number;
  credits?: number;
  major?: string;
  colorScheme?: string | null;
  educationLevel?: string | null;
  subjectCategoryId?: string | null;
  subjectCategory?: { id?: string; name?: string | null } | null;
}

export default function CourseManagementPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const [form] = Form.useForm();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  // 颜色主题 Modal 状态
  const [colorSchemeCourseId, setColorSchemeCourseId] = useState<string | null>(null);

  const tenant = currentTenant?.schemaName || "";
  const { t } = useTranslate("teacher");
  const { canEdit } = useEditPermission();

  // 注入移动端适配样式
  useEffect(() => {
    const styleId = "course-page-mobile";
    let style = document.getElementById(styleId) as HTMLStyleElement;
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      @media (max-width: 768px) {
        .course-back-btn { display: inline-flex !important; }
        .course-mobile-table-hide { display: none !important; }
        .course-toolbar { flex-wrap: wrap; }
        .course-page-wrap { padding: 12px !important; }
        .course-page-wrap .ant-table-cell { padding: 8px 6px !important; }
        .course-page-wrap .ant-btn { font-size: 12px !important; padding: 2px 6px !important; }
        .course-page-wrap .course-action-text { display: none !important; }
      }
      @media (min-width: 769px) {
        .course-back-btn { display: none !important; }
      }
    `;
    return () => { style.remove(); };
  }, []);

  const { courses, loading: isLoading } = useCourses({
    fields: [
      "id",
      "title",
      "description",
      "imageUrl",
      "teacherId",
      "publishStatus",
      "semester",
      "semesterHours",
      "credits",
      "major",
      "colorScheme",
      "educationLevel",
      "subjectCategoryId",
      { subjectCategory: ["id", "name"] },
    ],
  });

  const subjectCategories = STANDARD_SUBJECT_TEMPLATES.map((template) => ({
    id: template.code,
    name: template.name,
  }));

  const resolveSubjectCategoryId = async (code?: string) => {
    if (!code) return null;
    const template = STANDARD_SUBJECT_TEMPLATES.find((t) => t.code === code);
    if (!template) return null;
    const name = template.name;

    const existing = await getSubjectCategoryByName({
      tenant,
      input: { name },
      fields: ["id", "name"],
      headers: getHeaders(user),
    });
    if (existing.success && existing.data) {
      const record = Array.isArray(existing.data) ? existing.data[0] : existing.data;
      if (record?.id) return record.id;
    }

    const created = await createSubjectCategory({
      tenant,
      input: { name, description: template.description || null },
      fields: ["id", "name"],
      headers: getHeaders(user),
    });
    if (created.success && created.data) {
      const record = Array.isArray(created.data) ? created.data[0] : created.data;
      if (record?.id) return record.id;
    }
    return null;
  };

  const paginatedCourses = courses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const createMutation = useMutation({
    mutationFn: async (values: any) => {
      const subjectCategoryId = await resolveSubjectCategoryId(values.subjectCategoryCode);
      const result = await createCourse({
        tenant,
        input: {
          title: values.title,
          description: values.description || null,
          imageUrl: values.imageUrl || null,
          publishStatus: values.publishStatus || false,
          semester: values.semester || null,
          semesterHours: values.semesterHours
            ? parseInt(values.semesterHours)
            : null,
          credits: values.credits ? parseFloat(values.credits) : null,
          major: values.major || null,
          educationLevel: values.educationLevel || null,
          subjectCategoryId,
          teacherId: user?.id || "",
        },
        fields: ["id", "title"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to create");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      message.success(t("common.createSuccess"));
      setCreateModalOpen(false);
      form.resetFields();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!editingCourse) return;
      const subjectCategoryId = await resolveSubjectCategoryId(values.subjectCategoryCode);
      const result = await updateCourse({
        tenant,
        primaryKey: editingCourse.id,
        input: {
          title: values.title,
          description: values.description || null,
          imageUrl: values.imageUrl || null,
          publishStatus: values.publishStatus || false,
          semester: values.semester || null,
          semesterHours: values.semesterHours
            ? parseInt(values.semesterHours)
            : null,
          credits: values.credits ? parseFloat(values.credits) : null,
          major: values.major || null,
          educationLevel: values.educationLevel || null,
          subjectCategoryId,
          teacherId: editingCourse.teacherId || user?.id || "",
        },
        fields: ["id", "title"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error(result.errors?.[0]?.message || "更新失败");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      message.success(t("common.updateSuccess"));
      setEditModalOpen(false);
      setEditingCourse(null);
      form.resetFields();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyCourse({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to delete");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      message.success(t("common.deleteSuccess"));
    },
  });

  // 颜色主题更新 mutation
  const updateColorSchemeMutation = useMutation({
    mutationFn: async ({ courseId, colorScheme }: { courseId: string; colorScheme: string }) => {
      const result = await updateCourse({
        tenant,
        primaryKey: courseId,
        input: {
          color_scheme: colorScheme,
        },
        fields: ["id", "color_scheme"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error(result.errors?.[0]?.message || "颜色主题更新失败");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      message.success("颜色主题已更新");
    },
  });

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    const subjectCategoryCode = STANDARD_SUBJECT_TEMPLATES.find(
      (t) =>
        t.name === course.subjectCategory?.name ||
        t.aliases.includes(course.subjectCategory?.name || "")
    )?.code;
    form.setFieldsValue({
      title: course.title,
      description: course.description,
      imageUrl: course.imageUrl,
      publishStatus: course.publishStatus,
      semester: course.semester,
      semesterHours: course.semesterHours?.toString(),
      credits: course.credits?.toString(),
      major: course.major,
      educationLevel: course.educationLevel || undefined,
      subjectCategoryCode: subjectCategoryCode || undefined,
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

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>{t("common.pleaseLogin")}</Text>
      </div>
    );
  }

  const renderForm = () => (
    <Form form={form} layout="vertical" onFinish={handleSubmit}>
      <Form.Item
        name="title"
        label={t("pages.course.title")}
        rules={[{ required: true, message: "请输入课程名称" }]}
      >
        <Input placeholder={t("pages.course.title")} />
      </Form.Item>
      <Form.Item name="description" label={t("pages.course.courseDescription")}>
        <TextArea rows={3} placeholder={t("pages.course.courseDescriptionPlaceholder")} />
      </Form.Item>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="semester" label={t("pages.course.semester")}>
            <Input placeholder={t("pages.course.semesterPlaceholder")} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="semesterHours" label={t("pages.course.hours")}>
            <Input type="number" placeholder={t("pages.course.semesterHoursPlaceholder")} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="credits" label={t("pages.course.credits")}>
            <Input type="number" step="0.5" placeholder={t("pages.course.creditsPlaceholder")} />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="major" label={t("pages.course.major")}>
            <Input placeholder={t("pages.course.majorPlaceholder")} />
          </Form.Item>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="educationLevel" label={t("pages.course.educationLevel")}>
            <Select
              placeholder={t("pages.course.educationLevelPlaceholder")}
              options={EDUCATION_LEVEL_OPTIONS}
              allowClear
            />
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item name="subjectCategoryCode" label={t("pages.course.subjectCategory")}>
            <Select
              placeholder={t("pages.course.subjectCategoryPlaceholder")}
              options={subjectCategories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              allowClear
              showSearch
              optionFilterProp="label"
            />
          </Form.Item>
        </Col>
      </Row>
      <Form.Item name="imageUrl" label={t("pages.course.coverImage")}>
        <ImageCropper aspectRatio={16 / 9} maxWidth={800} maxHeight={450} />
      </Form.Item>
      <Form.Item name="publishStatus" label={t("pages.course.publishStatus")} valuePropName="checked">
        <Switch checkedChildren={t("pages.course.published")} unCheckedChildren={t("pages.course.draft")} />
      </Form.Item>
    </Form>
  );

  const tableColumns: ColumnsType<Course> = [
    {
      title: "课程名称",
      dataIndex: "title",
      key: "title",
      width: "40%",
      render: (_, record) => (
        <Space>
          {record.imageUrl ? (
            <img src={record.imageUrl} alt={record.title} style={{ width: 40, height: 28, objectFit: "cover", borderRadius: 4 }} />
          ) : (
            <div style={{ width: 40, height: 28, background: "#1890ff", borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ReadOutlined style={{ color: "#fff", fontSize: 14 }} />
            </div>
          )}
          <Text strong style={{ fontSize: 13 }} ellipsis={{ tooltip: record.title }}>{record.title}</Text>
        </Space>
      ),
    },
    {
      title: "学期",
      dataIndex: "semester",
      key: "semester",
      className: "course-mobile-table-hide",
      render: (semester) => semester ? <Tag>{semester}</Tag> : "-",
    },
    {
      title: "学分",
      dataIndex: "credits",
      key: "credits",
      className: "course-mobile-table-hide",
      render: (credits) => credits ? <Tag color="orange">{credits}{t("pages.course.credits")}</Tag> : "-",
    },
    {
      title: "专业",
      dataIndex: "major",
      key: "major",
      className: "course-mobile-table-hide",
      render: (major) => major ? <Tag color="purple">{major}</Tag> : "-",
    },
    {
      title: "状态",
      dataIndex: "publishStatus",
      key: "publishStatus",
      align: "right",
      render: (status) => status ? <Tag color="green">{t("pages.course.published")}</Tag> : <Tag>{t("pages.course.draft")}</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      align: "right",
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => navigate(`/teacher/dashboard/course/${record.id}`)}>
            <span className="course-action-text">查看</span>
          </Button>
          <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            <span className="course-action-text">{t("common.edit")}</span>
          </ReadonlyActionButton>
          <Popconfirm title={t("common.confirmDelete")} onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
              <span className="course-action-text">{t("common.delete")}</span>
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="course-page-wrap" style={{ padding: 24 }}>
      {/* 标题区域 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <Button
            className="course-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
          <ReadOutlined style={{ fontSize: 24, color: "#1890ff" }} />
          <Title level={4} style={{ margin: 0 }}>{t("pages.course.title")}</Title>
        </div>
      </div>

      {/* 工具栏 */}
      <div className="course-toolbar" style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateModalOpen(true); }} style={canEdit ? undefined : { display: "none" }}>
          {t("pages.course.addCourse")}
        </Button>
        <Space.Compact>
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
        <Empty description={t("pages.course.noCourses")} />
      ) : viewMode === "card" ? (
        <>
          <Row gutter={[16, 16]}>
            {paginatedCourses.map((course: Course) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={course.id}>
                <Card
                  style={{ borderRadius: 12, overflow: "hidden", height: "100%", display: "flex", flexDirection: "column", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}
                  styles={{ body: { padding: 0, flex: 1, display: "flex", flexDirection: "column" } }}
                  hoverable
                  onClick={(e) => {
                    // 点击弹窗（颜色主题 Modal 等）内部的颜色/按钮时，事件会冒泡到卡片，此处拦截避免误跳转到课程详情页
                    if (e.target.closest(".ant-modal-root")) return;
                    navigate(`/teacher/dashboard/course/${course.id}`);
                  }}
                >
                  {/* 封面区域 */}
                  <div style={{ position: "relative", height: 140, flexShrink: 0 }}>
                    {course.imageUrl ? (
                      <img alt={course.title} src={course.imageUrl} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <ReadOutlined style={{ fontSize: 36, color: "#fff" }} />
                      </div>
                    )}
                    {/* 封面底部渐变遮罩 - 放置学期与学分 */}
                    <div style={{
                      position: "absolute", bottom: 0, left: 0, right: 0,
                      background: "linear-gradient(transparent, rgba(0,0,0,0.55))",
                      padding: "24px 12px 8px",
                      display: "flex", alignItems: "flex-end", justifyContent: "space-between",
                    }}>
                      <span style={{ color: "#fff", fontSize: 12, opacity: 0.95 }}>
                        {course.semester || ""}
                      </span>
                      {course.credits && (
                        <span style={{
                          color: "#fff", fontSize: 11,
                          background: "rgba(255,255,255,0.2)",
                          padding: "1px 8px", borderRadius: 10,
                          backdropFilter: "blur(4px)",
                        }}>
                          {course.credits}{t("pages.course.credits")}
                        </span>
                      )}
                    </div>
                    {/* 已发布标签 */}
                    {course.publishStatus && (
                      <Tag color="green" style={{ position: "absolute", top: 8, right: 8, margin: 0, fontSize: 11 }}>
                        {t("pages.course.published")}
                      </Tag>
                    )}
                  </div>

                  {/* 信息区域 */}
                  <div style={{ padding: "14px 16px 12px", flex: 1, display: "flex", flexDirection: "column" }}>
                    {/* 课程标题 + 学科标签 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <Text strong style={{ fontSize: 15, lineHeight: 1.4, flex: 1, minWidth: 0 }} ellipsis={{ tooltip: course.title }}>
                        {course.title}
                      </Text>
                      {course.major && (
                        <Tag color="purple" style={{ margin: 0, flexShrink: 0, fontSize: 11 }}>
                          {course.major}
                        </Tag>
                      )}
                    </div>

                    {/* 课程描述 */}
                    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0, fontSize: 12, color: "#8c8c8c", lineHeight: 1.6, flex: 1 }}>
                      {course.description || t("pages.course.noDescription")}
                    </Paragraph>
                    {/* 颜色主题标签 */}
                    {course.colorScheme && course.colorScheme !== "auto" && (
                      <Tag
                        icon={<BgColorsOutlined />}
                        color="processing"
                        style={{ marginTop: 6, fontSize: 11 }}
                      >
                        {course.colorScheme === "pure" ? "纯图模式" : course.colorScheme}
                      </Tag>
                    )}
                  </div>

                  {/* 操作栏 */}
                  <div style={{ padding: "8px 16px 12px", display: "flex", justifyContent: "flex-end" }}>
                    <Space size={4}>
                      <ColorSchemeSelector
                        courseId={course.id}
                        tenant={tenant}
                        currentScheme={course.colorScheme}
                        onChange={(scheme) => {
                          updateColorSchemeMutation.mutate({
                            courseId: course.id,
                            colorScheme: scheme,
                          });
                        }}
                      />
                      <Button type="link" size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); navigate(`/teacher/dashboard/course/${course.id}`); }}>
                        查看
                      </Button>
                      <ReadonlyActionButton type="link" size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); handleEdit(course); }}>
                        {t("common.edit")}
                      </ReadonlyActionButton>
                      <Popconfirm title={t("common.confirmDelete")} onConfirm={(e) => { e?.stopPropagation(); deleteMutation.mutate(course.id); }}>
                        <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>
                          {t("common.delete")}
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

      <Modal open={createModalOpen} onCancel={() => setCreateModalOpen(false)} title={t("pages.course.addCourseTitle")} width={600} onOk={() => form.submit()} confirmLoading={createMutation.isPending}>
        {renderForm()}
      </Modal>

      <Modal open={editModalOpen} onCancel={() => { setEditModalOpen(false); setEditingCourse(null); }} title={t("pages.course.editCourseTitle")} width={600} onOk={() => form.submit()} confirmLoading={updateMutation.isPending}>
        {renderForm()}
      </Modal>
    </div>
  );
}
