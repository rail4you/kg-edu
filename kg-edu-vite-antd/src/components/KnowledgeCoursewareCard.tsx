import { useState } from "react";
import { Typography, Tag, Button, Space, Tooltip } from "antd";
import {
  FileTextOutlined,
  VideoCameraOutlined,
  ReadOutlined,
  BookOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
  EyeOutlined,
} from "@ant-design/icons";
import VideoPlayerModal from "@/components/VideoPlayerModal";

const { Text } = Typography;

// 题目类型翻译
const QUESTION_TYPE_LABELS: Record<string, string> = {
  multiple_choice: "单选题",
  multiple_response: "多选题",
  true_false: "判断题",
  essay: "问答题",
  fill_in_blank: "填空题",
  term_definition: "名词解释",
  case_study: "案例题",
};

// 知识点类型标签
const KNOWLEDGE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  subject: { label: "主题", color: "#3b82f6" },
  knowledge_unit: { label: "单元", color: "#8b5cf6" },
  knowledge_cell: { label: "知识点", color: "#10b981" },
};

const formatFileSize = (bytes?: number) => {
  if (!bytes) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

// 视频缩略图默认尺寸
const THUMB_WIDTH = 80;
const THUMB_HEIGHT = 45;

export interface KnowledgeCoursewareResource {
  id: string;
  name: string;
  knowledgeType?: string;
  description?: string | null;
  files?: Array<{
    id: string;
    filename: string;
    path?: string;
    size?: number;
    fileType?: string;
  }>;
  videos?: Array<{
    id: string;
    title?: string;
    assetId?: string;
    thumbnail?: string;
  }>;
  exercises?: Array<{
    id: string;
    title: string;
    questionType?: string;
  }>;
  homeworks?: Array<{
    id: string;
    title: string;
  }>;
}

interface KnowledgeCoursewareCardProps {
  resource: KnowledgeCoursewareResource;
  /** 是否显示知识点名称行（默认 true） */
  showTitle?: boolean;
  /** 文件查看回调 */
  onViewFile?: (file: { id: string; filename: string; path?: string; size?: number; fileType?: string }) => void;
  /** 文件下载回调 */
  onDownloadFile?: (file: { id: string; filename: string; path?: string; size?: number; fileType?: string }) => void;
}

export default function KnowledgeCoursewareCard({
  resource,
  showTitle = true,
  onViewFile,
  onDownloadFile,
}: KnowledgeCoursewareCardProps) {
  const files = resource.files || [];
  const videos = resource.videos || [];
  const exercises = resource.exercises || [];
  const homeworks = resource.homeworks || [];
  const totalResources = files.length + videos.length + exercises.length + homeworks.length;

  // 视频播放弹窗状态
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<{
    id: string;
    title?: string;
    assetId?: string;
    thumbnail?: string;
  } | null>(null);

  const typeInfo = KNOWLEDGE_TYPE_LABELS[resource.knowledgeType || ""] || {
    label: "其他",
    color: "#94a3b8",
  };

  const handlePlayVideo = (video: (typeof videos)[0]) => {
    setSelectedVideo({
      id: video.id,
      title: video.title,
      assetId: video.assetId,
      thumbnail: video.thumbnail,
    });
    setVideoModalOpen(true);
  };

  // 无资源时只显示名称和类型标签
  if (totalResources === 0) {
    if (!showTitle) return null;
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 0",
        }}
      >
        <Tag
          color={typeInfo.color}
          style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0, borderRadius: 3 }}
        >
          {typeInfo.label}
        </Tag>
        <Text style={{ fontSize: 13, color: "#334155" }}>{resource.name}</Text>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {/* 知识点名称行 */}
      {showTitle && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 0",
          }}
        >
          <Tag
            color={typeInfo.color}
            style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0, borderRadius: 3 }}
          >
            {typeInfo.label}
          </Tag>
          <Text strong style={{ fontSize: 13, color: "#1e293b" }}>
            {resource.name}
          </Text>
          <Text style={{ fontSize: 11, color: "#94a3b8", marginLeft: 4 }}>
            ({totalResources})
          </Text>
        </div>
      )}

      {/* 缩进的资源列表 */}
      <div style={{ marginLeft: 20, marginTop: 2, marginBottom: 4 }}>
        {/* 文件资源 */}
        {files.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {files.map((file) => (
              <div
                key={file.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #f0f0f0",
                  marginBottom: 3,
                }}
              >
                <FileTextOutlined style={{ color: "#3b82f6", fontSize: 14, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{ fontSize: 12, display: "block", maxWidth: 200 }}
                  >
                    {file.filename || "未知文件"}
                  </Text>
                  {file.size ? (
                    <Text style={{ fontSize: 10, color: "#94a3b8" }}>
                      {formatFileSize(file.size)}
                    </Text>
                  ) : null}
                </div>
                <Space size={2}>
                  {onViewFile && (
                    <Tooltip title="查看">
                      <Button
                        size="small"
                        type="text"
                        icon={<EyeOutlined style={{ fontSize: 12 }} />}
                        onClick={() => onViewFile(file)}
                        style={{ color: "#3b82f6" }}
                      />
                    </Tooltip>
                  )}
                  {onDownloadFile && (
                    <Tooltip title="下载">
                      <Button
                        size="small"
                        type="text"
                        icon={<DownloadOutlined style={{ fontSize: 12 }} />}
                        onClick={() => onDownloadFile(file)}
                        style={{ color: "#8b5cf6" }}
                      />
                    </Tooltip>
                  )}
                </Space>
              </div>
            ))}
          </div>
        )}

        {/* 视频资源 */}
        {videos.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {videos.map((video) => (
              <div
                key={video.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #f0f0f0",
                  marginBottom: 3,
                }}
              >
                {/* 视频缩略图 */}
                <div
                  style={{
                    width: THUMB_WIDTH,
                    height: THUMB_HEIGHT,
                    borderRadius: 4,
                    overflow: "hidden",
                    flexShrink: 0,
                    background: video.thumbnail
                      ? "transparent"
                      : "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <VideoCameraOutlined style={{ color: "#fff", fontSize: 16 }} />
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{ fontSize: 12, display: "block", maxWidth: 180 }}
                  >
                    {video.title || "未命名视频"}
                  </Text>
                </div>
                <Tooltip title="播放视频">
                  <Button
                    size="small"
                    type="text"
                    icon={<PlayCircleOutlined style={{ fontSize: 16 }} />}
                    onClick={() => handlePlayVideo(video)}
                    style={{ color: "#8b5cf6" }}
                  >
                    播放
                  </Button>
                </Tooltip>
              </div>
            ))}
          </div>
        )}

        {/* 习题资源 */}
        {exercises.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {exercises.map((exercise) => (
              <div
                key={exercise.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #f0f0f0",
                  marginBottom: 3,
                }}
              >
                <ReadOutlined style={{ color: "#f59e0b", fontSize: 14, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{ fontSize: 12, display: "block", maxWidth: 200 }}
                  >
                    {exercise.title || "未命名习题"}
                  </Text>
                </div>
                {exercise.questionType && (
                  <Tag
                    color="orange"
                    style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px", margin: 0, borderRadius: 3 }}
                  >
                    {QUESTION_TYPE_LABELS[exercise.questionType] || exercise.questionType}
                  </Tag>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 作业资源 */}
        {homeworks.length > 0 && (
          <div style={{ marginBottom: 6 }}>
            {homeworks.map((hw) => (
              <div
                key={hw.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "5px 10px",
                  background: "#fff",
                  borderRadius: 6,
                  border: "1px solid #f0f0f0",
                  marginBottom: 3,
                }}
              >
                <BookOutlined style={{ color: "#0891b2", fontSize: 14, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    ellipsis
                    style={{ fontSize: 12, display: "block", maxWidth: 200 }}
                  >
                    {hw.title || "未命名作业"}
                  </Text>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 视频播放弹窗 */}
      <VideoPlayerModal
        open={videoModalOpen}
        onClose={() => {
          setVideoModalOpen(false);
          setSelectedVideo(null);
        }}
        video={selectedVideo}
      />
    </div>
  );
}
