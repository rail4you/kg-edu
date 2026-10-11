import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Modal,
  Input,
  Select,
  Tag,
  Spin,
  Space,
  Table,
  message,
  Popconfirm,
  Empty,
  Form,
} from "antd";
import type { TableColumnsType, TableProps } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UploadOutlined,
  DownloadOutlined,
  ArrowLeftOutlined,
  SearchOutlined
} from "@ant-design/icons";
import {
  listHomeworks,
  createHomework,
  updateHomework,
  destroyHomework,
  importHomeworkFromXlsx,
  getFileTemplateBySection,
  bulkDestroyHomeworks,
  type HomeworkResourceSchema,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { AppPage, ProtoCard, ProtoTabs, ProtoEmpty } from "@/components/proto";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";

const { Title, Text } = Typography;
const { TextArea } = Input;

const scoreOptions = Array.from({ length: 11 }, (_, i) => i * 10);

export default function HomeworkManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();
  const [selectedCourse, setSelectedCourse] = useState<string>("");
  const [subtab, setSubtab] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingHomework, setEditingHomework] =
    useState<HomeworkResourceSchema | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [createForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [importResultModalOpen, setImportResultModalOpen] = useState(false);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    skippedCount: number;
    errorCount: number;
    skipped: Array<{ title: string; reason: string }>;
    errors: Array<{ title: string; reason: string }>;
  } | null>(null);

  const tenant = currentTenant?.schemaName;

  // 使用统一的课程获取 hook
  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description", "teacherId"],
  });

  // 自动选择第一个课程
  useEffect(() => {
    const courses = Array.isArray(coursesData) ? coursesData : [];
    if (courses.length > 0 && !selectedCourse) {
      setSelectedCourse(courses[0].id);
    }
  }, [coursesData, selectedCourse]);

  const {
    data: homeworksData,
    isLoading: homeworksLoading,
    error: homeworksError,
    refetch: refetchHomeworks,
  } = useQuery({
    queryKey: ["homeworks", tenant, selectedCourse],
    queryFn: async () => {
      if (!selectedCourse) return [];
      const result = await listHomeworks({
        fields: [
          "id",
          "title",
          "content",
          "score",
          "answer",
          "position",
          "courseId",
          "chapterId",
          "knowledgeResourceId",
          "createdById",
        ],
        filter: { courseId: { eq: selectedCourse } },
        sort: "position",
        tenant: tenant || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourse && !!tenant && !!user,
  });

  const createHomeworkMutation = useMutation({
    mutationFn: async (homeworkData: {
      title: string;
      content: string;
      answer: string | null;
      score: string | null;
    }) => {
      const result = await createHomework({
        input: {
          ...homeworkData,
          courseId: selectedCourse,
          createdById: user?.id,
        },
        fields: [
          "id",
          "title",
          "content",
          "score",
          "answer",
          "courseId",
          "createdById",
        ],
        tenant: tenant || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to create homework");
    },
    onSuccess: () => {
      message.success("作业创建成功");
      queryClient.invalidateQueries({
        queryKey: ["homeworks", tenant, selectedCourse],
      });
      setCreateModalOpen(false);
      createForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.message || "创建失败");
    },
  });

  const updateHomeworkMutation = useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: {
        title: string;
        content: string;
        answer: string | null;
        score: string | null;
      };
    }) => {
      const result = await updateHomework({
        primaryKey: id,
        input: {
          title: input.title,
          content: input.content,
          answer: input.answer,
          score: input.score,
        },
        fields: [
          "id",
          "title",
          "content",
          "score",
          "answer",
          "courseId",
          "createdById",
        ],
        tenant: tenant || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to update homework");
    },
    onSuccess: () => {
      message.success("作业更新成功");
      queryClient.invalidateQueries({
        queryKey: ["homeworks", tenant, selectedCourse],
      });
      setEditModalOpen(false);
      setEditingHomework(null);
      editForm.resetFields();
    },
    onError: (error: any) => {
      message.error(error?.message || "更新失败");
    },
  });

  const deleteHomeworkMutation = useMutation({
    mutationFn: async (homeworkId: string) => {
      const result = await destroyHomework({
        primaryKey: homeworkId,
        tenant: tenant || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to delete homework");
    },
    onSuccess: () => {
      message.success("作业删除成功");
      queryClient.invalidateQueries({
        queryKey: ["homeworks", tenant, selectedCourse],
      });
    },
    onError: (error: any) => {
      message.error(error?.message || "删除失败");
    },
  });

  const importHomeworkMutation = useMutation({
    mutationFn: async (xlsxBase64: string) => {
      if (!selectedCourse) {
        throw new Error("Please select a course first");
      }
      const result = await importHomeworkFromXlsx({
        tenant: tenant || "",
        input: {
          excelFile: xlsxBase64,
          courseId: selectedCourse,
          attributes: ["title", "content", "score", "answer"],
        },
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to import homework");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({
        queryKey: ["homeworks", tenant, selectedCourse],
      });
      setImportModalOpen(false);
      // 显示导入结果
      setImportResult({
        successCount: data?.successCount || 0,
        skippedCount: data?.skippedCount || 0,
        errorCount: data?.errorCount || 0,
        skipped: data?.skipped || [],
        errors: data?.errors || [],
      });
      setImportResultModalOpen(true);
    },
    onError: (error: any) => {
      message.error(error?.message || "导入失败");
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (homeworkIds: string[]) => {
      const result = await bulkDestroyHomeworks({
        input: { homeworkIds },
        tenant: tenant || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to bulk delete homeworks");
    },
    onSuccess: (data: any) => {
      message.success(data?.message || `成功删除 ${selectedRowKeys.length} 个作业`);
      setSelectedRowKeys([]);
      queryClient.invalidateQueries({
        queryKey: ["homeworks", tenant, selectedCourse],
      });
    },
    onError: (error: any) => {
      message.error(error?.message || "批量删除失败");
    },
  });

  const courses = extractArrayData(coursesData);
  const homeworks = homeworksData || [];
  const filteredHomeworks = homeworks.filter(
    (h) => !searchText || (h.title || "").toLowerCase().includes(searchText.trim().toLowerCase()),
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
        <Title level={3} style={{ marginBottom: 16, color: "#ff4d4f" }}>
          用户未登录
        </Title>
        <Text style={{ marginBottom: 24 }}>请登录以访问作业管理。</Text>
        <Button type="primary" href="/login">
          登录
        </Button>
      </div>
    );
  }

  if (!tenant) {
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
        <Title level={3} style={{ marginBottom: 16, color: "#faad14" }}>
          请先选择租户
        </Title>
        <Text style={{ marginBottom: 24 }}>选择租户后才能管理作业。</Text>
        <Tag color="warning">请先选择租户才能使用作业管理功能</Tag>
      </div>
    );
  }

  const handleCreateHomework = (values: any) => {
    if (!selectedCourse) {
      message.warning("请先选择一个课程");
      return;
    }
    createHomeworkMutation.mutate({
      title: values.title,
      content: values.content || "",
      answer: values.answer || null,
      score: values.score || null,
    });
  };

  const handleEditHomework = (homework: HomeworkResourceSchema) => {
    setEditingHomework(homework);
    editForm.setFieldsValue({
      title: homework.title,
      content: homework.content,
      answer: homework.answer || "",
      score: homework.score || "",
    });
    setEditModalOpen(true);
  };

  const handleUpdateHomework = (values: any) => {
    if (!editingHomework) return;
    updateHomeworkMutation.mutate({
      id: editingHomework.id,
      input: {
        title: values.title,
        content: values.content || "",
        answer: values.answer || null,
        score: values.score || null,
      },
    });
  };

  const handleDeleteHomework = (homeworkId: string) => {
    deleteHomeworkMutation.mutate(homeworkId);
  };

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(xlsx|xls)$/)) {
      message.warning("请上传Excel文件 (.xlsx 或 .xls)");
      event.target.value = "";
      return;
    }

    if (!selectedCourse) {
      message.warning("请先选择一个课程");
      event.target.value = "";
      return;
    }

    setUploadingFile(true);

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(",")[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      importHomeworkMutation.mutate(base64, {
        onSuccess: () => {
          event.target.value = "";
          message.success("作业导入成功！");
        },
        onError: (error: any) => {
          message.error(`导入失败: ${error.message}`);
          event.target.value = "";
        },
      });
    } catch {
      message.error("文件读取失败，请重试");
      event.target.value = "";
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const result = await getFileTemplateBySection({
        input: { section: "homework" },
        fields: ["id", "section", "filePath"],
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data?.filePath) {
        const link = document.createElement("a");
        link.href = result.data.filePath;
        link.download = "homework_template.xlsx";
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else if (
        result.errors?.[0]?.type === "not_found" ||
        result.errors?.[0]?.message?.includes("record not found")
      ) {
        message.warning(
          "暂未配置模板文件，请联系管理员上传模板后再试",
        );
      } else {
        message.error("下载模板失败，请稍后重试");
      }
    } catch {
      message.error("下载模板失败，请稍后重试");
    }
  };

  interface HomeworkRow {
    id: string;
    title: string;
    content: string;
    answer: string | null;
    score: string | null;
    position: number;
  }

  const columns: TableColumnsType<HomeworkRow> = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      width: 200,
      align: "left",
      ellipsis: true,
    },
    {
      title: "内容",
      dataIndex: "content",
      key: "content",
      width: 250,
      ellipsis: true,
      render: (text: string) => (
        <Text ellipsis={{ tooltip: text }} style={{ maxWidth: 230 }}>
          {text || "暂无内容"}
        </Text>
      ),
    },
    {
      title: "答案",
      dataIndex: "answer",
      key: "answer",
      width: 150,
      ellipsis: true,
      render: (text: string) => (
        <Text
          type={text ? undefined : "secondary"}
          italic={!text}
          ellipsis={{ tooltip: text }}
          style={{ maxWidth: 130 }}
        >
          {text || "暂无答案"}
        </Text>
      ),
    },
    {
      title: "分数",
      dataIndex: "score",
      key: "score",
      width: 100,
      render: (score: string) => (
        <Tag color="green">{score ? `${score}分` : "未设置"}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 150,
      render: (_, record) => (
        <Space>
          <ReadonlyActionButton
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEditHomework(record as any)}
          >
            编辑
          </ReadonlyActionButton>
          <Popconfirm
            title="确定要删除这个作业吗？"
            onConfirm={() => handleDeleteHomework(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <ReadonlyActionButton type="link" danger icon={<DeleteOutlined />}>
              删除
            </ReadonlyActionButton>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection: TableProps<HomeworkRow>["rowSelection"] = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
  };

  const renderLoadingOverlay = () => {
    if (!coursesLoading && !homeworksLoading) return null;
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(255,255,255,0.8)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        <Spin size="large" />
        <Text style={{ marginTop: 16 }}>
          {coursesLoading ? "正在加载课程..." : "正在加载作业..."}
        </Text>
      </div>
    );
  };

  return (
    <AppPage
      title="作业管理"
      description="管理课程作业与批改"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;作业管理</>}
      actions={
        <Space>
          <Button
            icon={<UploadOutlined />}
            onClick={() => setImportModalOpen(true)}
            disabled={!selectedCourse}
            style={canEdit ? undefined : { display: "none" }}
          >
            导入作业
          </Button>
          <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
            下载模板
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalOpen(true)}
            disabled={!selectedCourse}
            style={canEdit ? undefined : { display: "none" }}
          >
            创建作业
          </Button>
        </Space>
      }
    >
      {renderLoadingOverlay()}

      {coursesData?.success === false && (
        <div style={{ textAlign: "center", padding: 64 }}>
          <Text type="danger" style={{ fontSize: 16, marginBottom: 16, display: "block" }}>
            加载课程时出错: {coursesData.errors?.[0]?.message || "未知错误"}
          </Text>
          <Button
            type="primary"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["courses", tenant] })}
          >
            重试
          </Button>
        </div>
      )}

      {homeworksError && (
        <div style={{ textAlign: "center", padding: 64 }}>
          <Text type="danger" style={{ fontSize: 16, marginBottom: 16, display: "block" }}>
            加载作业时出错: {(homeworksError as Error)?.message}
          </Text>
          <Button type="primary" onClick={() => refetchHomeworks()}>
            重试
          </Button>
        </div>
      )}

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
          <Select
            style={{ width: 240 }}
            placeholder="请选择课程"
            value={selectedCourse || undefined}
            onChange={(value) => setSelectedCourse(value)}
            loading={coursesLoading}
            options={courses.map((course: any) => ({ label: course.title, value: course.id }))}
          />
          <Input
            className="pu-search"
            placeholder="搜索作业标题"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
          <Button onClick={() => setSearchText("")}>重置</Button>
          {selectedRowKeys.length > 0 && canEdit && (
            <Popconfirm
              title={`确定要删除选中的 ${selectedRowKeys.length} 个作业吗？`}
              onConfirm={() => bulkDeleteMutation.mutate(selectedRowKeys as string[])}
              okText="确定"
              cancelText="取消"
            >
              <Button danger icon={<DeleteOutlined />} loading={bulkDeleteMutation.isPending}>
                批量删除 ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
        </div>

        {!selectedCourse ? (
          <ProtoEmpty
            title="请选择课程"
            description={
              courses.length === 0
                ? "未找到课程，请先创建课程后再管理作业"
                : "选择课程后将显示该课程的作业列表。"
            }
          />
        ) : filteredHomeworks.length === 0 ? (
          <ProtoEmpty title="暂无作业" description="点击右上角「创建作业」开始。" />
        ) : (
          <>
            <Table
              columns={columns}
              dataSource={filteredHomeworks}
              rowKey="id"
              rowSelection={filteredHomeworks.length > 0 ? rowSelection : undefined}
              loading={homeworksLoading}
              pagination={false}
              size="middle"
            />
            <div className="pu-table-footer">
              <span>共 {filteredHomeworks.length} 条</span>
            </div>
          </>
        )}
      </ProtoCard>
      <Modal
        title="创建新作业"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateHomework}
        >
          <Form.Item
            name="title"
            label="作业标题"
            rules={[{ required: true, message: "请输入作业标题" }]}
          >
            <Input placeholder="请输入作业标题" />
          </Form.Item>
          <Form.Item name="content" label="作业内容">
            <TextArea rows={6} placeholder="请输入作业内容（可选）" />
          </Form.Item>
          <Form.Item name="answer" label="作业答案">
            <TextArea rows={4} placeholder="请输入作业的参考答案（可选）" />
          </Form.Item>
          <Form.Item
            name="score"
            label="分数（可选）"
            extra="请选择作业分数（0-100分，步长10分）"
          >
            <Select placeholder="不设置分数" allowClear>
              {scoreOptions.map((score) => (
                <Select.Option key={score} value={score.toString()}>
                  {score}分
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setCreateModalOpen(false);
                  createForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={createHomeworkMutation.isPending}
              >
                创建
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="编辑作业"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingHomework(null);
          editForm.resetFields();
        }}
        footer={null}
        width={600}
      >
        <Form form={editForm} layout="vertical" onFinish={handleUpdateHomework}>
          <Form.Item
            name="title"
            label="作业标题"
            rules={[{ required: true, message: "请输入作业标题" }]}
          >
            <Input placeholder="请输入作业标题" />
          </Form.Item>
          <Form.Item name="content" label="作业内容">
            <TextArea rows={6} placeholder="请输入作业内容（可选）" />
          </Form.Item>
          <Form.Item name="answer" label="作业答案">
            <TextArea rows={4} placeholder="请输入作业的参考答案（可选）" />
          </Form.Item>
          <Form.Item
            name="score"
            label="分数（可选）"
            extra="请选择作业分数（0-100分，步长10分）"
          >
            <Select placeholder="不设置分数" allowClear>
              {scoreOptions.map((score) => (
                <Select.Option key={score} value={score.toString()}>
                  {score}分
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item>
            <Space>
              <Button
                onClick={() => {
                  setEditModalOpen(false);
                  setEditingHomework(null);
                  editForm.resetFields();
                }}
              >
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={updateHomeworkMutation.isPending}
              >
                更新
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="导入作业"
        open={importModalOpen}
        onCancel={() => !uploadingFile && setImportModalOpen(false)}
        footer={null}
        width={480}
      >
        <div style={{ textAlign: "center", padding: 24 }}>
          {!selectedCourse ? (
            <>
              <Text
                type="warning"
                style={{ fontSize: 16, marginBottom: 8, display: "block" }}
              >
                请先选择一个课程
              </Text>
              <Text type="secondary">导入作业前需要选择目标课程</Text>
            </>
          ) : (
            <>
              <UploadOutlined
                style={{ fontSize: 64, color: "#1890ff", marginBottom: 16 }}
              />
              <Title level={5} style={{ marginBottom: 8 }}>
                上传Excel文件
              </Title>
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 24 }}
              >
                支持 .xlsx 和 .xls 格式的文件
                <br />
                文件应包含：标题(title)、内容(content)、分数(score) 列
              </Text>
              <Button disabled={uploadingFile}>
                选择文件
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    opacity: 0,
                    cursor: "pointer",
                  }}
                />
              </Button>
              {uploadingFile && (
                <div style={{ marginTop: 16 }}>
                  <Spin size="small" />
                  <Text style={{ marginLeft: 8 }}>正在导入...</Text>
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ textAlign: "right", marginTop: 16 }}>
          <Button
            onClick={() => setImportModalOpen(false)}
            disabled={uploadingFile}
          >
            取消
          </Button>
        </div>
      </Modal>

      {/* 导入结果弹窗 */}
      <Modal
        title="导入结果"
        open={importResultModalOpen}
        onCancel={() => setImportResultModalOpen(false)}
        footer={null}
        width={600}
      >
        {importResult && (
          <div style={{ padding: 16 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-around",
                marginBottom: 24,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "#52c41a",
                  }}
                >
                  {importResult.successCount}
                </div>
                <Text type="secondary">成功导入</Text>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "#faad14",
                  }}
                >
                  {importResult.skippedCount}
                </div>
                <Text type="secondary">已忽略（重复）</Text>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: "bold",
                    color: "#ff4d4f",
                  }}
                >
                  {importResult.errorCount}
                </div>
                <Text type="secondary">导入失败</Text>
              </div>
            </div>

            {importResult.skippedCount > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>已忽略的作业（标题重复）</Title>
                <div
                  style={{
                    maxHeight: 120,
                    overflow: "auto",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: 8,
                  }}
                >
                  {importResult.skipped.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "4px 0",
                        borderBottom:
                          index < importResult.skipped.length - 1
                            ? "1px solid #f0f0f0"
                            : "none",
                      }}
                    >
                      <Tag color="warning">{item.title}</Tag>
                      <Text type="secondary" style={{ marginLeft: 8 }}>
                        {item.reason}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {importResult.errorCount > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>导入失败的作业</Title>
                <div
                  style={{
                    maxHeight: 120,
                    overflow: "auto",
                    border: "1px solid #d9d9d9",
                    borderRadius: 4,
                    padding: 8,
                  }}
                >
                  {importResult.errors.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        padding: "4px 0",
                        borderBottom:
                          index < importResult.errors.length - 1
                            ? "1px solid #f0f0f0"
                            : "none",
                      }}
                    >
                      <Tag color="error">{item.title}</Tag>
                      <Text type="danger" style={{ marginLeft: 8 }}>
                        {item.reason}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ textAlign: "right", marginTop: 16 }}>
              <Button
                type="primary"
                onClick={() => setImportResultModalOpen(false)}
              >
                确定
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AppPage>
  );
}
