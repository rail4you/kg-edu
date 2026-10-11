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
  SearchOutlined,
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
import { AppPage, ProtoCard, ProtoTabs, ProtoEmpty } from "@/components/proto";

const { Text, Paragraph } = Typography;
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
  const [subtab, setSubtab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("全部");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

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
        .course-mobile-table-hide { display: none !important; }
        .course-action-text { display: none !important; }
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

  const filteredCourses = courses.filter((course) => {
    const q = searchText.trim().toLowerCase();
    if (q && !(course.title || "").toLowerCase().includes(q)) return false;
    if (statusFilter === "已发布" && !course.publishStatus) return false;
    if (statusFilter === "草稿" && course.publishStatus) return false;
    return true;
  });

  const paginatedCourses = filteredCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize);

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
      title: "课程封面",
      dataIndex: "imageUrl",
      key: "cover",
      width: 110,
      render: (_, record) =>
        record.imageUrl ? (
          <img
            src={record.imageUrl}
            alt={record.title}
            style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 6, display: "block" }}
          />
        ) : (
          <div
            style={{
              width: 80,
              height: 45,
              background: "linear-gradient(135deg, #234968, #4a7fb5)",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ReadOutlined style={{ color: "#fff", fontSize: 16 }} />
          </div>
        ),
    },
    {
      title: "课程名称",
      dataIndex: "title",
      key: "title",
      render: (_, record) => (
        <Text strong style={{ fontSize: 13 }} ellipsis={{ tooltip: record.title }}>{record.title}</Text>
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
      render: (status) => status ? <Tag color="green">{t("pages.course.published")}</Tag> : <Tag>{t("pages.course.draft")}</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      render: (_, record) => (
        <Space size="small">
          <Button type="link" size="small" onClick={() => navigate(`/teacher/dashboard/course/${record.id}`)}>
            <span className="course-action-text">查看</span>
          </Button>
          <ReadonlyActionButton type="link" size="small" onClick={() => handleEdit(record)}>
            <span className="course-action-text">{t("common.edit")}</span>
          </ReadonlyActionButton>
          <Popconfirm title={t("common.confirmDelete")} onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton type="link" size="small" danger>
              <span className="course-action-text">{t("common.delete")}</span>
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppPage
      title={t("pages.course.title")}
      description="集中管理课程信息与发布状态，保持教学内容清晰有序。"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;课程管理</>}
      actions={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => { form.resetFields(); setCreateModalOpen(true); }}
          style={canEdit ? undefined : { display: "none" }}
        >
          {t("pages.course.addCourse")}
        </Button>
      }
    >
      <ProtoCard>
        <ProtoTabs
          items={[
            { id: "all", label: "全部记录" },
            { id: "recent", label: "最近更新" },
          ]}
          active={subtab}
          onChange={setSubtab}
        />

        <div className="pu-filters">
          <Input
            className="pu-search"
            placeholder="搜索课程名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
            allowClear
          />
          <Select
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}
            options={["全部", "已发布", "草稿"].map((v) => ({ value: v, label: v }))}
          />
          <Button onClick={() => { setSearchText(""); setStatusFilter("全部"); setCurrentPage(1); }}>
            重置
          </Button>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
          </div>
        ) : !Array.isArray(courses) || courses.length === 0 ? (
          <ProtoEmpty
            title={t("pages.course.noCourses")}
            description="点击右上角「创建课程」开始建设。"
          />
        ) : filteredCourses.length === 0 ? (
          <ProtoEmpty title="未找到匹配的课程" description="尝试调整搜索或筛选条件。" />
        ) : (
          <>
            <Table
              dataSource={paginatedCourses}
              columns={tableColumns}
              rowKey="id"
              pagination={false}
              size="middle"
            />
            <div className="pu-table-footer">
              <span>共 {filteredCourses.length} 门课程</span>
              <Pagination
                current={currentPage}
                pageSize={pageSize}
                total={filteredCourses.length}
                onChange={setCurrentPage}
                showSizeChanger={false}
              />
            </div>
          </>
        )}
      </ProtoCard>

      <Modal open={createModalOpen} onCancel={() => setCreateModalOpen(false)} title={t("pages.course.addCourseTitle")} width={600} onOk={() => form.submit()} confirmLoading={createMutation.isPending}>
        {renderForm()}
      </Modal>

      <Modal open={editModalOpen} onCancel={() => { setEditModalOpen(false); setEditingCourse(null); }} title={t("pages.course.editCourseTitle")} width={600} onOk={() => form.submit()} confirmLoading={updateMutation.isPending}>
        {renderForm()}
      </Modal>
    </AppPage>
  );
}
