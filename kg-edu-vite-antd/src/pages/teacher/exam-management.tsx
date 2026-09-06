import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Table,
  Button,
  Card,
  Typography,
  Select,
  Space,
  Tag,
  message,
  Popconfirm,
  Modal,
  Form,
  Input,
  InputNumber,
  DatePicker,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  ScheduleOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  BarChartOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  listExams,
  createExam,
  destroyExam,
  updateExam,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import dayjs from "dayjs";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;
const { TextArea } = Input;

interface Exam {
  id: string;
  title: string;
  description?: string;
  examType: "midterm" | "final" | "quiz" | "assignment";
  examDate?: string;
  deadlineAt?: string;
  durationMinutes: number;
  totalScore: number;
  passingScore: number;
  courseName?: string;
  courseId?: string;
}

const examTypeMap: Record<string, { label: string; color: string }> = {
  midterm: { label: "期中考试", color: "blue" },
  final: { label: "期末考试", color: "red" },
  quiz: { label: "小测验", color: "green" },
  assignment: { label: "作业", color: "orange" },
};

export default function ExamManagementPage() {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canEdit } = useEditPermission();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [searchText, setSearchText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>();
  const [examDateRange, setExamDateRange] = useState<[dayjs.Dayjs | null, dayjs.Dayjs | null]>([null, null]);
  const [deadlineFilter, setDeadlineFilter] = useState<"before" | "after" | undefined>();
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    courseId: string;
    examType: "midterm" | "final" | "quiz" | "assignment";
    examDate: string;
    deadlineAt: string;
    durationMinutes: number;
    passingScore: number;
  }>({
    title: "",
    description: "",
    courseId: "",
    examType: "quiz",
    examDate: "",
    deadlineAt: "",
    durationMinutes: 60,
    passingScore: 60,
  });

  const tenant = currentTenant?.schemaName || "";

  // 使用统一的课程获取 hook
  const { courses, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  // 自动选择第一个课程
  useEffect(() => {
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["exams", tenant],
    queryFn: async () => {
      const result = await listExams({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "examType",
          "examDate",
          "deadlineAt",
          "durationMinutes",
          "totalScore",
          "passingScore",
          { course: ["id", "title"] },
        ],
        headers: getHeaders(user),
      });
      return extractArrayData(result).map((e: any) => ({
        ...e,
        examDate: e.examDate || e.exam_date || null,
        deadlineAt: e.deadlineAt || e.deadline_at || null,
        courseName: e.course?.title || "",
        courseId: e.course?.id || "",
      }));
    },
    enabled: !!tenant && !!user,
  });

  const filteredExams = useMemo(() => {
    return exams.filter((exam) => {
      if (searchText && !exam.title.toLowerCase().includes(searchText.toLowerCase())) {
        return false;
      }
      if (selectedCourseId && exam.courseId !== selectedCourseId) {
        return false;
      }
      if (examDateRange[0] && exam.examDate) {
        if (dayjs(exam.examDate).isBefore(examDateRange[0])) return false;
      }
      if (examDateRange[1] && exam.examDate) {
        if (dayjs(exam.examDate).isAfter(examDateRange[1])) return false;
      }
      if (deadlineFilter === "before" && exam.deadlineAt) {
        if (dayjs(exam.deadlineAt).isAfter(dayjs())) return false;
      }
      if (deadlineFilter === "after" && exam.deadlineAt) {
        if (dayjs(exam.deadlineAt).isBefore(dayjs())) return false;
      }
      return true;
    });
  }, [exams, searchText, selectedCourseId, examDateRange, deadlineFilter]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const result = await createExam({
        tenant,
        input: { ...data, createdById: user?.id },
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) {
        const errorData = result as any;
        let errorMessage = "创建失败";
        if (errorData.errors?.[0]?.details?.errors?.[0]?.message) {
          errorMessage = errorData.errors[0].details.errors[0].message;
        } else if (errorData.errors?.[0]?.message) {
          errorMessage = errorData.errors[0].message;
        }
        throw new Error(errorMessage);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      message.success("创建成功");
      setCreateModalOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      message.error(error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const result = await updateExam({
        tenant,
        primaryKey: id,
        input: data,
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to update");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      message.success("更新成功");
      setEditModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await destroyExam({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
      if (!result.success) throw new Error("Failed to delete");
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["exams"] });
      message.success("删除成功");
    },
  });

  const resetForm = () =>
    setFormData({
      title: "",
      description: "",
      courseId: "",
      examType: "quiz",
      examDate: "",
      deadlineAt: "",
      durationMinutes: 60,
      passingScore: 60,
    });

  const handleEdit = (exam: Exam) => {
    setSelectedExam(exam);
    setFormData({
      title: exam.title,
      description: exam.description || "",
      courseId: exam.courseId || "",
      examType: exam.examType,
      examDate: exam.examDate || "",
      deadlineAt: exam.deadlineAt || "",
      durationMinutes: exam.durationMinutes,
      passingScore: exam.passingScore,
    });
    setEditModalOpen(true);
  };

  const columns: ColumnsType<Exam> = [
    { title: "考试名称", dataIndex: "title", key: "title", width: 180, ellipsis: true },
    {
      title: "类型",
      dataIndex: "examType",
      key: "examType",
      width: 100,
      align: "left",
      render: (t) => (
        <Tag color={examTypeMap[t]?.color}>{examTypeMap[t]?.label || t}</Tag>
      ),
    },
    { title: "关联课程", dataIndex: "courseName", key: "courseName", width: 150, ellipsis: true },
    {
      title: "时长(分钟)",
      dataIndex: "durationMinutes",
      key: "durationMinutes",
      width: 90,
    },
    { title: "总分", dataIndex: "totalScore", key: "totalScore", width: 70 },
    {
      title: "及格分",
      dataIndex: "passingScore",
      key: "passingScore",
      width: 70,
    },
    {
      title: "考试时间",
      dataIndex: "examDate",
      key: "examDate",
      width: 150,
      render: (d) => d ? d.replace("T", " ").substring(0, 19) : "-",
    },
    {
      title: "截止时间",
      dataIndex: "deadlineAt",
      key: "deadlineAt",
      width: 150,
      render: (d) => d ? d.replace("T", " ").substring(0, 19) : "-",
    },
    {
      title: "操作",
      key: "actions",
      width: 320,
      render: (_, r) => (
        <Space size="small" wrap>
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => navigate(`/teacher/dashboard/exam-exercises/${r.id}`)}
          >
            管理习题
          </Button>
          <ReadonlyActionButton
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(r)}
          >
            编辑
          </ReadonlyActionButton>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/teacher/dashboard/exam-grading/${r.id}`)}
          >
            批改
          </Button>
          <Button
            type="link"
            size="small"
            icon={<BarChartOutlined />}
            onClick={() => navigate(`/teacher/dashboard/exam-statistics/${r.id}`)}
          >
            成绩分析
          </Button>
          <Popconfirm
            title="确定删除？"
            onConfirm={() => deleteMutation.mutate(r.id)}
          >
            <ReadonlyActionButton type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (!user)
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );

  // 验证截止时间是否有效
  const validateDeadline = (): { valid: boolean; message?: string } => {
    if (!formData.examDate || !formData.deadlineAt) {
      return { valid: true }; // 如果没有设置考试时间或截止时间，不验证
    }

    const examDate = new Date(formData.examDate);
    const deadlineAt = new Date(formData.deadlineAt);
    const examEndTime = new Date(examDate.getTime() + formData.durationMinutes * 60 * 1000);

    if (deadlineAt <= examEndTime) {
      return {
        valid: false,
        message: `截止时间必须晚于考试结束时间 (${dayjs(examEndTime).format("YYYY-MM-DD HH:mm")})`,
      };
    }

    return { valid: true };
  };

  const handleCreateSubmit = () => {
    const validation = validateDeadline();
    if (!validation.valid) {
      message.error(validation.message);
      return;
    }
    if (!formData.title || formData.title.trim().length < 3) {
      message.error("考试名称至少需要3个字符");
      return;
    }
    createMutation.mutate(formData);
  };

  const handleEditSubmit = () => {
    if (!selectedExam) return;
    const validation = validateDeadline();
    if (!validation.valid) {
      message.error(validation.message);
      return;
    }
    if (!formData.title || formData.title.trim().length < 3) {
      message.error("考试名称至少需要3个字符");
      return;
    }
    updateMutation.mutate({ id: selectedExam.id, data: formData });
  };

  const renderForm = () => {
    const deadlineValidation = validateDeadline();

    return (
      <Form layout="vertical">
        <Form.Item 
          label="考试名称" 
          required
          extra="请输入3个字符以上的考试名称"
          validateStatus={formData.title && formData.title.trim().length < 3 ? "error" : ""}
          help={formData.title && formData.title.trim().length < 3 ? "考试名称至少需要3个字符" : undefined}
          rules={[
            { required: true, message: "请输入考试名称" },
            { min: 3, message: "考试名称至少需要3个字符" }
          ]}
        >
          <Input
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="请输入考试名称（至少3个字符）"
          />
        </Form.Item>
        <Form.Item label="关联课程">
          <Select
            value={formData.courseId || undefined}
            onChange={(v) => setFormData({ ...formData, courseId: v })}
            options={(Array.isArray(courses) ? courses : []).map((c: any) => ({ value: c.id, label: c.title }))}
            placeholder="选择课程"
            allowClear
          />
        </Form.Item>
        <Form.Item label="考试类型" required>
          <Select
            value={formData.examType}
            onChange={(v) => setFormData({ ...formData, examType: v })}
            options={Object.entries(examTypeMap).map(([k, v]) => ({
              value: k,
              label: v.label,
            }))}
          />
        </Form.Item>
        <Form.Item label="考试时间">
          <DatePicker
            showTime={{ format: "HH:mm" }}
            format="YYYY-MM-DD HH:mm"
            value={formData.examDate ? dayjs(formData.examDate, "YYYY-MM-DD HH:mm") : null}
            onChange={(date) =>
              setFormData({ ...formData, examDate: date ? date.format("YYYY-MM-DDTHH:mm") : "" })
            }
            style={{ width: "100%" }}
            placeholder="选择考试时间"
          />
        </Form.Item>
        <Form.Item label="考试时长(分钟)">
          <InputNumber
            min={1}
            value={formData.durationMinutes}
            onChange={(v) =>
              setFormData({ ...formData, durationMinutes: v || 60 })
            }
          />
        </Form.Item>
        <Form.Item
          label="截止时间"
          validateStatus={!deadlineValidation.valid ? "error" : ""}
          help={!deadlineValidation.valid ? deadlineValidation.message : "截止时间必须晚于考试结束时间（考试时间+考试时长）"}
        >
          <DatePicker
            showTime={{ format: "HH:mm" }}
            format="YYYY-MM-DD HH:mm"
            value={formData.deadlineAt ? dayjs(formData.deadlineAt, "YYYY-MM-DD HH:mm") : null}
            onChange={(date) =>
              setFormData({ ...formData, deadlineAt: date ? date.format("YYYY-MM-DDTHH:mm") : "" })
            }
            style={{ width: "100%" }}
            placeholder="选择截止时间"
          />
        </Form.Item>
        <Form.Item label="及格分数">
          <InputNumber
            min={0}
            max={100}
            value={formData.passingScore}
            onChange={(v) => setFormData({ ...formData, passingScore: v || 60 })}
          />
        </Form.Item>
        <Form.Item label="描述">
          <TextArea
            rows={2}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="考试描述"
          />
        </Form.Item>
      </Form>
    );
  };

  return (
    <div className="exam-management-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.exam-management-wrap{padding:12px!important}.exam-management-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <ScheduleOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
          试卷管理
        </Title>
      </div>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Space wrap>
          <Text strong>选择课程：</Text>
          <Select
            placeholder="请选择课程"
            allowClear
            style={{ width: 180 }}
            value={selectedCourseId}
            onChange={setSelectedCourseId}
            options={(Array.isArray(courses) ? courses : []).map((c: any) => ({ value: c.id, label: c.title }))}
            loading={coursesLoading}
          />
          <Input.Search
            placeholder="搜索考试名称"
            allowClear
            onSearch={(value) => setSearchText(value)}
            style={{ width: 200 }}
          />
          <span>考试时间:</span>
          <DatePicker.RangePicker
            showTime
            format="YYYY-MM-DD HH:mm"
            onChange={(dates) => setExamDateRange(dates as [dayjs.Dayjs | null, dayjs.Dayjs | null])}
            style={{ width: 340 }}
          />
          <Select
            placeholder="截止时间"
            allowClear
            style={{ width: 120 }}
            value={deadlineFilter}
            onChange={setDeadlineFilter}
            options={[
              { value: "before", label: "已截止" },
              { value: "after", label: "未截止" },
            ]}
          />
        </Space>
      </div>

      <Card>
        <Table
          className="theme-table"
          columns={columns}
          dataSource={filteredExams}
          rowKey="id"
          loading={examsLoading}
          title={() => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    resetForm();
                    setCreateModalOpen(true);
                  }}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  创建考试
                </Button>
              </Space>
            </div>
          )}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        title="创建考试"
        width={600}
        onOk={handleCreateSubmit}
        confirmLoading={createMutation.isPending}
      >
        {renderForm()}
      </Modal>

      <Modal
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        title="编辑考试"
        width={600}
        onOk={handleEditSubmit}
        confirmLoading={updateMutation.isPending}
      >
        {renderForm()}
      </Modal>
    </div>
  );
}
