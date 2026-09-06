import { useState, useRef } from "react";
import { Modal, Typography } from "antd";
import {
  PlayCircleOutlined,
  CloseOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";

const { Text, Title } = Typography;

interface VideoPlayerModalProps {
  open: boolean;
  onClose: () => void;
  video: {
    id: string;
    title?: string;
    thumbnail?: string;
    assetId?: string;
  } | null;
  onPlayStart?: () => void;
}

export default function VideoPlayerModal({
  open,
  onClose,
  video,
  onPlayStart,
}: VideoPlayerModalProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // 当弹窗关闭时重置播放状态并暂停视频
  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setIsPlaying(false);
    setHasStarted(false);
    onClose();
  };

  const getVideoUrl = () => {
    if (video?.assetId) {
      // 检查是否是完整的 URL
      if (video.assetId.startsWith("http://") || video.assetId.startsWith("https://")) {
        return video.assetId;
      }
      // 如果不是完整 URL，添加 API 前缀
      return `/api/video/${video.assetId}`;
    }
    return null;
  };

  const videoUrl = getVideoUrl();

  const handlePlayClick = () => {
    setIsPlaying(true);
    if (!hasStarted) {
      setHasStarted(true);
      onPlayStart?.();
    }
  };

  const renderVideoContent = () => {
    // 如果没有视频资源
    if (!videoUrl) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            height: 400,
            background: "#1a1a1a",
            borderRadius: 8,
          }}
        >
          <VideoCameraOutlined style={{ fontSize: 64, color: "#666", marginBottom: 16 }} />
          <Text style={{ color: "#999", fontSize: 16 }}>视频暂不可用</Text>
          <Text style={{ color: "#666", fontSize: 14, marginTop: 8 }}>
            该视频资源正在处理中，请稍后再试
          </Text>
        </div>
      );
    }

    // 如果正在播放
    if (isPlaying) {
      return (
        <video
          ref={videoRef}
          controls
          autoPlay
          style={{
            width: "100%",
            maxHeight: "70vh",
            borderRadius: 8,
            background: "#000",
          }}
        >
          <source src={videoUrl} type="video/mp4" />
          您的浏览器不支持视频播放
        </video>
      );
    }

    // 如果有缩略图，显示缩略图和播放按钮
    if (video?.thumbnail) {
      return (
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#000",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <img
            src={video.thumbnail}
            alt={video.title || "视频缩略图"}
            style={{
              width: "100%",
              maxHeight: "70vh",
              objectFit: "contain",
              opacity: 0.8,
            }}
          />
          <div
            onClick={handlePlayClick}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
            }}
          >
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "rgba(0, 0, 0, 0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(24, 144, 255, 0.8)";
                e.currentTarget.style.transform = "scale(1.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(0, 0, 0, 0.6)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <PlayCircleOutlined style={{ fontSize: 48, color: "#fff" }} />
            </div>
            <Text style={{ color: "#fff", fontSize: 14, textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}>
              点击播放视频
            </Text>
          </div>
        </div>
      );
    }

    // 没有缩略图，显示默认播放界面
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 400,
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
          borderRadius: 8,
          cursor: "pointer",
        }}
        onClick={handlePlayClick}
      >
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: "50%",
            background: "rgba(24, 144, 255, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 24,
            transition: "all 0.3s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(24, 144, 255, 0.4)";
            e.currentTarget.style.transform = "scale(1.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(24, 144, 255, 0.2)";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          <PlayCircleOutlined style={{ fontSize: 56, color: "#1890ff" }} />
        </div>
        <Text style={{ color: "#fff", fontSize: 18, marginBottom: 8 }}>
          {video?.title || "点击播放视频"}
        </Text>
        <Text style={{ color: "#999", fontSize: 14 }}>
          开始学习此视频内容
        </Text>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onCancel={handleClose}
      footer={null}
      width={900}
      centered
      styles={{
        body: { padding: 0 },
        header: { display: "none" },
      }}
      closeIcon={null}
    >
      {/* 头部 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          background: "#1a1a1a",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <Title level={5} style={{ margin: 0, color: "#fff" }}>
          {video?.title || "视频播放"}
        </Title>
        <div
          onClick={handleClose}
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: "50%",
            transition: "background 0.3s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <CloseOutlined style={{ color: "#fff", fontSize: 18 }} />
        </div>
      </div>

      {/* 视频内容 */}
      <div
        style={{
          background: "#000",
          padding: 16,
          borderRadius: "0 0 8px 8px",
        }}
      >
        {renderVideoContent()}
      </div>
    </Modal>
  );
}
