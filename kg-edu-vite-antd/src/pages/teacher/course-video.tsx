import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Row,
  Col,
  Modal,
  Input,
  Select,
  Tag,
  Space,
  message,
  Popconfirm,
  Tabs,
  Table,
  Progress,
  Spin,
  Empty,
  Alert,
  Tooltip,
  Upload,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  PictureOutlined,
  VideoCameraOutlined,
  UploadOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import type { UploadFile } from "antd/es/upload/interface";
import {
  listCourseVideos,
  createCourseVideo,
  updateCourseVideo,
  deleteCourseVideo,
} from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { useCourses } from "@/hooks/use-courses";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import {
  getSTSToken,
  uploadFileToOSS,
  uploadFileViaServer,
} from "@/lib/oss-upload";
import type { UploadProgress } from "@/lib/oss-upload";
import type {
  CourseVideoResourceSchema,
  CourseResourceSchema,
} from "@/lib/ash_rpc";

const { Title, Text } = Typography;
const { Option } = Select;

interface CourseVideoFormData {
  name: "课程视频" | "课程体系" | "课程结构" | "课程地图";
  mediaType: "video" | "image";
  courseId: string;
  videoUrl: string;
  imageUrl: string | null;
}

const courseVideoTypes = [
  { value: "课程视频", label: "课程视频" },
  { value: "课程体系", label: "课程体系" },
  { value: "课程结构", label: "课程结构" },
  { value: "课程地图", label: "课程地图" },
] as const;

const extractArrayData = <T,>(result: unknown): T[] => {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (typeof result === "object" && result !== null && "success" in result && "data" in result) {
    const typedResult = result as { success?: boolean; data?: unknown };
    if (typedResult.success && typedResult.data) {
      if (Array.isArray(typedResult.data)) return typedResult.data as T[];
      if (
        typeof typedResult.data === "object" &&
        typedResult.data !== null &&
        "results" in typedResult.data &&
        Array.isArray((typedResult.data as { results?: unknown[] }).results)
      ) {
        return ((typedResult.data as { results?: unknown[] }).results || []) as T[];
      }
      if (
        typeof typedResult.data === "object" &&
        typedResult.data !== null &&
        "data" in typedResult.data &&
        Array.isArray((typedResult.data as { data?: unknown[] }).data)
      ) {
        return ((typedResult.data as { data?: unknown[] }).data || []) as T[];
      }
    }
  }
  return [];
};

const getHeaders = (user: unknown): Record<string, string> =>
  getAuthHeaders(user) as Record<string, string>;

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeError = error as { errors?: Array<{ message?: string }>; message?: string };
    if (maybeError.errors?.[0]?.message) return maybeError.errors[0].message || fallback;
    if (maybeError.message) return maybeError.message;
  }
  return fallback;
};

export default function CourseVideoManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { canEdit } = useEditPermission();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUploadFile, setEditUploadFile] = useState<File | null>(null);
  const [isEditUploading, setIsEditUploading] = useState(false);
  const [selectedCourseVideo, setSelectedCourseVideo] =
    useState<CourseVideoResourceSchema | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("0");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);

  /**
   * 共享上传逻辑：将文件上传到 OSS（失败时回退到服务器上传），返回可访问的 URL。
   */
  const performFileUpload = async (
    file: File,
    mediaType: "video" | "image",
  ): Promise<string> => {
    let ossResult: { url: string; name: string };
    try {
      setUploadStatus("正在获取上传凭证...");
      const stsResponse = await getSTSToken(file.name, file.size, file.type);
      if (!stsResponse.success)
        throw new Error(stsResponse.error || "获取上传凭证失败");
      setUploadStatus(
        mediaType === "video" ? "正在上传视频到OSS..." : "正在上传图片到OSS...",
      );
      ossResult = await uploadFileToOSS(stsResponse, {
        file,
        onProgress: (progress: UploadProgress) => {
          setUploadProgress(Math.min(progress.percent, 90));
          setUploadStatus(`上传进度: ${progress.percent}%`);
        },
      });
    } catch (ossError) {
      console.warn("OSS upload failed, using server upload:", ossError);
      setUploadStatus("正在通过服务器上传...");
      setUploadProgress(25);
      ossResult = await uploadFileViaServer(file, {
        onProgress: (progress: UploadProgress) => {
          setUploadProgress(
            Math.min(25 + Math.floor(progress.percent * 0.65), 90),
          );
        },
      });
    }
    return ossResult.url;
  };
  const [formData, setFormData] = useState<CourseVideoFormData>({
    name: "课程视频",
    mediaType: "video",
    courseId: "",
    videoUrl: "",
    imageUrl: null,
  });

  const tenant = currentTenant?.schemaName || "";

  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });
  const courses = useMemo(() => coursesData || [], [coursesData]);
  const activeCourseId = selectedCourseId ?? courses[0]?.id ?? "";

  const {
    data: courseVideosData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["courseVideos", tenant, activeCourseId],
    queryFn: async () => {
      const result = await listCourseVideos({
        tenant,
        fields: [
          "id",
          "name",
          "mediaType",
          "videoUrl",
          "imageUrl",
          "courseId",
          { course: ["id", "title"] },
        ],
        ...(activeCourseId && {
          filter: { courseId: { eq: activeCourseId } },
        }),
        headers: getHeaders(user),
      });
      if (result.success && result.data) return result.data;
      throw new Error("Failed to fetch course videos");
    },
    enabled: !!tenant && !!user && !!activeCourseId,
  });

  // Upload video mutation
  const uploadVideoMutation = useMutation({
    mutationFn: async (data: {
      file: File;
      name: CourseVideoFormData["name"];
      mediaType: CourseVideoFormData["mediaType"];
      courseId: string;
    }) => {
      if (!data.name || !data.courseId)
        throw new Error("请填写名称和选择课程");
      setIsUploading(true);
      setUploadProgress(0);
      setUploadStatus("正在准备上传...");

      try {
        const fileUrl = await performFileUpload(data.file, data.mediaType);

        setUploadStatus("正在创建记录...");
        setUploadProgress(95);

        if (data.mediaType === "video") {
          const thumbnailUrl = `${fileUrl}?x-oss-process=video/snapshot,t_7000,f_jpg,w_800,h_600,m_fast`;
          const createResult = await createCourseVideo({
            tenant,
            input: {
              name: data.name,
              mediaType: "video",
              videoUrl: fileUrl,
              imageUrl: thumbnailUrl,
              courseId: data.courseId,
            },
            fields: ["id", "name", "mediaType", "videoUrl", "imageUrl", "courseId"],
            headers: getHeaders(user),
          });
          if (!createResult.success) {
            throw new Error(
              getErrorMessage(createResult, "创建课程视频记录失败"),
            );
          }
          setUploadProgress(100);
          setUploadStatus("课程视频上传完成!");
          return createResult;
        } else {
          // Image type
          const createResult = await createCourseVideo({
            tenant,
            input: {
              name: data.name,
              mediaType: "image",
              videoUrl: null,
              imageUrl: fileUrl,
              courseId: data.courseId,
            },
            fields: ["id", "name", "mediaType", "videoUrl", "imageUrl", "courseId"],
            headers: getHeaders(user),
          });
          if (!createResult.success) {
            throw new Error(
              getErrorMessage(createResult, "创建课程图片记录失败"),
            );
          }
          setUploadProgress(100);
          setUploadStatus("课程图片上传完成!");
          return createResult;
        }
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseVideos", tenant] });
      setTimeout(() => {
        setCreateDialogOpen(false);
        resetForm();
      }, 1000);
    },
    onError: (error: unknown) => {
      const rawMessage = getErrorMessage(error, "");
      let errorMessage = "上传失败";

      if (rawMessage.includes("has already been taken")) {
        errorMessage = "该文件已存在，请勿重复上传";
      } else if (rawMessage) {
        errorMessage = rawMessage;
      }

      setUploadStatus(`错误: ${errorMessage}`);
    },
  });

  const updateCourseVideoMutation = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: CourseVideoFormData & { id: string }) => {
      const result = await updateCourseVideo({
        tenant,
        primaryKey: id,
        fields: ["id", "name", "mediaType", "videoUrl", "imageUrl", "courseId"],
        input,
        headers: getHeaders(user),
      });
      if (result.success) return result.data;
      throw new Error("Failed to update course video");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseVideos", tenant] });
      message.success("更新成功");
      setEditDialogOpen(false);
      resetForm();
    },
    onError: () => message.error("更新失败"),
  });

  const deleteCourseVideoMutation = useMutation({
    mutationFn: async (courseVideoId: string) => {
      const result = await deleteCourseVideo({
        tenant,
        primaryKey: courseVideoId,
        headers: getHeaders(user),
      });
      if (result.success) return result.data;
      throw new Error("Failed to delete course video");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courseVideos", tenant] });
      message.success("删除成功");
    },
    onError: () => message.error("删除失败"),
  });

  const courseVideos = useMemo(
    () =>
      Array.isArray(courseVideosData)
        ? courseVideosData
        : extractArrayData<CourseVideoResourceSchema>(courseVideosData),
    [courseVideosData],
  );

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Alert message="请先登录" type="warning" showIcon />
        <Button type="primary" href="/login" style={{ marginTop: 16 }}>
          登录
        </Button>
      </div>
    );
  }

  if (!currentTenant?.schemaName) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="未选择租户"
          description="请先选择一个组织"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      name: "课程视频",
      mediaType: "video",
      courseId: "",
      videoUrl: "",
      imageUrl: null,
    });
    setUploadFile(null);
    setUploadStatus("");
    setUploadProgress(0);
    setIsUploading(false);
  };

  const handleFileUpload = () => {
    if (!uploadFile || !formData.courseId || !formData.name) {
      setUploadStatus("请填写名称、选择课程和文件");
      return;
    }
    uploadVideoMutation.mutate({
      file: uploadFile,
      name: formData.name,
      mediaType: formData.mediaType,
      courseId: formData.courseId,
    });
  };

  const handleEditUpload = async () => {
    if (!editUploadFile || !formData.mediaType) return;
    setIsEditUploading(true);
    setUploadProgress(0);
    setUploadStatus("正在准备上传...");
    try {
      const fileUrl = await performFileUpload(
        editUploadFile,
        formData.mediaType,
      );
      if (formData.mediaType === "video") {
        const thumbnailUrl = `${fileUrl}?x-oss-process=video/snapshot,t_7000,f_jpg,w_800,h_600,m_fast`;
        setFormData((prev) => ({
          ...prev,
          videoUrl: fileUrl,
          imageUrl: thumbnailUrl,
        }));
      } else {
        setFormData((prev) => ({
          ...prev,
          imageUrl: fileUrl,
          videoUrl: "",
        }));
      }
      message.success("文件已上传，点击确定保存");
      setEditUploadFile(null);
    } catch (e) {
      message.error(getErrorMessage(e, "上传失败"));
    } finally {
      setIsEditUploading(false);
      setUploadProgress(0);
      setUploadStatus("");
    }
  };

  const handleEditCourseVideo = (courseVideo: CourseVideoResourceSchema) => {
    setSelectedCourseVideo(courseVideo);
    setFormData({
      name: courseVideo.name,
      mediaType: courseVideo.mediaType || "video",
      courseId: courseVideo.courseId,
      videoUrl: courseVideo.videoUrl || "",
      imageUrl: courseVideo.imageUrl,
    });
    setEditDialogOpen(true);
  };

  const handlePreviewVideo = (courseVideo: CourseVideoResourceSchema) => {
    setSelectedCourseVideo(courseVideo);
    setPreviewDialogOpen(true);
  };

  const getCourseTitle = (course?: { title?: string } | null) =>
    course?.title || "未分配课程";

  const renderVideoActions = (courseVideo: CourseVideoResourceSchema) => (
    <div style={{ display: "flex", justifyContent: "center" }}>
      <Space size={2}>
        <Tooltip title="预览">
          <Button
            size="small"
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewVideo(courseVideo)}
          />
        </Tooltip>
        <Tooltip title="编辑">
          <ReadonlyActionButton
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={() => handleEditCourseVideo(courseVideo)}
          />
        </Tooltip>
        <Popconfirm
          title="确定删除?"
          onConfirm={() => deleteCourseVideoMutation.mutate(courseVideo.id)}
        >
          <Tooltip title="删除">
            <ReadonlyActionButton
              size="small"
              type="text"
              danger
              icon={<DeleteOutlined />}
            />
          </Tooltip>
        </Popconfirm>
      </Space>
    </div>
  );

  const isVideo = (cv: CourseVideoResourceSchema) => (cv.mediaType || "video") === "video";
  const isImage = (cv: CourseVideoResourceSchema) => cv.mediaType === "image";

  // Card component
  const renderCourseVideoCard = (courseVideo: CourseVideoResourceSchema) => {
    const isImg = isImage(courseVideo);
    return (
      <Col xs={24} sm={12} lg={8} xl={6} key={courseVideo.id}>
        <Card
          hoverable
          style={{
            borderRadius: 12,
            overflow: "hidden",
            border: "1px solid #f0f0f0",
          }}
          styles={{ body: { padding: 12 } }}
          cover={
            <div
              style={{
                position: "relative",
                width: "100%",
                paddingTop: "56.25%",
                cursor: "pointer",
              }}
              onClick={() => handlePreviewVideo(courseVideo)}
            >
              {courseVideo.imageUrl ? (
                <img
                  src={courseVideo.imageUrl}
                  alt={courseVideo.name}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background: isImg
                      ? "linear-gradient(135deg, #13c2c2 0%, #08979c 100%)"
                      : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isImg ? (
                    <PictureOutlined style={{ fontSize: 40, color: "white" }} />
                  ) : (
                    <PlayCircleOutlined style={{ fontSize: 40, color: "white" }} />
                  )}
                </div>
              )}
              <Tag
                color={isImg ? "cyan" : "purple"}
                style={{ position: "absolute", top: 8, left: 8, margin: 0 }}
              >
                {isImg ? "图片" : "视频"}
              </Tag>
              <Tag
                color="blue"
                style={{ position: "absolute", top: 8, right: 8, margin: 0 }}
              >
                {courseVideo.name}
              </Tag>
            </div>
          }
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text ellipsis style={{ flex: 1, marginRight: 8 }}>
              {getCourseTitle(courseVideo.course)}
            </Text>
            {renderVideoActions(courseVideo)}
          </div>
        </Card>
      </Col>
    );
  };

  // Table columns
  const tableColumns = [
    {
      title: "预览",
      dataIndex: "imageUrl",
      key: "imageUrl",
      width: 96,
      align: "center" as const,
      onCell: () => ({ style: { verticalAlign: "middle" as const } }),
      render: (imageUrl: string, record: CourseVideoResourceSchema) => {
        const isImg = isImage(record);
        return imageUrl ? (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <img
              src={imageUrl}
              alt={record.name}
              style={{
                width: 72,
                height: 40,
                objectFit: "cover",
                borderRadius: 6,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              }}
            />
          </div>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <div
              style={{
                width: 72,
                height: 40,
                background: isImg
                  ? "linear-gradient(135deg, #13c2c2 0%, #08979c 100%)"
                  : "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {isImg ? (
                <PictureOutlined style={{ fontSize: 18, color: "white" }} />
              ) : (
                <PlayCircleOutlined style={{ fontSize: 18, color: "white" }} />
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: "类型",
      key: "mediaType",
      width: 80,
      align: "center" as const,
      onCell: () => ({ style: { verticalAlign: "middle" as const } }),
      render: (_: unknown, record: CourseVideoResourceSchema) => (
        <Tag color={isImage(record) ? "cyan" : "purple"}>
          {isImage(record) ? "图片" : "视频"}
        </Tag>
      ),
    },
    {
      title: "所属课程",
      dataIndex: "course",
      key: "course",
      onCell: () => ({ style: { verticalAlign: "middle" as const } }),
      render: (course?: { title?: string } | null, record: CourseVideoResourceSchema) => (
        <Space wrap size={4}>
          <Text ellipsis={{ tooltip: course?.title }} style={{ maxWidth: 200 }}>
            {course?.title || "未分配"}
          </Text>
          <Tag color="blue" style={{ marginInlineEnd: 0 }}>{record.name}</Tag>
        </Space>
      ),
    },
    {
      title: "操作",
      key: "action",
      width: 100,
      align: "center" as const,
      onCell: () => ({ style: { verticalAlign: "middle" as const } }),
      render: (_: unknown, record: CourseVideoResourceSchema) => renderVideoActions(record),
    },
  ];

  // Tab items
  const tabItems = [
    {
      key: "0",
      label: "卡片视图",
      children: (
        <div>
          <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateDialogOpen(true)}
                style={canEdit ? undefined : { display: "none" }}
              >
                上传媒体
              </Button>
            </Space>
          </div>
          {courseVideos.length > 0 ? (
            <Row gutter={[16, 16]}>{courseVideos.map(renderCourseVideoCard)}</Row>
          ) : (
            <Empty description={activeCourseId ? "暂无课程媒体" : "请先选择一个课程"} />
          )}
        </div>
      ),
    },
    {
      key: "1",
      label: "表格视图",
      children: (
        <Table
          className="theme-table"
          columns={tableColumns}
          dataSource={courseVideos}
          rowKey="id"
          title={() => (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateDialogOpen(true)}
                >
                  上传媒体
                </Button>
              </Space>
            </div>
          )}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
          }}
          locale={{
            emptyText: activeCourseId ? "暂无课程媒体" : "请先选择一个课程",
          }}
          size="middle"
        />
      ),
    },
  ];

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
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
        />
        <PlayCircleOutlined style={{ fontSize: 24, color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>
          课程媒体管理
        </Title>
        <Tag color="blue" style={{ marginLeft: 8 }}>支持视频与图片</Tag>
      </div>

      {/* 课程选择 */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Space>
          <Text strong>选择课程：</Text>
          {coursesLoading ? (
            <Spin size="small" />
          ) : (
            <Select
              value={selectedCourseId === "" ? undefined : activeCourseId || undefined}
              onChange={(value) => setSelectedCourseId(value)}
              placeholder="请选择课程"
              style={{ width: 280 }}
              allowClear
            >
              {courses.map((course: CourseResourceSchema) => (
                <Option key={course.id} value={course.id}>
                  {course.title}
                </Option>
              ))}
            </Select>
          )}
        </Space>
      </div>

      <Tabs activeKey={currentTab} onChange={setCurrentTab} items={tabItems} />

      {isLoading && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Spin size="large" />
        </div>
      )}
      {error && (
        <div style={{ textAlign: "center", padding: 24 }}>
          <Text type="danger">加载失败</Text>
        </div>
      )}

      {/* Create Dialog */}
      <Modal
        open={createDialogOpen}
        onCancel={() => { setCreateDialogOpen(false); resetForm(); }}
        title="上传课程媒体"
        width={600}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            媒体类型
          </Text>
          <Select
            value={formData.mediaType}
            onChange={(v) => {
              setFormData({ ...formData, mediaType: v });
              setUploadFile(null);
              setUploadStatus("");
            }}
            style={{ width: "100%" }}
          >
            <Option value="video">
              <Space><VideoCameraOutlined /> 视频</Space>
            </Option>
            <Option value="image">
              <Space><PictureOutlined /> 图片</Space>
            </Option>
          </Select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            分类名称
          </Text>
          <Select
            value={formData.name}
            onChange={(v) => setFormData({ ...formData, name: v })}
            style={{ width: "100%" }}
          >
            {courseVideoTypes.map((t) => (
              <Option key={t.value} value={t.value}>
                {t.label}
              </Option>
            ))}
          </Select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            所属课程 *
          </Text>
          <Select
            value={formData.courseId || undefined}
            onChange={(v) => setFormData({ ...formData, courseId: v || "" })}
            style={{ width: "100%" }}
            placeholder="请选择课程"
            loading={coursesLoading}
          >
            {courses.map((c: CourseResourceSchema) => (
              <Option key={c.id} value={c.id}>
                {c.title}
              </Option>
            ))}
          </Select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            {formData.mediaType === "video" ? "上传视频文件" : "上传图片文件"}:
          </Text>
          {uploadStatus && (
            <Alert
              message={uploadStatus}
              type={uploadStatus.includes("错误") ? "error" : "info"}
              style={{ marginBottom: 12 }}
              showIcon
            />
          )}
          <input
            type="file"
            accept={formData.mediaType === "video" ? "video/*" : "image/*"}
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            style={{ marginBottom: 8 }}
          />
          {uploadFile && (
            <Text type="secondary">已选择: {uploadFile.name}</Text>
          )}
          {/* Image preview */}
          {formData.mediaType === "image" && uploadFile && (
            <div style={{ marginTop: 8, borderRadius: 8, overflow: "hidden", maxWidth: 300 }}>
              <img
                src={URL.createObjectURL(uploadFile)}
                alt="预览"
                style={{ width: "100%", display: "block", borderRadius: 8 }}
              />
            </div>
          )}
          {isUploading && (
            <Progress
              percent={uploadProgress}
              strokeColor="#1890ff"
              style={{ marginTop: 12 }}
            />
          )}
          <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
            <Button
              type="primary"
              onClick={handleFileUpload}
              disabled={
                !uploadFile ||
                !formData.courseId ||
                !formData.name ||
                isUploading
              }
            >
              {isUploading ? "上传中..." : formData.mediaType === "video" ? "上传视频" : "上传图片"}
            </Button>
            <Button
              onClick={() => { setCreateDialogOpen(false); resetForm(); }}
              disabled={isUploading}
            >
              取消
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Dialog */}
      <Modal
        open={editDialogOpen}
        onCancel={() => {
          setEditDialogOpen(false);
          setEditUploadFile(null);
          setUploadStatus("");
        }}
        title="编辑课程媒体"
        width={600}
        onOk={() => {
          if (selectedCourseVideo)
            updateCourseVideoMutation.mutate({
              id: selectedCourseVideo.id,
              ...formData,
            });
        }}
        confirmLoading={updateCourseVideoMutation.isPending}
      >
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            媒体类型
          </Text>
          <Select
            value={formData.mediaType}
            onChange={(v) => setFormData({ ...formData, mediaType: v })}
            style={{ width: "100%" }}
          >
            <Option value="video">
              <Space><VideoCameraOutlined /> 视频</Space>
            </Option>
            <Option value="image">
              <Space><PictureOutlined /> 图片</Space>
            </Option>
          </Select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            分类名称
          </Text>
          <Select
            value={formData.name}
            onChange={(v) => setFormData({ ...formData, name: v })}
            style={{ width: "100%" }}
          >
            {courseVideoTypes.map((t) => (
              <Option key={t.value} value={t.value}>
                {t.label}
              </Option>
            ))}
          </Select>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            当前{formData.mediaType === "video" ? "视频" : "图片"}预览
          </Text>
          {formData.imageUrl ? (
            <div
              style={{
                borderRadius: 8,
                overflow: "hidden",
                maxWidth: 300,
              }}
            >
              <img
                src={formData.imageUrl}
                alt="预览"
                style={{ width: "100%", display: "block", borderRadius: 8 }}
              />
            </div>
          ) : (
            <Text type="secondary">暂无预览（上传文件后生成）</Text>
          )}
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            替换{formData.mediaType === "video" ? "视频" : "图片"}文件
          </Text>
          {uploadStatus && (
            <Alert
              message={uploadStatus}
              type={uploadStatus.includes("错误") ? "error" : "info"}
              style={{ marginBottom: 12 }}
              showIcon
            />
          )}
          <input
            type="file"
            accept={
              formData.mediaType === "video" ? "video/*" : "image/*"
            }
            onChange={(e) => setEditUploadFile(e.target.files?.[0] || null)}
            style={{ marginBottom: 8 }}
            disabled={isEditUploading}
          />
          {editUploadFile && (
            <Text type="secondary">
              已选择: {editUploadFile.name}
            </Text>
          )}
          {/* 新上传文件预览 */}
          {editUploadFile && formData.mediaType === "image" && (
            <div
              style={{
                marginTop: 8,
                borderRadius: 8,
                overflow: "hidden",
                maxWidth: 300,
              }}
            >
              <img
                src={URL.createObjectURL(editUploadFile)}
                alt="预览"
                style={{ width: "100%", display: "block", borderRadius: 8 }}
              />
            </div>
          )}
          {isEditUploading && (
            <Progress
              percent={uploadProgress}
              strokeColor="#1890ff"
              style={{ marginTop: 8 }}
            />
          )}
          <Button
            type="primary"
            icon={<UploadOutlined />}
            onClick={handleEditUpload}
            disabled={!editUploadFile || isEditUploading}
            style={{ marginTop: 8 }}
          >
            {isEditUploading ? "上传中..." : "上传并替换文件"}
          </Button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong style={{ marginBottom: 8, display: "block" }}>
            所属课程
          </Text>
          <Select
            value={formData.courseId || undefined}
            onChange={(v) => setFormData({ ...formData, courseId: v || "" })}
            style={{ width: "100%" }}
          >
            {courses.map((c: CourseResourceSchema) => (
              <Option key={c.id} value={c.id}>
                {c.title}
              </Option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* Preview Dialog */}
      <Modal
        open={previewDialogOpen}
        onCancel={() => setPreviewDialogOpen(false)}
        title={`预览: ${selectedCourseVideo?.name}`}
        width={800}
        footer={
          <Button onClick={() => setPreviewDialogOpen(false)}>关闭</Button>
        }
      >
        {selectedCourseVideo && (
          <div>
            {isImage(selectedCourseVideo) ? (
              // Image preview
              <div style={{ textAlign: "center" }}>
                {selectedCourseVideo.imageUrl && (
                  <img
                    src={selectedCourseVideo.imageUrl}
                    alt={selectedCourseVideo.name}
                    style={{
                      maxWidth: "100%",
                      maxHeight: "70vh",
                      borderRadius: 8,
                      objectFit: "contain",
                    }}
                  />
                )}
              </div>
            ) : (
              // Video preview
              <video
                controls
                style={{ width: "100%", borderRadius: 8 }}
                preload="metadata"
              >
                <source src={selectedCourseVideo.videoUrl || undefined} type="video/mp4" />
              </video>
            )}
            <div style={{ marginTop: 16, display: "flex", gap: 24 }}>
              <Text type="secondary">
                <strong>类型:</strong>{" "}
                <Tag color={isImage(selectedCourseVideo) ? "cyan" : "purple"}>
                  {isImage(selectedCourseVideo) ? "图片" : "视频"}
                </Tag>
              </Text>
              <Text type="secondary">
                <strong>分类:</strong> {selectedCourseVideo.name}
              </Text>
              <Text type="secondary">
                <strong>课程:</strong>{" "}
                {getCourseTitle(selectedCourseVideo.course)}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
