import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Modal,
  Input,
  Select,
  Table,
  Space,
  Avatar,
  message,
  Spin,
  Alert,
  Popconfirm,
  Upload,
  Progress,
} from "antd";
import type { TableProps, UploadProps } from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BookOutlined,
  PaperClipOutlined,
  UploadOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import EmptyState from "@/components/EmptyState";
import {
  listBooks,
  createBook,
  updateBook,
  deleteBook,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { getSTSToken, uploadFileToOSS } from "@/lib/oss-upload";
import { extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

const { Title, Text } = Typography;

interface BookType {
  id: string;
  title: string;
  coverImage: string | null;
  attachment: string | null;
  author: string | null;
  publisher: string | null;
  courseId: string | null;
}

interface FormData {
  title: string;
  coverImage: string;
  attachment: string;
  author: string;
  publisher: string;
  courseId: string;
}

interface BookMutationInput {
  title: string;
  coverImage: string | null;
  attachment: string | null;
  author: string | null;
  publisher: string | null;
  courseId: string | null;
  createdById: string;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

export default function BookInfoPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const { canEdit } = useEditPermission();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookType | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [imageUploading, setImageUploading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [imageProgress, setImageProgress] = useState(0);
  const [attachmentProgress, setAttachmentProgress] = useState(0);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    coverImage: "",
    attachment: "",
    author: "",
    publisher: "",
    courseId: "",
  });

  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title", "description", "imageUrl", "teacherId"],
  });

  // 自动选择第一个课程
  useEffect(() => {
    const courses = Array.isArray(coursesData) ? coursesData : [];
    if (courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [coursesData, selectedCourseId]);

  const {
    data: booksData,
    isLoading: booksLoading,
    error: booksError,
  } = useQuery({
    queryKey: ["books", tenant, selectedCourseId],
    queryFn: async () => {
      const filter = selectedCourseId
        ? { courseId: { eq: selectedCourseId } }
        : {};

      const result = await listBooks({
        tenant,
        fields: [
          "id",
          "title",
          "coverImage",
          "attachment",
          "author",
          "publisher",
          "courseId",
        ],
        filter,
        sort: "-insertedAt",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!selectedCourseId,
  });

  const createBookMutation = useMutation({
    mutationFn: async (bookData: FormData) => {
      const input: BookMutationInput = {
        title: bookData.title,
        coverImage: bookData.coverImage || null,
        attachment: bookData.attachment || null,
        author: bookData.author || null,
        publisher: bookData.publisher || null,
        courseId: bookData.courseId || null,
        createdById: user!.id,
      };

      const result = await createBook({
        tenant,
        input,
        fields: [
          "id",
          "title",
          "coverImage",
          "attachment",
          "author",
          "publisher",
        ],
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to create book");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setCreateModalOpen(false);
      resetForm();
      message.success("教材创建成功");
    },
    onError: (error: unknown) => {
      message.error(`创建失败: ${getErrorMessage(error, "未知错误")}`);
    },
  });

  const updateBookMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: FormData }) => {
      const input: BookMutationInput = {
        title: data.title,
        coverImage: data.coverImage || null,
        attachment: data.attachment || null,
        author: data.author || null,
        publisher: data.publisher || null,
        courseId: data.courseId || null,
        createdById: user!.id,
      };

      const result = await updateBook({
        tenant,
        primaryKey: id,
        input,
        fields: [
          "id",
          "title",
          "coverImage",
          "attachment",
          "author",
          "publisher",
        ],
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to update book");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      setEditModalOpen(false);
      setEditingBook(null);
      resetForm();
      message.success("教材更新成功");
    },
    onError: (error: unknown) => {
      message.error(`更新失败: ${getErrorMessage(error, "未知错误")}`);
    },
  });

  const deleteBookMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteBook({
        tenant,
        primaryKey: id,
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to delete book");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["books"] });
      message.success("教材删除成功");
    },
    onError: (error: unknown) => {
      message.error(`删除失败: ${getErrorMessage(error, "未知错误")}`);
    },
  });

  const books = useMemo(
    () => (Array.isArray(booksData) ? booksData : []),
    [booksData],
  );
  const courses = useMemo(
    () => (Array.isArray(coursesData) ? coursesData : []),
    [coursesData],
  );

  const resetForm = () => {
    setFormData({
      title: "",
      coverImage: "",
      attachment: "",
      author: "",
      publisher: "",
      courseId: "",
    });
    setImageUploading(false);
    setAttachmentUploading(false);
    setImageProgress(0);
    setAttachmentProgress(0);
  };

  const handleCreateBook = () => {
    createBookMutation.mutate(formData);
  };

  const handleEditBook = (book: BookType) => {
    setFormData({
      title: book.title,
      coverImage: book.coverImage || "",
      attachment: book.attachment || "",
      author: book.author || "",
      publisher: book.publisher || "",
      courseId: book.courseId || "",
    });
    setEditingBook(book);
    setEditModalOpen(true);
  };

  const handleDeleteBook = (id: string) => {
    deleteBookMutation.mutate(id);
  };

  const handleImageUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      message.error("图片大小不能超过10MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      message.error("只能上传图片文件");
      return;
    }

    setImageUploading(true);
    setImageProgress(0);

    try {
      const stsResponse = await getSTSToken(file.name, file.size, file.type);
      if (!stsResponse.success) {
        throw new Error(stsResponse.error || "获取上传凭证失败");
      }

      const result = await uploadFileToOSS(stsResponse, {
        file,
        onProgress: (progress) => {
          setImageProgress(Math.min(progress.percent, 90));
        },
      });

      setFormData({ ...formData, coverImage: result.url });
      setImageProgress(100);
      message.success("封面上传成功");
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "上传失败"));
    } finally {
      setImageUploading(false);
    }
  };

  const handleAttachmentUpload = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      message.error("附件大小不能超过50MB");
      return;
    }

    const allowedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ];

    if (!allowedTypes.includes(file.type)) {
      message.error("只能上传PDF、Word、PPT等文件");
      return;
    }

    setAttachmentUploading(true);
    setAttachmentProgress(0);

    try {
      const stsResponse = await getSTSToken(file.name, file.size, file.type);
      if (!stsResponse.success) {
        throw new Error(stsResponse.error || "获取上传凭证失败");
      }

      const result = await uploadFileToOSS(stsResponse, {
        file,
        onProgress: (progress) => {
          setAttachmentProgress(Math.min(progress.percent, 90));
        },
      });

      setFormData({ ...formData, attachment: result.url });
      setAttachmentProgress(100);
      message.success("附件上传成功");
    } catch (error: unknown) {
      message.error(getErrorMessage(error, "上传失败"));
    } finally {
      setAttachmentUploading(false);
    }
  };

  const imageUploadProps: UploadProps = {
    beforeUpload: (file) => {
      handleImageUpload(file);
      return false;
    },
    showUploadList: false,
    accept: "image/*",
  };

  const attachmentUploadProps: UploadProps = {
    beforeUpload: (file) => {
      handleAttachmentUpload(file);
      return false;
    },
    showUploadList: false,
    accept: ".pdf,.doc,.docx,.ppt,.pptx",
  };

  const columns: TableProps<BookType>["columns"] = [
    {
      title: "封面",
      dataIndex: "coverImage",
      key: "coverImage",
      width: 96,
      align: "center",
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (coverImage: string | null, record: BookType) =>
        coverImage ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              src={coverImage}
              alt={record.title}
              style={{
                width: 50,
                height: 70,
                borderRadius: 6,
                objectFit: "cover",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Avatar
              shape="square"
              size={50}
              style={{ width: 50, height: 70, backgroundColor: "#f5f5f5", borderRadius: 6 }}
              icon={<BookOutlined style={{ color: "#999" }} />}
            />
          </div>
        ),
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      width: "30%",
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (title: string) => (
        <Text strong ellipsis={{ tooltip: title }} style={{ display: "block" }}>
          {title}
        </Text>
      ),
    },
    {
      title: "作者",
      dataIndex: "author",
      key: "author",
      className: "book-mobile-hide",
      width: "16%",
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (author: string | null) => (
        <Text type="secondary" ellipsis={{ tooltip: author || "-" }} style={{ display: "block" }}>
          {author || "-"}
        </Text>
      ),
    },
    {
      title: "出版社",
      dataIndex: "publisher",
      key: "publisher",
      className: "book-mobile-hide",
      width: "18%",
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (publisher: string | null) => (
        <Text type="secondary" ellipsis={{ tooltip: publisher || "-" }} style={{ display: "block" }}>
          {publisher || "-"}
        </Text>
      ),
    },
    {
      title: "附件",
      dataIndex: "attachment",
      key: "attachment",
      className: "book-mobile-hide",
      width: "16%",
      align: "center",
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (attachment: string | null) =>
        attachment ? (
          <Space size={6}>
            <PaperClipOutlined style={{ color: "#1890ff" }} />
            <a href={attachment} target="_blank" rel="noopener noreferrer">
              查看附件
            </a>
          </Space>
        ) : (
          <Text type="secondary">无附件</Text>
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 72,
      align: "center",
      onCell: () => ({ style: { verticalAlign: "middle" } }),
      render: (_: unknown, record: BookType) => (
        <Space size={0}>
          <ReadonlyActionButton
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditBook(record)}
          />
          <Popconfirm
            title="确定要删除这本教材吗？"
            onConfirm={() => handleDeleteBook(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <ReadonlyActionButton type="text" danger size="small" icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderFormFields = () => (
    <>
      <div style={{ marginBottom: 16 }}>
        <Text style={{ marginBottom: 8, display: "block" }}>教材标题 *</Text>
        <Input
          placeholder="请输入教材标题"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text style={{ marginBottom: 8, display: "block" }}>作者</Text>
        <Input
          placeholder="请输入作者姓名（可选）"
          value={formData.author}
          onChange={(e) => setFormData({ ...formData, author: e.target.value })}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text style={{ marginBottom: 8, display: "block" }}>出版社</Text>
        <Input
          placeholder="请输入出版社名称（可选）"
          value={formData.publisher}
          onChange={(e) =>
            setFormData({ ...formData, publisher: e.target.value })
          }
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text style={{ marginBottom: 8, display: "block" }}>选择课程 *</Text>
        <Select
          style={{ width: "100%" }}
          placeholder="请选择课程"
          value={formData.courseId || undefined}
          onChange={(value) => setFormData({ ...formData, courseId: value })}
          loading={coursesLoading}
          options={courses.map((course: Course) => ({
            label: course.title,
            value: course.id,
          }))}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text style={{ marginBottom: 8, display: "block" }}>教材封面</Text>
        {formData.coverImage && (
          <div style={{ marginBottom: 12 }}>
            <img
              src={formData.coverImage}
              alt="封面预览"
              style={{
                width: 120,
                height: 160,
                objectFit: "cover",
                borderRadius: 8,
                border: "1px solid #d9d9d9",
              }}
            />
          </div>
        )}
        {imageUploading ? (
          <div style={{ marginBottom: 12 }}>
            <Progress percent={imageProgress} size="small" />
          </div>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              placeholder="或输入封面图片URL"
              value={formData.coverImage}
              onChange={(e) =>
                setFormData({ ...formData, coverImage: e.target.value })
              }
            />
            <Upload {...imageUploadProps}>
              <Button icon={<UploadOutlined />}>上传封面</Button>
            </Upload>
          </Space>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <Text style={{ marginBottom: 8, display: "block" }}>教材附件</Text>
        {formData.attachment && (
          <div style={{ marginBottom: 12 }}>
            <Space>
              <PaperClipOutlined />
              <Text>{formData.attachment.split("/").pop() || "附件文件"}</Text>
              <a
                href={formData.attachment}
                target="_blank"
                rel="noopener noreferrer"
              >
                查看附件
              </a>
            </Space>
          </div>
        )}
        {attachmentUploading ? (
          <div style={{ marginBottom: 12 }}>
            <Progress percent={attachmentProgress} size="small" />
          </div>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Input
              placeholder="或输入附件URL"
              value={formData.attachment}
              onChange={(e) =>
                setFormData({ ...formData, attachment: e.target.value })
              }
            />
            <Upload {...attachmentUploadProps}>
              <Button icon={<UploadOutlined />}>上传附件</Button>
            </Upload>
          </Space>
        )}
      </div>
    </>
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
        <Title level={4} style={{ marginBottom: 16, color: "#ff4d4f" }}>
          用户未登录
        </Title>
        <Text>请登录以访问教材管理。</Text>
      </div>
    );
  }

  return (
    <div className="book-page-wrap" style={{ padding: 24 }}>
      <style>{`@media(max-width:768px){.book-mobile-hide{display:none!important}.book-page-wrap{padding:12px!important}}`}</style>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 0",
          borderBottom: "1px solid #f0f0f0",
          gap: 12,
        }}
      >
        <BookOutlined style={{ fontSize: 24, color: "#1890ff" }} />
      <Button
                  className="teacher-page-back-btn"
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/teacher/dashboard")}
                  style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
                />
                          <Title level={4} style={{ margin: 0 }}>
          教材管理
        </Title>
      </div>

      {coursesLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : (
        <>
          <Card>
            {booksError && (
              <Alert
                message={`加载教材失败: ${getErrorMessage(booksError, "未知错误")}`}
                type="error"
                style={{ marginBottom: 16 }}
              />
            )}

            <Table
              className="theme-table"
              columns={columns}
              dataSource={books}
              rowKey="id"
              loading={booksLoading}
              size="small"
              title={() => (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <Space wrap>
                    <Text strong>选择课程：</Text>
                    <Select
                      style={{ width: 180 }}
                      placeholder="请选择课程"
                      allowClear
                      value={selectedCourseId || undefined}
                      onChange={(value) => setSelectedCourseId(value || "")}
                      loading={coursesLoading}
                      options={[
                        { label: "所有课程", value: "" },
                        ...courses.map((course: Course) => ({
                          label: course.title,
                          value: course.id,
                        })),
                      ]}
                    />
                  </Space>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => {
                      resetForm();
                      if (selectedCourseId) {
                        setFormData((prev) => ({ ...prev, courseId: selectedCourseId }));
                      }
                      setCreateModalOpen(true);
                    }}
                    loading={createBookMutation.isPending}
                    style={canEdit ? undefined : { display: "none" }}
                  >
                    添加教材
                  </Button>
                </div>
              )}
              locale={{
                emptyText: (
                  <EmptyState
                    description={selectedCourseId ? "暂无教材" : "请先选择一个课程"}
                  />
                ),
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: true,
                showTotal: (total) => `共 ${total} 条`,
              }}
            />
          </Card>
        </>
      )}

      <Modal
        title="添加教材"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          resetForm();
        }}
        onOk={handleCreateBook}
        okText="创建"
        cancelText="取消"
        confirmLoading={createBookMutation.isPending}
        okButtonProps={{ disabled: !formData.title || !formData.courseId }}
        width={600}
      >
        {renderFormFields()}
      </Modal>

      <Modal
        title="编辑教材"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingBook(null);
          resetForm();
        }}
        onOk={() => {
          if (editingBook) {
            updateBookMutation.mutate({ id: editingBook.id, data: formData });
          }
        }}
        okText="更新"
        cancelText="取消"
        confirmLoading={updateBookMutation.isPending}
        okButtonProps={{ disabled: !formData.title }}
        width={600}
      >
        {renderFormFields()}
      </Modal>
    </div>
  );
}
