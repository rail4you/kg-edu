import { useCallback, useEffect, useRef, useState } from "react";
import { Modal, Button, Alert, Space, Tag, Typography, message } from "antd";
import { CameraOutlined, CameraFilled, LoadingOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import {
  startProctorSession,
  reportProctorFrame,
  stopProctorSession,
  captureProctorSnapshot,
} from "@/lib/proctor-api";

const { Text } = Typography;

const FRAME_INTERVAL = 4000;

interface ExamMonitorModalProps {
  open: boolean;
  exam: { id: string; title: string } | null;
  onClose: () => void;
}

type Status = "idle" | "starting" | "live" | "error";

export default function ExamMonitorModal({ open, exam, onClose }: ExamMonitorModalProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);

  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string>("");
  const [frameCount, setFrameCount] = useState(0);
  const [snapshotCount, setSnapshotCount] = useState(0);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return null;
    const width = 480;
    const height = Math.round((video.videoHeight / video.videoWidth) * width) || 360;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", 0.6);
  }, []);

  const stopEverything = useCallback(() => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (exam && user?.id) {
      stopProctorSession({ examId: exam.id, studentId: user.id }, user).catch(() => {});
    }
  }, [exam, user]);

  useEffect(() => {
    if (!open || !exam) {
      return;
    }

    let cancelled = false;
    setStatus("starting");
    setError("");
    setFrameCount(0);
    setSnapshotCount(0);

    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("当前浏览器不支持摄像头调用");
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (user?.id) {
          await startProctorSession(
            {
              examId: exam.id,
              studentId: user.id,
              studentName: user.name || user.displayName || user.email || undefined,
            },
            user
          );
        }

        setStatus("live");

        timerRef.current = window.setInterval(async () => {
          const frame = captureFrame();
          if (!frame || !user?.id) return;
          try {
            await reportProctorFrame(
              {
                examId: exam.id,
                studentId: user.id,
                studentName: user.name || user.displayName || user.email || undefined,
                image: frame,
              },
              user
            );
            setFrameCount((n) => n + 1);
          } catch {
            /* 单帧上报失败忽略，下一周期重试 */
          }
        }, FRAME_INTERVAL);
      } catch (e: any) {
        if (cancelled) return;
        setStatus("error");
        setError(e?.message || "无法访问摄像头，请检查浏览器权限");
      }
    };

    start();

    return () => {
      cancelled = true;
      stopEverything();
    };
  }, [open, exam?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSnapshot = async () => {
    if (!exam || !user?.id) return;
    const frame = captureFrame();
    if (!frame) {
      message.warning("画面尚未就绪，请稍候");
      return;
    }
    try {
      await captureProctorSnapshot(
        {
          examId: exam.id,
          studentId: user.id,
          studentName: user.name || user.displayName || user.email || undefined,
          image: frame,
          source: "manual",
        },
        user
      );
      setSnapshotCount((n) => n + 1);
      message.success("已抓拍当前画面");
    } catch (e: any) {
      message.error(e?.message || "抓拍失败");
    }
  };

  const handleClose = () => {
    stopEverything();
    onClose();
  };

  return (
    <Modal
      open={open}
      title={exam ? `考试监控 · ${exam.title}` : "考试监控"}
      onCancel={handleClose}
      footer={[
        <Button key="snapshot" icon={<CameraOutlined />} onClick={handleSnapshot} disabled={status !== "live"}>
          抓拍
        </Button>,
        <Button key="close" type="primary" onClick={handleClose}>
          结束监控
        </Button>,
      ]}
      width={560}
      maskClosable={false}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "4 / 3",
          background: "#000",
          borderRadius: 10,
          overflow: "hidden",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
        />
        {status !== "live" && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              color: "#fff",
            }}
          >
            {status === "error" ? (
              <CameraFilled style={{ fontSize: 40, opacity: 0.6 }} />
            ) : (
              <LoadingOutlined style={{ fontSize: 36 }} />
            )}
            <Text style={{ color: "rgba(255,255,255,0.85)" }}>
              {status === "error" ? "摄像头未开启" : "正在开启摄像头…"}
            </Text>
          </div>
        )}
        {status === "live" && (
          <Tag color="red" style={{ position: "absolute", top: 10, left: 10, margin: 0 }}>
            ● 监控中
          </Tag>
        )}
      </div>

      {status === "error" && (
        <Alert type="error" showIcon style={{ marginTop: 12 }} message={error} />
      )}

      <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Space size="large">
          <Text type="secondary">已上报画面：{frameCount} 帧</Text>
          <Text type="secondary">本次抓拍：{snapshotCount} 张</Text>
        </Space>
        <Text type="secondary" style={{ fontSize: 12 }}>
          每 {FRAME_INTERVAL / 1000} 秒自动上报一次画面
        </Text>
      </div>
    </Modal>
  );
}
