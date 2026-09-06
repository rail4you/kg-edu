import React, { useState, useRef } from "react"
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  Card,
  Empty,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tabs,
  Typography,
  Tooltip,
  Upload,
} from "antd";
import type { TableColumnsType, UploadProps } from "antd";
import {
  PlusOutlined,
  DeleteOutlined,
  VideoCameraOutlined,
  ImportOutlined,
  CloudUploadOutlined,
  UploadOutlined,
  CloseOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import {
  createMmVideo,
  deleteMmVideo,
  listMmVideosByCourse,
} from "@/lib/ash_rpc";
import {
  getSTSToken,
  uploadFileToOSS,
  uploadFileViaServer,
  getVideoDuration,
} from "@/lib/oss-upload";
import type { UploadProgress } from "@/lib/oss-upload";
import ImportModal from "@/components/micro-major/import-modal";
import { useEditPermission } from "@/hooks/use-edit-permission";
import { ReadonlyActionButton } from "@/components/readonly-action-button";

interface MMVideoManagerProps {
  tenant: string;
  courseId: string;
  headers: Record<string, string>;
}

interface VideoItem {
  id: string;
  microMajorCourseId: string;
  microMajorChapterId?: string | null;
  title?: string | null;
  assetId: string;
  playbackId: string;
  duration?: number | null;
  thumbnail?: string | null;
  sourceVideoId?: string | null;
  insertedAt?: string;
}

const { Title, Text } = Typography;

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return "-";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export default function MMVideoManager({ tenant, courseId, headers }: MMVideoManagerProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const { canEdit } = useEditPermission();

  // Modal state
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [manualTab, setManualTab] = useState<string>("upload");
  const [importModalOpen, setImportModalOpen] = useState(false);

  // Upload state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");

  // Manual create state
  const [createForm] = Form.useForm();

  // Fetch videos
  const { data: videosData, isLoading } = useQuery({
    queryKey: ["mm-videos", courseId],
    queryFn: async () => {
      const result = await listMmVideosByCourse({
        tenant,
        input: { microMajorCourseId: courseId },
        fields: [
          "id",
          "title",
          "assetId",
          "playbackId",
          "duration",
          "thumbnail",
          "sourceVideoId",
          "microMajorChapterId",
          "insertedAt",
        ],
        headers,
      });
      if (!result.success) return [];
      const data = result.data;
      if (Array.isArray(data)) return data;
      return data?.results || [];
    },
    enabled: !!tenant && !!courseId,
  });

  const videos: VideoItem[] = (videosData as VideoItem[]) || [];

  // Create mutation (manual)
  const createMutation = useMutation({
    mutationFn: async (values: { title: string; assetId: string; playbackId: string; duration?: number }) => {
      const result = await createMmVideo({
        tenant,
        input: {
          microMajorCourseId: courseId,
          title: values.title,
          assetId: values.assetId,
          playbackId: values.playbackId,
          duration: values.duration || null,
        },
        fields: ["id", "title"],
        headers,
      });
      if (!result.success) throw new Error("创建视频失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("视频创建成功");
      setCreateModalOpen(false);
      setManualTab("upload");
      setUploadFile(null);
      setUploadTitle("");
      setUploadStatus("");
      setUploadProgress(0);
      createForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ["mm-videos"] });
    },
    onError: (err) => message.error("创建失败: " + (err instanceof Error ? err.message : "未知错误")),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteMmVideo({
        tenant,
        primaryKey: id,
        headers,
      });
      if (!result.success) throw new Error("删除视频失败");
      return result.data;
    },
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["mm-videos"] });
    },
    onError: () => message.error("删除失败"),
  });

  // ---- Upload Handler ----

  const handleUpload = async () => {
    if (!uploadFile) {
      message.error("请选择视频文件");
      return;
    }
    if (!uploadTitle.trim()) {
      message.error("请输入视频标题");
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus("正在准备上传...");

    try {
      // 1. Get duration
      setUploadStatus("正在获取视频时长...");
      let duration: number | null = null;
      try {
        duration = await getVideoDuration(uploadFile);
        setUploadStatus(`视频时长: ${formatDuration(duration)}`);
      } catch (e) {
        console.warn("Failed to get duration:", e);
      }

      // 2. Upload to OSS
      setUploadStatus("正在获取上传凭证...");
      const stsResponse = await getSTSToken(
        uploadFile.name,
        uploadFile.size,
        uploadFile.type,
      );
      if (!stsResponse.success) {
        throw new Error(stsResponse.error || "获取上传凭证失败");
      }

      setUploadStatus("正在上传到 OSS...");
      let ossResult: { url: string; name: string };
      try {
        ossResult = await uploadFileToOSS(stsResponse, {
          file: uploadFile,
          onProgress: (progress: UploadProgress) => {
            setUploadProgress(Math.min(progress.percent, 90));
            setUploadStatus(`上传进度: ${progress.percent}%`);
          },
        });
      } catch (ossError) {
        console.warn("Direct OSS upload failed, fallback to server:", ossError);
        setUploadStatus("正在通过服务器上传...");
        setUploadProgress(25);
        ossResult = await uploadFileViaServer(uploadFile, {
          onProgress: (progress: UploadProgress) => {
            setUploadProgress(Math.min(25 + Math.floor(progress.percent * 0.65), 90));
          },
        });
      }

      // 3. Create video record
      setUploadStatus("正在创建视频记录...");
      setUploadProgress(95);
      const playbackUrl = ossResult.url;
      const thumbnailUrl = `${playbackUrl}?x-oss-process=video/snapshot,t_7000,f_jpg,w_1280,h_720,m_fast`;

      const result = await createMmVideo({
        tenant,
        input: {
          microMajorCourseId: courseId,
          title: uploadTitle,
          assetId: playbackUrl,
          playbackId: playbackUrl,
          duration,
          thumbnail: thumbnailUrl,
        },
        fields: ["id", "title"],
        headers,
      });

      if (!result.success) throw new Error("创建视频记录失败");

      setUploadProgress(100);
      setUploadStatus("上传完成！");
      message.success(`视频「${uploadTitle}」上传成功`);
      queryClient.invalidateQueries({ queryKey: ["mm-videos"] });

      // Reset
      setTimeout(() => {
        setCreateModalOpen(false);
        setManualTab("upload");
        setUploadFile(null);
        setUploadTitle("");
        setUploadStatus("");
        setUploadProgress(0);
        setIsUploading(false);
      }, 500);
    } catch (error: any) {
      if (error.message === "UPLOAD_CANCELLED") {
        setUploadStatus("上传已取消");
      } else {
        setUploadStatus(`上传失败: ${error.message}`);
        message.error(error.message || "上传失败");
      }
      setIsUploading(false);
    }
  };

  const handleUploadCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
    }
    setUploadStatus("上传已取消");
    setIsUploading(false);
  };

  // ---- Columns ----
  const columns: TableColumnsType<VideoItem> = [
    {
      title: "视频标题",
      dataIndex: "title",
      key: "title",
      render: (v: string, record: VideoItem) => (
        <Space size={4} style={{ maxWidth: "100%" }}>
          <VideoCameraOutlined style={{ color: "#1890ff", flexShrink: 0 }} />
          <Tooltip title={v || "-"} mouseEnterDelay={0.3}>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0, flex: 1 }}>{v || "-"}</span>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: "时长",
      dataIndex: "duration",
      key: "duration",
      width: 80,
      render: (v: number) => formatDuration(v),
    },
    {
      title: "来源",
      dataIndex: "sourceVideoId",
      key: "sourceVideoId",
      width: 100,
      render: (v: string) =>
        v ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            从课程导入
          </Text>
        ) : (
          <Text type="success" style={{ fontSize: 12 }}>
            本地上传
          </Text>
        ),
    },
    {
      title: "操作",
      key: "actions",
      width: 100,
      render: (_: any, record: VideoItem) => (
        <Popconfirm title="确定删除此视频？" onConfirm={() => deleteMutation.mutate(record.id)}>
          <ReadonlyActionButton type="link" danger icon={<DeleteOutlined />} size="small">
            删除
          </ReadonlyActionButton>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card style={{ boxShadow: "0 1px 3px rgba(16, 24, 40, 0.1)" }}>
        {isLoading ? (
          <Table columns={columns} dataSource={[]} rowKey="id" loading pagination={false} size="middle" />
        ) : videos.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px" }}>
            <Empty description="暂无视频，请上传或从智慧课程导入" />
            <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 12 }}>
              <Button
                type="primary"
                icon={<CloudUploadOutlined />}
                onClick={() => {
                  setCreateModalOpen(true);
                  setManualTab("upload");
                }}
                style={canEdit ? undefined : { display: "none" }}
              >
                上传视频
              </Button>
              <Button
                icon={<ImportOutlined />}
                onClick={() => setImportModalOpen(true)}
                style={canEdit ? undefined : { display: "none" }}
              >
                从智慧课程导入
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Space>
                <Button
                  type="primary"
                  icon={<CloudUploadOutlined />}
                  onClick={() => {
                    setCreateModalOpen(true);
                    setManualTab("upload");
                  }}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  上传视频
                </Button>
                <Button
                  icon={<ImportOutlined />}
                  onClick={() => setImportModalOpen(true)}
                  style={canEdit ? undefined : { display: "none" }}
                >
                  从智慧课程导入
                </Button>
              </Space>
            </div>
            <Table
              columns={columns}
              dataSource={videos}
              rowKey="id"
              loading={isLoading}
              pagination={false}
              size="middle"
              locale={{ emptyText: <Empty description="暂无视频" /> }}
            />
          </>
        )}
      </Card>

      {/* Create/Upload Modal */}
      <Modal
        title="添加视频"
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          setManualTab("upload");
          setUploadFile(null);
          setUploadTitle("");
          setUploadStatus("");
          setUploadProgress(0);
          setIsUploading(false);
          createForm.resetFields();
        }}
        width={640}
        footer={null}
      >
        <Tabs
          activeKey={manualTab}
          onChange={setManualTab}
          items={[
            {
              key: "upload",
              label: "本地上传",
              children: (
                <div style={{ padding: "16px 0" }}>
                  <div style={{ marginBottom: 16 }}>
                    <Text strong>视频标题</Text>
                    <Input
                      placeholder="请输入视频标题"
                      value={uploadTitle}
                      onChange={(e) => setUploadTitle(e.target.value)}
                      style={{ marginTop: 8 }}
                      disabled={isUploading}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <Text strong>选择视频文件</Text>
                    <div style={{ marginTop: 8 }}>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setUploadFile(file);
                            if (!uploadTitle) {
                              // Auto-fill title from filename
                              const name = file.name.replace(/\.[^/.]+$/, "");
                              setUploadTitle(name);
                            }
                          }
                        }}
                        disabled={isUploading}
                        style={{ width: "100%" }}
                      />
                      {uploadFile && (
                        <Text type="secondary" style={{ display: "block", marginTop: 4, fontSize: 12 }}>
                          {uploadFile.name} ({(uploadFile.size / 1024 / 1024).toFixed(2)} MB)
                        </Text>
                      )}
                    </div>
                  </div>

                  {uploadStatus && (
                    <div style={{ marginBottom: 16 }}>
                      <Text
                        type={
                          uploadStatus.includes("失败") || uploadStatus.includes("取消")
                            ? "danger"
                            : "secondary"
                        }
                        style={{ display: "block", marginBottom: 8 }}
                      >
                        {uploadStatus}
                      </Text>
                      {isUploading && <Progress percent={uploadProgress} status="active" />}
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 12 }}>
                    {!isUploading ? (
                      <Button
                        type="primary"
                        icon={<UploadOutlined />}
                        onClick={handleUpload}
                        disabled={!uploadFile || !uploadTitle.trim()}
                      >
                        开始上传
                      </Button>
                    ) : (
                      <Button
                        danger
                        icon={<CloseOutlined />}
                        onClick={handleUploadCancel}
                      >
                        取消上传
                      </Button>
                    )}
                  </div>
                </div>
              ),
            },
            {
              key: "manual",
              label: "手动添加",
              children: (
                <div style={{ padding: "16px 0" }}>
                  <Form
                    form={createForm}
                    layout="vertical"
                    onFinish={(v) => createMutation.mutate(v)}
                  >
                    <Form.Item
                      name="title"
                      label="视频标题"
                      rules={[{ required: true, message: "请输入视频标题" }]}
                    >
                      <Input placeholder="请输入视频标题" />
                    </Form.Item>
                    <Form.Item
                      name="playbackId"
                      label="播放地址/URL"
                      rules={[{ required: true, message: "请输入播放地址" }]}
                    >
                      <Input placeholder="视频URL或播放地址" />
                    </Form.Item>
                    <Form.Item
                      name="assetId"
                      label="资源标识"
                      rules={[{ required: true, message: "请输入资源标识" }]}
                    >
                      <Input placeholder="资源ID或标识" />
                    </Form.Item>
                    <Form.Item name="duration" label="时长（秒）">
                      <InputNumber min={0} style={{ width: "100%" }} />
                    </Form.Item>
                    <Form.Item>
                      <Button
                        type="primary"
                        htmlType="submit"
                        loading={createMutation.isPending}
                      >
                        创建
                      </Button>
                    </Form.Item>
                  </Form>
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* Import Modal */}
      <ImportModal
        open={importModalOpen}
        onCancel={() => setImportModalOpen(false)}
        title="从智慧课程导入视频"
        importType="videos"
        targetCourseId={courseId}
        tenant={tenant}
        headers={headers}
        onImport={async (videoIds) => {
          const resp = await fetch(`/rpc/run?tenant=${tenant}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({
              action: "import_mm_videos_from_course",
              input: { microMajorCourseId: courseId, videoIds },
            }),
          });
          const result = await resp.json();
          if (!result.success) throw new Error("导入失败: " + (result.errors?.[0]?.message || "未知错误"));
          queryClient.invalidateQueries({ queryKey: ["mm-videos"] });
        }}
      />
    </div>
  );
}
