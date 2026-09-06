import { useNavigate } from "react-router-dom";
import React, { useState, useRef } from "react";
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
  Spin,
  Alert,
  Tabs,
  Table,
  Progress,
  Space,
  Empty,
  Popconfirm,
  message,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  EyeOutlined,
  FolderOutlined,
  CheckOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  listVideos,
  getVideosByCourseIds,
  createVideo,
  updateVideo,
  deleteVideo,
  listChapters,
} from "@/lib/ash_rpc";
import {
  getSTSToken,
  uploadFileToOSS,
  uploadFileViaServer,
  getVideoDuration,
} from "@/lib/oss-upload";
import type { UploadProgress } from "@/lib/oss-upload";
import { useAuth } from "@/auth/auth-context";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useCourses } from "@/hooks/use-courses";
import type {
  VideoResourceSchema,
} from "@/lib/ash_rpc";

const { Title, Text } = Typography;

// 根据 path 生成显示编号（同章节管理页面逻辑）
const generateChapterNumber = (path: string | null): string => {
  if (!path) return "";
  const numbers: string[] = [];
  for (let i = path.length; i >= 4; i -= 4) {
    const segment = path.slice(Math.max(0, i - 4), i);
    const num = path.length === 4 ? segment.charAt(2) : segment.slice(-1);
    if (num && num !== "0") {
      numbers.unshift(num);
    }
  }
  return numbers.join(".");
};

interface VideoFormData {
  title: string;
  courseId?: string | null;
  chapterId?: string | null;
  knowledgeResourceId?: string | null;
}

export default function VideoManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const { canEdit } = useEditPermission();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] =
    useState<VideoResourceSchema | null>(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState("0");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadAbortController, setUploadAbortController] =
    useState<AbortController | null>(null);
  const isUploadCancelledRef = useRef(false);
  const [isUploadCancelled, setIsUploadCancelled] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");
  const [chapterSearchText, setChapterSearchText] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<VideoFormData>({
    title: "",
    courseId: null,
    chapterId: null,
    knowledgeResourceId: null,
  });

  const {
    data: videosData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["videos", currentTenant?.schemaName, selectedCourseId],
    queryFn: async () => {
      if (selectedCourseId) {
        const result = await getVideosByCourseIds({
          tenant: currentTenant?.schemaName || "",
          input: { courseIds: [selectedCourseId] },
          fields: [
            "id",
            "title",
            "assetId",
            "playbackId",
            "duration",
            "thumbnail",
            "chapterId",
            "knowledgeResourceId",
            { chapter: ["id", "title"] },
            { knowledgeResource: ["id", "name"] },
          ],
          headers: getAuthHeaders(user) as Record<string, string>,
        });
        if (result.success && result.data) {
          return result.data;
        }
        throw new Error("Failed to fetch videos for course");
      } else {
        const result = await listVideos({
          tenant: currentTenant?.schemaName || "",
          fields: [
            "id",
            "title",
            "assetId",
            "playbackId",
            "duration",
            "thumbnail",
            "chapterId",
            "knowledgeResourceId",
            { chapter: ["id", "title"] },
            { knowledgeResource: ["id", "name"] },
          ],
        });
        if (result.success && result.data) {
          return result.data;
        }
        throw new Error("Failed to fetch videos");
      }
    },
    enabled: !!currentTenant?.schemaName && !!user,
  });

  // 使用统一的课程获取 hook
  const { courses: coursesData, loading: coursesLoading } = useCourses({
    fields: ["id", "title"],
  });

  // 新建/编辑弹窗中使用的课程ID（新建时从formData取，编辑时用当前已选课程）
  const dialogCourseId = formData.courseId || selectedCourseId;

  const { data: chaptersData = [] } = useQuery({
    queryKey: ["chapters", currentTenant?.schemaName, dialogCourseId],
    queryFn: async () => {
      const result = await listChapters({
        tenant: currentTenant?.schemaName || "",
        fields: [
          "id",
          "title",
          "path",
          "parentChapterId",
          {
            subchapters: [
              "id",
              "title",
              "path",
              "parentChapterId",
              {
                subchapters: [
                  "id",
                  "title",
                  "path",
                  "parentChapterId",
                  {
                    subchapters: [
                      "id",
                      "title",
                      "path",
                      "parentChapterId",
                    ],
                  },
                ],
              },
            ],
          },
        ],
        ...(dialogCourseId && {
          filter: {
            course: {
              id: { eq: dialogCourseId },
            },
          },
        }),
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      return extractArrayData(result);
    },
    enabled: !!currentTenant?.schemaName && !!user,
  });

  const handleVideoUpload = async (data: {
    file: File;
    title: string;
    chapterId?: string | null;
    knowledgeResourceId?: string | null;
  }) => {
    if (!data.title) {
      throw new Error("请填写视频标题");
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("正在准备上传...");

    const abortController = new AbortController();
    setUploadAbortController(abortController);

    try {
      let ossResult: { url: string; name: string };

      setUploadStatus("正在获取视频时长...");
      let duration: number | null = null;
      try {
        console.log("Starting duration extraction for file:", data.file.name);
        duration = await getVideoDuration(data.file);
        console.log(
          "Video duration extracted successfully:",
          duration,
          "seconds",
        );
        setUploadStatus(
          `视频时长: ${Math.floor(duration / 60)}:${Math.floor(duration % 60)
            .toString()
            .padStart(2, "0")}`,
        );
      } catch (durationError) {
        console.error("Failed to extract video duration:", durationError);
      }

      try {
        if (isUploadCancelledRef.current) {
          throw new Error('UPLOAD_CANCELLED');
        }

        setUploadStatus("正在获取上传凭证...");
        const stsResponse = await getSTSToken(
          data.file.name,
          data.file.size,
          data.file.type,
        );

        if (!stsResponse.success) {
          throw new Error(stsResponse.error || "获取上传凭证失败");
        }

        setUploadStatus("正在上传视频到OSS...");
        ossResult = await uploadFileToOSS(stsResponse, {
          file: data.file,
          onProgress: (progress: UploadProgress) => {
            setUploadProgress(Math.min(progress.percent, 90));
            setUploadStatus(
              `上传进度: ${progress.percent}% (${Math.round(
                progress.loaded / 1024 / 1024,
              )}MB / ${Math.round(progress.total / 1024 / 1024)}MB)`,
            );
          },
          signal: abortController.signal,
        });

        console.log("Direct OSS upload successful:", ossResult);
      } catch (ossError) {
        console.warn(
          "Direct OSS upload failed, falling back to server upload:",
          ossError,
        );

        setUploadStatus("正在通过服务器上传...");
        setUploadProgress(25);
        ossResult = await uploadFileViaServer(data.file, {
          onProgress: (progress: UploadProgress) => {
            setUploadProgress(
              Math.min(25 + Math.floor(progress.percent * 0.65), 90),
            );
            setUploadStatus(
              `上传进度: ${Math.min(
                25 + Math.floor(progress.percent * 0.65),
                90,
              )}% (服务器上传)`,
            );
          },
          signal: abortController.signal,
        });

        console.log("Server upload successful:", ossResult);
      }

      if (isUploadCancelledRef.current) {
        throw new Error('UPLOAD_CANCELLED');
      }

      setUploadStatus("正在创建视频记录...");
      setUploadProgress(95);

      const playbackUrl = ossResult.url;
      const thumbnailUrl = `${playbackUrl}?x-oss-process=video/snapshot,t_7000,f_jpg,w_1280,h_720,m_fast`;

      const videoInput = {
        title: data.title,
        assetId: playbackUrl,
        playbackId: playbackUrl,
        duration: duration,
        thumbnail: thumbnailUrl,
        uploadId: null,
        chapterId: data.chapterId || null,
        knowledgeResourceId: data.knowledgeResourceId || null,
      };

      console.log("Creating video with input:", videoInput);

      const createVideoResult = await createVideo({
        tenant: currentTenant?.schemaName || "",
        input: videoInput,
        fields: [
          "id",
          "title",
          "assetId",
          "playbackId",
          "duration",
          "thumbnail",
          "chapterId",
          "knowledgeResourceId",
          { chapter: ["id", "title"] },
          { knowledgeResource: ["id", "name"] },
        ],
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      console.log("Create video result:", createVideoResult);

      if (!createVideoResult.success) {
        const errorMsg =
          (createVideoResult as any).errors?.[0]?.message || "创建视频记录失败";
        throw new Error(errorMsg);
      }

      setUploadProgress(100);
      setUploadStatus("视频上传完成!");
      return createVideoResult;
    } catch (error: any) {
      // 如果是用户取消的上传，抛出一个特殊的错误
      if (error?.name === 'AbortError' || error?.message?.includes('cancelled') || error?.message?.includes('aborted')) {
        throw new Error('UPLOAD_CANCELLED');
      }
      throw error;
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadAbortController(null);
    }
  };

  const uploadVideoMutation = useMutation({
    mutationFn: handleVideoUpload,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["videos", currentTenant?.schemaName],
      });
      setUploadStatus("视频上传完成!");
      message.success("视频上传成功!");
      setTimeout(() => {
        setCreateDialogOpen(false);
        resetForm();
      }, 1000);
    },
    onError: (error: any) => {
      // 如果是用户取消的上传，不显示错误消息
      if (error?.message === 'UPLOAD_CANCELLED' || isUploadCancelled) {
        setUploadStatus("上传已取消");
        message.info("上传已取消");
        setIsUploadCancelled(false);
        return;
      }

      let errorMessage = "视频上传失败";
      const rawMessage = error?.errors?.[0]?.message || error?.message || "";

      if (rawMessage.includes("has already been taken")) {
        errorMessage = "该视频文件已存在，请勿重复上传相同的视频";
      } else if (rawMessage.includes("Invalid value")) {
        const match = rawMessage.match(/Invalid value provided for (\w+):/);
        if (match) {
          const fieldName = match[1];
          errorMessage = `视频${fieldName}无效`;
        }
      } else if (rawMessage) {
        errorMessage = rawMessage;
      }

      setUploadStatus(`错误: ${errorMessage}`);
      message.error(errorMessage);
      console.error("Failed to upload video:", error);
    },
  });

  const handleFileUpload = async () => {
    if (
      !uploadFile ||
      !formData.courseId ||
      !formData.chapterId ||
      !formData.title
    ) {
      setUploadStatus("请填写视频标题、选择课程、章节和视频文件");
      return;
    }

    isUploadCancelledRef.current = false;
    setUploadStatus("正在上传视频...");
    uploadVideoMutation.mutate({
      file: uploadFile,
      title: formData.title,
      chapterId: formData.chapterId,
      knowledgeResourceId: formData.knowledgeResourceId,
    });
  };

  const updateVideoMutation = useMutation({
    mutationFn: async ({
      id,
      title,
      chapterId,
      knowledgeResourceId,
    }: {
      id: string;
      title: string;
      chapterId?: string | null;
      knowledgeResourceId?: string | null;
    }) => {
      const result = await updateVideo({
        tenant: currentTenant?.schemaName || "",
        primaryKey: id,
        fields: [
          "id",
          "title",
          "assetId",
          "playbackId",
          "duration",
          "chapterId",
          "knowledgeResourceId",
          { chapter: ["id", "title"] },
          { knowledgeResource: ["id", "name"] },
        ],
        input: {
          title,
          chapterId: chapterId || null,
          knowledgeResourceId: knowledgeResourceId || null,
        } as any,
      });
      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to update video");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["videos", currentTenant?.schemaName],
      });
      setEditDialogOpen(false);
      resetForm();
      message.success("视频更新成功!");
    },
    onError: (error) => {
      console.error("Failed to update video:", error);
      message.error("更新视频失败");
    },
  });

  const deleteVideoMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const result = await deleteVideo({
        tenant: currentTenant?.schemaName || "",
        primaryKey: videoId,
      });
      if (result.success) {
        return result.data;
      }
      throw new Error("Failed to delete video");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["videos", currentTenant?.schemaName],
      });
      message.success("视频删除成功!");
    },
    onError: (error) => {
      console.error("Failed to delete video:", error);
      message.error("删除视频失败");
    },
  });

  const videos = extractArrayData(videosData).filter((video: VideoResourceSchema) =>
    !searchText || video.title?.toLowerCase().includes(searchText.toLowerCase())
  );
  const chapters = extractArrayData(chaptersData);
  const courses = extractArrayData(coursesData);

  // 递归过滤章节树（按搜索文本）
  const filterChapterTree = (list: any[], keyword: string): any[] => {
    if (!keyword) return list;
    return list
      .map((item) => {
        const children = filterChapterTree(item.subchapters || [], keyword);
        const titleMatch = item.title?.toLowerCase().includes(keyword.toLowerCase());
        const numberMatch = generateChapterNumber(item.path).includes(keyword);
        if (titleMatch || numberMatch || children.length > 0) {
          return { ...item, subchapters: children };
        }
        return null;
      })
      .filter(Boolean) as any[];
  };

  const filteredChapters = filterChapterTree(chapters, chapterSearchText);

  // 章节选择表格的列定义
  const chapterTableColumns: ColumnsType<any> = [
    {
      title: "章节标题",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: any) => {
        const children = record.subchapters || [];
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8, maxWidth: "100%" }}>
            <Tag color="blue" style={{ flexShrink: 0 }}>{generateChapterNumber(record.path)}</Tag>
            <FolderOutlined style={{ color: "#1890ff", flexShrink: 0 }} />
            <Tooltip title={text} mouseEnterDelay={0.3}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{text}</span>
            </Tooltip>
            {children.length > 0 && (
              <Tag color="blue" style={{ flexShrink: 0 }}>{children.length} 个子章节</Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "",
      key: "action",
      width: 60,
      render: (_: any, record: any) => (
        <Button
          type={formData.chapterId === record.id ? "primary" : "default"}
          size="small"
          icon={formData.chapterId === record.id ? <CheckOutlined /> : undefined}
          onClick={() => setFormData({ ...formData, chapterId: record.id })}
        >
          {formData.chapterId === record.id ? "已选" : "选择"}
        </Button>
      ),
    },
  ];

  React.useEffect(() => {
    if (!selectedCourseId && courses.length > 0) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

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
        <Text style={{ marginBottom: 24 }}>请登录以访问视频管理。</Text>
        <Button type="primary" href="/auth/jwt/sign-in">
          登录
        </Button>
      </div>
    );
  }

  if (!currentTenant?.schemaName) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="warning"
          message={
            <div>
              <Title level={5} style={{ marginBottom: 8 }}>
                未选择租户或租户配置不完整
              </Title>
              <Text>
                请先选择一个租户（组织）才能管理视频资源。如果已选择租户但仍显示此消息，请联系管理员确保租户配置了正确的数据库模式。
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  const handleOpenCreateDialog = () => {
    setFormData({
      title: "",
      courseId: selectedCourseId || null,
      chapterId: null,
      knowledgeResourceId: null,
    });
    setUploadFile(null);
    setUploadStatus("");
    setCreateDialogOpen(true);
  };

  const handleCancel = () => {
    if (isUploading) {
      handleCancelUpload();
    }
    resetForm();
    setCreateDialogOpen(false);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      courseId: null,
      chapterId: null,
      knowledgeResourceId: null,
    });
    setUploadFile(null);
    setUploadStatus("");
    setUploadProgress(0);
    setIsUploading(false);
    setUploadAbortController(null);
    setIsUploadCancelled(false);
    isUploadCancelledRef.current = false;
    setChapterSearchText("");
  };

  const handleCancelUpload = () => {
    isUploadCancelledRef.current = true;
    if (uploadAbortController) {
      setIsUploadCancelled(true);
      uploadAbortController.abort();
      setUploadStatus("正在取消上传...");
    }
    setTimeout(() => {
      resetForm();
      setCreateDialogOpen(false);
    }, 500);
  };

  const handleEditVideo = (video: VideoResourceSchema) => {
    setSelectedVideo(video);
    setFormData({
      title: video.title || "",
      courseId: selectedCourseId || null,
      chapterId: video.chapterId || null,
      knowledgeResourceId: video.knowledgeResourceId || null,
    });
    setEditDialogOpen(true);
  };

  const handleUpdateVideo = () => {
    if (!selectedVideo) return;
    updateVideoMutation.mutate({ id: selectedVideo.id, ...formData });
  };

  const handleDeleteVideo = (videoId: string) => {
    deleteVideoMutation.mutate(videoId);
  };

  const handlePreviewVideo = (video: VideoResourceSchema) => {
    setSelectedVideo(video);
    setPreviewDialogOpen(true);
  };

  const handleCourseSelect = (courseId: string | undefined) => {
    setSelectedCourseId(courseId || "");
  };

  const tableColumns: ColumnsType<VideoResourceSchema> = [
    {
      title: "缩略图",
      dataIndex: "thumbnail",
      key: "thumbnail",
      width: 160,
      render: (thumbnail: string, record: VideoResourceSchema) =>
        thumbnail ? (
          <div
            style={{
              width: 140,
              height: 80,
              overflow: "hidden",
              borderRadius: 4,
              background: "#f5f5f5",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src={thumbnail}
              alt={record.title || ""}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              width: 140,
              height: 80,
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <PlayCircleOutlined style={{ fontSize: 24, color: "white" }} />
          </div>
        ),
    },
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (title: string) => <Tooltip title={title} mouseEnterDelay={0.3}><Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{title}</Text></Tooltip>,
    },
    {
      title: "时长",
      dataIndex: "duration",
      key: "duration",
      width: 80,
      render: (duration: number) =>
        duration
          ? `${Math.floor(duration / 60)}:${Math.round(duration % 60)
              .toString()
              .padStart(2, "0")}`
          : "-",
    },
    {
      title: "章节",
      dataIndex: "chapter",
      key: "chapter",
      render: (chapter: { title: string } | null) =>
        chapter ? <Tag color="blue">{chapter.title}</Tag> : "-",
    },
    {
      title: "知识资源",
      dataIndex: "knowledgeResource",
      key: "knowledgeResource",
      render: (resource: { name: string } | null) =>
        resource ? <Tag color="purple">{resource.name}</Tag> : "-",
    },
    {
      title: "操作",
      key: "action",
      width: 240,
      render: (_: any, record: VideoResourceSchema) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewVideo(record)}
          >
            预览
          </Button>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditVideo(record)}
            style={canEdit ? undefined : { display: "none" }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个视频吗?"
            onConfirm={() => handleDeleteVideo(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button size="small" danger icon={<DeleteOutlined />} style={canEdit ? undefined : { display: "none" }}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderVideoCard = (video: VideoResourceSchema) => (
    <Col xs={24} md={12} xl={6} key={video.id}>
      <Card
        hoverable
        style={{ height: "100%" }}
        styles={{
          body: { padding: 12 },
        }}
        cover={
          <div
            style={{
              position: "relative",
              width: "100%",
              height: 140,
              backgroundColor: "#000",
              overflow: "hidden",
            }}
          >
            {video.thumbnail ? (
              <img
                src={video.thumbnail}
                alt={video.title || ""}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background:
                    "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <PlayCircleOutlined
                  style={{ fontSize: 32, color: "white" }}
                />
              </div>
            )}
            {video.duration && (
              <div
                style={{
                  position: "absolute",
                  bottom: 8,
                  right: 8,
                  backgroundColor: "rgba(0, 0, 0, 0.8)",
                  color: "white",
                  padding: "2px 6px",
                  borderRadius: 3,
                  fontSize: "0.7rem",
                  fontWeight: 500,
                }}
              >
                {Math.floor(video.duration / 60)}:
                {Math.round(video.duration % 60)
                  .toString()
                  .padStart(2, "0")}
              </div>
            )}
          </div>
        }
        actions={[
          <Button
            key="preview"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handlePreviewVideo(video)}
          >
            预览
          </Button>,
          <ReadonlyActionButton
            key="edit"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditVideo(video)}
          >
            编辑
          </ReadonlyActionButton>,
          <Popconfirm
            key="delete"
            title="确定要删除这个视频吗?"
            onConfirm={() => handleDeleteVideo(video.id)}
            okText="确定"
            cancelText="取消"
          >
            <ReadonlyActionButton size="small" danger icon={<DeleteOutlined />}>
              删除
            </ReadonlyActionButton>
          </Popconfirm>,
        ]}
      >
        <Title
          level={5}
          ellipsis={{ rows: 2 }}
          style={{ marginBottom: 8, minHeight: 36 }}
        >
          {video.title}
        </Title>
        <Space wrap size={[4, 4]}>
          {(video as any).chapter && (
            <Tag color="blue" style={{ margin: 0 }}>{(video as any).chapter.title}</Tag>
          )}
          {(video as any).knowledgeResource && (
            <Tag color="purple" style={{ margin: 0 }}>
              {(video as any).knowledgeResource.name}
            </Tag>
          )}
        </Space>
      </Card>
    </Col>
  );

  const renderCreateDialog = () => (
    <Modal
      title={<Title level={4}>创建新视频</Title>}
      open={createDialogOpen}
      onCancel={() => setCreateDialogOpen(false)}
      footer={null}
      width={800}
    >
      <div style={{ paddingTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Text style={{ marginBottom: 8, display: "block" }}>视频标题 *</Text>
          <Input
            placeholder="请输入视频标题"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text style={{ marginBottom: 8, display: "block" }}>所属课程 *</Text>
          <Select
            style={{ width: "100%" }}
            placeholder="请选择课程"
            value={formData.courseId || undefined}
            onChange={(value) => {
              setFormData({
                ...formData,
                courseId: value || null,
                chapterId: null,
              });
              setChapterSearchText("");
            }}
            allowClear
            options={courses.map((course: any) => ({
              label: course.title,
              value: course.id,
            }))}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text>所属章节 *</Text>
            <Input.Search
              placeholder="搜索章节"
              allowClear
              size="small"
              style={{ width: 200 }}
              value={chapterSearchText}
              onChange={(e) => setChapterSearchText(e.target.value)}
            />
          </div>
          {!dialogCourseId ? (
            <Alert type="info" message="请先选择课程" />
          ) : filteredChapters.length === 0 ? (
            <Empty description="暂无章节数据" />
          ) : (
            <Table
              className="theme-table"
              columns={chapterTableColumns}
              dataSource={filteredChapters}
              rowKey="id"
              pagination={false}
              size="small"
              indentSize={24}
              childrenColumnName="subchapters"
              defaultExpandAllRows
              scroll={{ y: 300 }}
            />
          )}
        </div>

        <div style={{ marginBottom: 16 }}>
          <Text style={{ marginBottom: 8, display: "block" }}>
            上传视频文件:
          </Text>
          {uploadStatus && (
            <Alert
              type={uploadStatus.includes("错误") ? "error" : "info"}
              message={uploadStatus}
              style={{ marginBottom: 16 }}
            />
          )}

          <div style={{ marginBottom: 16 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setUploadFile(file);
                }
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />
            <Button onClick={() => fileInputRef.current?.click()}>选择视频文件</Button>
            {uploadFile && (
              <Text style={{ marginLeft: 16 }}>已选择: {uploadFile.name}</Text>
            )}
          </div>

          {isUploading && (
            <div style={{ marginBottom: 16 }}>
              <Text type="secondary">{uploadStatus}</Text>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <Progress percent={uploadProgress} />
                </div>
                <Button
                  size="small"
                  danger
                  onClick={handleCancelUpload}
                  disabled={!isUploading}
                >
                  取消
                </Button>
              </div>
            </div>
          )}

          <Space>
            <Button
              type="primary"
              onClick={handleFileUpload}
              disabled={
                !uploadFile ||
                !formData.courseId ||
                !formData.chapterId ||
                !formData.title ||
                isUploading ||
                uploadVideoMutation.isPending
              }
            >
              {isUploading || uploadVideoMutation.isPending
                ? "上传中..."
                : "上传视频"}
            </Button>
            <Button onClick={handleCancel} disabled={isUploading}>
              取消
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );

  const renderEditDialog = () => (
    <Modal
      title={<Title level={4}>编辑视频</Title>}
      open={editDialogOpen}
      onCancel={() => setEditDialogOpen(false)}
      footer={null}
      width={800}
    >
      <div style={{ paddingTop: 16 }}>
        <div style={{ marginBottom: 16 }}>
          <Text style={{ marginBottom: 8, display: "block" }}>视频标题</Text>
          <Input
            placeholder="请输入视频标题"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <Text>所属章节</Text>
            <Input.Search
              placeholder="搜索章节"
              allowClear
              size="small"
              style={{ width: 200 }}
              value={chapterSearchText}
              onChange={(e) => setChapterSearchText(e.target.value)}
            />
          </div>
          {filteredChapters.length === 0 ? (
            <Empty description="暂无章节数据" />
          ) : (
            <Table
              className="theme-table"
              columns={chapterTableColumns}
              dataSource={filteredChapters}
              rowKey="id"
              pagination={false}
              size="small"
              indentSize={24}
              childrenColumnName="subchapters"
              defaultExpandAllRows
              scroll={{ y: 300 }}
            />
          )}
        </div>

        <Space>
          <Button onClick={() => setEditDialogOpen(false)}>取消</Button>
          <Button
            type="primary"
            onClick={handleUpdateVideo}
            loading={updateVideoMutation.isPending}
          >
            更新
          </Button>
        </Space>
      </div>
    </Modal>
  );

  const renderPreviewDialog = () => (
    <Modal
      title={<Title level={4}>视频预览: {selectedVideo?.title}</Title>}
      open={previewDialogOpen}
      onCancel={() => setPreviewDialogOpen(false)}
      footer={
        <Button type="primary" onClick={() => setPreviewDialogOpen(false)}>
          关闭
        </Button>
      }
      width={800}
      destroyOnHidden
    >
      {selectedVideo && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <video
            controls
            style={{ width: "100%", aspectRatio: "16/9" }}
            preload="metadata"
          >
            <source src={selectedVideo.assetId} type="video/mp4" />
            您的浏览器不支持视频播放。
          </video>

          <div style={{ marginTop: 16 }}>
            <Title level={5}>视频信息</Title>
            <Row gutter={[12, 12]}>
              <Col span={12}>
                <Text type="secondary">
                  <strong>时长:</strong>{" "}
                  {selectedVideo.duration
                    ? `${Math.floor(selectedVideo.duration / 60)}:${Math.round(
                        selectedVideo.duration % 60,
                      )
                        .toString()
                        .padStart(2, "0")}`
                    : "-"}
                </Text>
              </Col>
              <Col span={12}>
                <Text type="secondary">
                  <strong>章节:</strong>{" "}
                  {(selectedVideo as any).chapter?.title || "无"}
                </Text>
              </Col>
              <Col span={24}>
                <Text type="secondary">
                  <strong>知识资源:</strong>{" "}
                  {(selectedVideo as any).knowledgeResource?.name || "无"}
                </Text>
              </Col>
            </Row>
          </div>
        </div>
      )}
    </Modal>
  );

  const tabItems = [
    { key: "0", label: "卡片视图" },
    { key: "1", label: "表格视图" },
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
        <PlayCircleOutlined style={{ fontSize: 24, color: "#1890ff" }} />
      <Button
                  className="teacher-page-back-btn"
                  type="text"
                  icon={<ArrowLeftOutlined />}
                  onClick={() => navigate("/teacher/dashboard")}
                  style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
                />
                          <Title level={4} style={{ margin: 0 }}>
          视频管理
        </Title>
      </div>

      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <Space>
          <Text strong>选择课程：</Text>
          <Select
            style={{ minWidth: 200 }}
            placeholder="请选择课程"
            value={selectedCourseId || undefined}
            onChange={handleCourseSelect}
            allowClear
            options={courses.map((course: any) => ({
              label: course.title,
              value: course.id,
            }))}
          />
        </Space>
      </div>

      <Tabs
        activeKey={currentTab}
        onChange={setCurrentTab}
        items={tabItems}
        style={{ marginBottom: 24 }}
      />

      <Spin spinning={isLoading} tip="正在加载视频...">
        {error && (
          <div style={{ textAlign: "center", padding: "64px 0" }}>
            <Title level={5} style={{ color: "#ff4d4f", marginBottom: 16 }}>
              加载视频时出错: {(error as Error).message}
            </Title>
            <Button type="primary" onClick={() => refetch()}>
              重试
            </Button>
          </div>
        )}

        {!isLoading && !error && videos.length === 0 && (
          <Card style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenCreateDialog()}
                  disabled={!selectedCourseId}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  新建视频
                </Button>
              </Space>
            </div>
            <Empty
              description={selectedCourseId ? "该课程暂无视频，点击上方按钮创建" : "请先选择一个课程"}
              style={{ padding: "64px 0" }}
            />
          </Card>
        )}

        {!isLoading && !error && videos.length > 0 && (
          <>
            {currentTab === "0" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <Space>
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={() => handleOpenCreateDialog()}
                      style={canEdit ? undefined : { display: "none" }}
                    >
                      新建视频
                    </Button>
                  </Space>
                </div>
                <Row gutter={[12, 12]}>
                  {videos.map(renderVideoCard)}
                </Row>
              </div>
            )}

            {currentTab === "1" && (
              <Card
                bordered={false}
                style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}
              >
                <Table
                  className="theme-table"
                  columns={tableColumns}
                  dataSource={videos}
                  rowKey="id"
                  title={() => (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Space>
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          onClick={() => handleOpenCreateDialog()}
                        >
                          新建视频
                        </Button>
                      </Space>
                    </div>
                  )}
                  pagination={{
                    showSizeChanger: true,
                    showTotal: (total) => `共 ${total} 条`,
                  }}
                />
              </Card>
            )}
          </>
        )}
      </Spin>

      {renderCreateDialog()}
      {renderEditDialog()}
      {renderPreviewDialog()}
    </div>
  );
}
