import React, { useState } from "react"
import {
  useNavigate } from "react-router-dom";
import {
  useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Grid,
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Tabs,
  InputNumber,
  Spin,
  Descriptions,
} from "antd";
import type { TableColumnsType, TabsProps } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  ImportOutlined,
  CheckCircleOutlined,
  EyeOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  createMmHomework,
  updateMmHomework,
  deleteMmHomework,
  listMmHomeworksByCourse,
  importMmHomeworksFromCourse,
  submitMmHomework,
  gradeMmHomework,
  listMmHomeworkSubmissionsByHomework,
  listMmHomeworkSubmissionsByCourse,
  listHomeworks,
} from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Text, Title } = Typography;
const { TextArea } = Input;

const scoreOptions = Array.from({ length: 11 }, (_, i) => i * 10);

interface MMHomeworkManagerProps {
  tenant: string;
  courseId: string;
  headers: Record<string, string>;
  user?: any;
}

interface HomeworkItem {
  id: string;
  microMajorCourseId: string;
  microMajorChapterId?: string | null;
  title: string;
  content?: string | null;
  score?: string | null;
  answer?: string | null;
  position?: number | null;
  sourceHomeworkId?: string | null;
  insertedAt?: string;
}

interface SubmissionItem {
  id: string;
  microMajorHomeworkId: string;
  studentId: string;
  submissionContent: string;
  score?: string | null;
  teacherComment?: string | null;
  status: "submitted" | "graded";
  teacherId?: string | null;
  insertedAt?: string;
  student?: { id: string; name?: string };
  microMajorHomework?: HomeworkItem;
}

export default function MMHomeworkManager({
  tenant,
  courseId,
  headers,
  user,
}: MMHomeworkManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const bp = Grid.useBreakpoint();
  const isMobile = !bp.md;
  const { canEdit } = useEditPermission();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] = useState<HomeworkItem | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [gradeModalOpen, setGradeModalOpen] = useState(false);
  const [gradingSubmission, setGradingSubmission] = useState<SubmissionItem | null>(null);
  const [importCourseId, setImportCourseId] = useState<string | null>(null);
  const [importHomeworkIds, setImportHomeworkIds] = useState<string[]>([]);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [gradeForm] = Form.useForm();

  // Fetch homeworks
  const { data: homeworksData, isLoading: homeworksLoading } = useQuery({
    queryKey: ["mm-homeworks", tenant, courseId],
    queryFn: async () => {
      const result = await listMmHomeworksByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: [
          "id",
          "title",
          "content",
          "score",
          "answer",
          "position",
          "sourceHomeworkId",
          "insertedAt",
        ],
        headers,
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant && !!courseId,
  });

  const homeworks: HomeworkItem[] = homeworksData || [];

  // Fetch submissions for grading
  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ["mm-homework-submissions", tenant, courseId],
    queryFn: async () => {
      const result = await listMmHomeworkSubmissionsByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        headers,
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant && !!courseId,
  });

  const submissions: SubmissionItem[] = submissionsData || [];

  // Fetch source courses for import
  const { data: coursesData } = useQuery({
    queryKey: ["mm-import-courses", tenant],
    queryFn: async () => {
      const resp = await fetch(`/rpc/run?tenant=${tenant}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          action: "get_all_courses",
          fields: ["id", "title"],
        }),
      });
      const result = await resp.json();
      if (!result.success) return [];
      return extractArrayData(result);
    },
    enabled: !!tenant,
  });

  const courses: any[] = coursesData || [];

  // Fetch source homeworks for import
  const { data: sourceHomeworksData } = useQuery({
    queryKey: ["mm-import-source-homeworks", tenant, importCourseId],
    queryFn: async () => {
      if (!importCourseId) return [];
      const result = await listHomeworks({
        tenant,
        filter: { courseId: { eq: importCourseId } },
        fields: ["id", "title", "content", "score"],
        headers,
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant && !!importCourseId,
  });

  const sourceHomeworks: any[] = sourceHomeworksData || [];

  // Create homework
  const createMutation = useMutation({
    mutationFn: async (values: { title: string; content?: string; score?: string; answer?: string }) => {
      const result = await createMmHomework({
        tenant,
        input: {
          microMajorCourseId: courseId,
          title: values.title,
          content: values.content || "",
          score: values.score || null,
          answer: values.answer || null,
        },
        fields: ["id", "title", "content", "score"],
        headers,
      });
      if (result.success) return result.data;
      throw new Error("创建失败");
    },
    onSuccess: () => {
      message.success("作业创建成功");
      queryClient.invalidateQueries({ queryKey: ["mm-homeworks", tenant, courseId] });
      setCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (err: any) => message.error(err?.message || "创建失败"),
  });

  // Update homework
  const updateMutation = useMutation({
    mutationFn: async ({ id, input }: { id: string; input: any }) => {
      const result = await updateMmHomework({
        tenant,
        primaryKey: id,
        input,
        fields: ["id", "title"],
        headers,
      });
      if (result.success) return result.data;
      throw new Error("更新失败");
    },
    onSuccess: () => {
      message.success("作业更新成功");
      queryClient.invalidateQueries({ queryKey: ["mm-homeworks", tenant, courseId] });
      setEditModalOpen(false);
      setEditingHomework(null);
      editForm.resetFields();
    },
    onError: (err: any) => message.error(err?.message || "更新失败"),
  });

  // Delete homework
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMmHomework({
        tenant,
        primaryKey: id,
        headers,
      });
      if (result.success) return;
      throw new Error("删除失败");
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["mm-homeworks", tenant, courseId] });
      queryClient.invalidateQueries({ queryKey: ["mm-homework-submissions", tenant, courseId] });
    },
    onError: (err: any) => message.error(err?.message || "删除失败"),
  });

  // Import homeworks
  const importMutation = useMutation({
    mutationFn: async (homeworkIds: string[]) => {
      const result = await importMmHomeworksFromCourse({
        tenant,
        input: {
          microMajorCourseId: courseId,
          homeworkIds,
        },
        headers,
      });
      if (result.success) return result.data;
      throw new Error("导入失败");
    },
    onSuccess: () => {
      message.success("作业导入成功");
      queryClient.invalidateQueries({ queryKey: ["mm-homeworks", tenant, courseId] });
      setImportModalOpen(false);
      setImportCourseId(null);
      setImportHomeworkIds([]);
    },
    onError: (err: any) => message.error(err?.message || "导入失败"),
  });

  // Grade submission
  const gradeMutation = useMutation({
    mutationFn: async ({ id, score, teacherComment }: { id: string; score: number; teacherComment?: string }) => {
      // Validate score against max score
      const submission = submissions.find(s => s.id === id);
      const maxScore = submission?.microMajorHomework?.score ? Number(submission.microMajorHomework.score) : undefined;
      if (maxScore !== undefined && score > maxScore) {
        throw new Error(`评分不能超过满分 ${maxScore}分`);
      }
      if (score < 0) {
        throw new Error("评分不能为负数");
      }

      const result = await gradeMmHomework({
        tenant,
        primaryKey: id,
        input: {
          score: score.toString(),
          teacherComment: teacherComment || null,
          teacherId: user?.id || "",
        },
        fields: ["id", "status", "score"],
        headers,
      });
      if (result.success) return result.data;
      throw new Error("评分失败");
    },
    onSuccess: () => {
      message.success("评分成功");
      queryClient.invalidateQueries({ queryKey: ["mm-homework-submissions", tenant, courseId] });
      setGradeModalOpen(false);
      setGradingSubmission(null);
      gradeForm.resetFields();
    },
    onError: (err: any) => message.error(err?.message || "评分失败"),
  });

  const homeworkColumns: TableColumnsType<HomeworkItem> = [
    { title: "标题", dataIndex: "title", key: "title", width: 200, ellipsis: true },
    {
      title: "内容",
      dataIndex: "content",
      key: "content",
      ellipsis: true,
      render: (v: string | null) => (
        <Text ellipsis={{ tooltip: v }} style={{ maxWidth: 250 }}>{v || "-"}</Text>
      ),
    },
    {
      title: "分数",
      dataIndex: "score",
      key: "score",
      width: 100,
      render: (v: string | null) => (
        <Tag color="green">{v ? `${v}分` : "未设置"}</Tag>
      ),
    },
    {
      title: "答案",
      dataIndex: "answer",
      key: "answer",
      ellipsis: true,
      render: (v: string | null) => (
        <Text italic={!v} type={v ? undefined : "secondary"} ellipsis={{ tooltip: v }} style={{ maxWidth: 150 }}>
          {v || "暂无答案"}
        </Text>
      ),
    },
    {
      title: "操作",
      key: "actions",
      width: isMobile ? 60 : 180,
      render: (_: any, record: HomeworkItem) => (
        <Space size={isMobile ? 2 : 4}>
          <ReadonlyActionButton
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setEditingHomework(record);
              editForm.setFieldsValue({
                title: record.title,
                content: record.content || "",
                score: record.score || undefined,
                answer: record.answer || "",
              });
              setEditModalOpen(true);
            }}
          >
            {isMobile ? "" : "编辑"}
          </ReadonlyActionButton>
          <Popconfirm title="确定删除此作业？" onConfirm={() => deleteMutation.mutate(record.id)}>
            <ReadonlyActionButton type="link" danger size="small" icon={<DeleteOutlined />}>
              {isMobile ? "" : "删除"}
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const submissionColumns: TableColumnsType<SubmissionItem> = [
    {
      title: "作业",
      dataIndex: ["microMajorHomework", "title"],
      key: "homeworkTitle",
      width: 150,
    },
    {
      title: "学生",
      key: "studentName",
      width: 120,
      render: (_: any, record: SubmissionItem) => record.student?.name || record.studentId,
    },
    {
      title: "提交内容",
      dataIndex: "submissionContent",
      key: "submissionContent",
      ellipsis: true,
      render: (v: string) => (
        <Text ellipsis={{ tooltip: v }} style={{ maxWidth: 250 }}>{v}</Text>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (v: string) => (
        <Tag color={v === "graded" ? "success" : "processing"}>
          {v === "graded" ? "已评分" : "待评分"}
        </Tag>
      ),
    },
    {
      title: "得分",
      dataIndex: "score",
      key: "score",
      width: 80,
      render: (v: string | null, record: SubmissionItem) => {
        if (record.status !== "graded" || !v) return <Text type="secondary">-</Text>;
        return <Text strong style={{ color: "#52c41a" }}>{v}分</Text>;
      },
    },
    {
      title: "评语",
      dataIndex: "teacherComment",
      key: "teacherComment",
      ellipsis: true,
      render: (v: string | null) => v || "-",
    },
    {
      title: "操作",
      key: "actions",
      width: isMobile ? 60 : 100,
      render: (_: any, record: SubmissionItem) => (
        <ReadonlyActionButton
          type="link"
          size="small"
          icon={<CheckCircleOutlined />}
          onClick={() => {
            setGradingSubmission(record);
            gradeForm.setFieldsValue({
              score: record.score ? Number(record.score) : undefined,
              teacherComment: record.teacherComment || "",
            });
            setGradeModalOpen(true);
          }}
          disabled={record.status === "graded"}
        >
          {isMobile ? "" : record.status === "graded" ? "已评分" : "评分"}
        </ReadonlyActionButton>
      ),
    },
  ];

  const renderHomeworkTab = () => (
    <Card>
      <Table
        dataSource={homeworks}
        columns={homeworkColumns}
        rowKey="id"
        loading={homeworksLoading}
        locale={{ emptyText: <Empty description="暂无作业" /> }}
        title={() => (
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalOpen(true)}
              style={canEdit ? undefined : { display: "none" }}
            >
              创建作业
            </Button>
            <Button
              icon={<ImportOutlined />}
              onClick={() => setImportModalOpen(true)}
              style={canEdit ? undefined : { display: "none" }}
            >
              导入智慧课程作业
            </Button>
          </Space>
        )}
        pagination={{ pageSize: 25, showTotal: (total) => `共 ${total} 条` }}
      />
    </Card>
  );

  const renderGradingTab = () => {
    const pendingGrading = submissions.filter((s) => s.status !== "graded");
    const graded = submissions.filter((s) => s.status === "graded");

    const avgScore = graded.length > 0
      ? Math.round(graded.reduce((sum, s) => sum + (s.score ? Number(s.score) : 0), 0) / graded.length)
      : 0;

    return (
      <div>
        {/* Stats summary */}
        <div style={{ display: "flex", gap: 24, marginBottom: 16 }}>
          <Card size="small" style={{ flex: 1, textAlign: "center" }}>
            <Text type="secondary">待评分</Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#faad14" }}>
              {pendingGrading.length}
            </div>
          </Card>
          <Card size="small" style={{ flex: 1, textAlign: "center" }}>
            <Text type="secondary">已评分</Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#52c41a" }}>
              {graded.length}
            </div>
          </Card>
          <Card size="small" style={{ flex: 1, textAlign: "center" }}>
            <Text type="secondary">平均分</Text>
            <div style={{ fontSize: 28, fontWeight: 600, color: "#722ed1" }}>
              {graded.length > 0 ? avgScore : "-"}
            </div>
          </Card>
        </div>

        <Card title="全部提交记录" size="small">
          <Table
            dataSource={submissions}
            columns={submissionColumns}
            rowKey="id"
            loading={submissionsLoading}
            locale={{ emptyText: <Empty description="暂无作业提交" /> }}
            pagination={{ pageSize: 20, showTotal: (total) => `共 ${total} 条` }}
          />
        </Card>
      </div>
    );
  };

  const tabItems: TabsProps["items"] = [
    {
      key: "homeworks",
      label: "作业列表",
      children: renderHomeworkTab(),
    },
    {
      key: "grading",
      label: "判分管理",
      children: renderGradingTab(),
    },
  ];

  return (
    <div>
      <Tabs items={tabItems} />

      {/* Create Modal */}
      <Modal
        title="创建新作业"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form form={createForm} layout="vertical" onFinish={(values) => createMutation.mutate(values)}>
          <Form.Item name="title" label="作业标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="请输入作业标题" />
          </Form.Item>
          <Form.Item name="content" label="作业内容">
            <TextArea rows={6} placeholder="请输入作业内容（可选）" />
          </Form.Item>
          <Form.Item name="answer" label="参考答案">
            <TextArea rows={4} placeholder="请输入参考答案（可选）" />
          </Form.Item>
          <Form.Item name="score" label="满分（可选）" extra="选择作业满分（0-100分）">
            <Select placeholder="不设置分数" allowClear>
              {scoreOptions.map((s) => (
                <Select.Option key={s} value={s.toString()}>{s}分</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => { setCreateModalOpen(false); createForm.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={createMutation.isPending}>创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑作业"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingHomework(null); editForm.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={(values) => {
            if (!editingHomework) return;
            updateMutation.mutate({
              id: editingHomework.id,
              input: {
                title: values.title,
                content: values.content || "",
                answer: values.answer || null,
                score: values.score || null,
              },
            });
          }}
        >
          <Form.Item name="title" label="作业标题" rules={[{ required: true, message: "请输入标题" }]}>
            <Input placeholder="请输入作业标题" />
          </Form.Item>
          <Form.Item name="content" label="作业内容">
            <TextArea rows={6} placeholder="请输入作业内容（可选）" />
          </Form.Item>
          <Form.Item name="answer" label="参考答案">
            <TextArea rows={4} placeholder="请输入参考答案（可选）" />
          </Form.Item>
          <Form.Item name="score" label="满分（可选）">
            <Select placeholder="不设置分数" allowClear>
              {scoreOptions.map((s) => (
                <Select.Option key={s} value={s.toString()}>{s}分</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button onClick={() => { setEditModalOpen(false); setEditingHomework(null); editForm.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit" loading={updateMutation.isPending}>更新</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Import Modal */}
      <Modal
        title="导入智慧课程作业"
        open={importModalOpen}
        onCancel={() => { setImportModalOpen(false); setImportCourseId(null); setImportHomeworkIds([]); }}
        width={700}
        footer={[
          <Button key="cancel" onClick={() => { setImportModalOpen(false); setImportCourseId(null); setImportHomeworkIds([]); }}>取消</Button>,
          <Button
            key="import"
            type="primary"
            icon={<ImportOutlined />}
            disabled={importHomeworkIds.length === 0}
            loading={importMutation.isPending}
            onClick={() => importMutation.mutate(importHomeworkIds)}
          >
            确认导入 ({importHomeworkIds.length} 项)
          </Button>,
        ]}
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Text strong style={{ marginRight: 8 }}>选择智慧课程:</Text>
            <Select
              placeholder="请选择课程"
              style={{ width: "100%", maxWidth: 400 }}
              value={importCourseId}
              onChange={(v) => { setImportCourseId(v); setImportHomeworkIds([]); }}
              showSearch
              optionFilterProp="children"
              options={courses.map((c: any) => ({ value: c.id, label: c.title }))}
            />
          </div>
          {importCourseId && (
            <Table
              dataSource={sourceHomeworks}
              rowKey="id"
              size="small"
              locale={{ emptyText: <Empty description="该课程暂无作业" /> }}
              pagination={sourceHomeworks.length > 20 ? { pageSize: 20 } : false}
              rowSelection={{
                type: "checkbox",
                selectedRowKeys: importHomeworkIds,
                onChange: (keys) => setImportHomeworkIds(keys as string[]),
              }}
              columns={[
                { title: "标题", dataIndex: "title", key: "title" },
                {
                  title: "内容",
                  dataIndex: "content",
                  key: "content",
                  ellipsis: true,
                },
                {
                  title: "分数",
                  dataIndex: "score",
                  key: "score",
                  width: 80,
                  render: (v: string | null) => v ? `${v}分` : "-",
                },
              ]}
              scroll={{ y: 360 }}
            />
          )}
        </Space>
      </Modal>

      {/* Grade Modal */}
      <Modal
        title="作业评分"
        open={gradeModalOpen}
        onCancel={() => { setGradeModalOpen(false); setGradingSubmission(null); gradeForm.resetFields(); }}
        footer={null}
        width={500}
      >
        {gradingSubmission && (
          <>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="作业">
                  {gradingSubmission.microMajorHomework?.title || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="学生">
                  {gradingSubmission.student?.name || gradingSubmission.studentId}
                </Descriptions.Item>
                <Descriptions.Item label="提交内容">
                  <Text style={{ whiteSpace: "pre-wrap" }}>
                    {gradingSubmission.submissionContent}
                  </Text>
                </Descriptions.Item>
                {gradingSubmission.microMajorHomework?.score && (
                  <Descriptions.Item label="满分">
                    {gradingSubmission.microMajorHomework.score}分
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
            <Form
              form={gradeForm}
              layout="vertical"
              onFinish={(values) => {
                if (!gradingSubmission) return;
                gradeMutation.mutate({
                  id: gradingSubmission.id,
                  score: values.score,
                  teacherComment: values.teacherComment,
                });
              }}
            >
              <Form.Item
                name="score"
                label="评分"
                rules={[
                  { required: true, message: "请输入分数" },
                  {
                    validator: (_, value) => {
                      if (value === undefined || value === null) return Promise.resolve();
                      const max = gradingSubmission?.microMajorHomework?.score
                        ? Number(gradingSubmission.microMajorHomework.score)
                        : undefined;
                      if (max !== undefined && value > max) {
                        return Promise.reject(new Error(`评分不能超过满分 ${max}分`));
                      }
                      if (value < 0) {
                        return Promise.reject(new Error("评分不能为负数"));
                      }
                      return Promise.resolve();
                    },
                  },
                ]}
                extra={
                  gradingSubmission.microMajorHomework?.score
                    ? `满分 ${gradingSubmission.microMajorHomework.score} 分，请输入 0-${gradingSubmission.microMajorHomework.score} 之间的分数`
                    : undefined
                }
              >
                <InputNumber
                  min={0}
                  max={gradingSubmission?.microMajorHomework?.score ? Number(gradingSubmission.microMajorHomework.score) : 100}
                  step={1}
                  style={{ width: 200 }}
                  placeholder="请输入分数"
                />
              </Form.Item>
              <Form.Item name="teacherComment" label="评语">
                <TextArea rows={3} placeholder="请输入评语（可选）" />
              </Form.Item>
              <Form.Item>
                <Space>
                  <Button onClick={() => { setGradeModalOpen(false); setGradingSubmission(null); gradeForm.resetFields(); }}>
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={gradeMutation.isPending}>
                    提交评分
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
}
