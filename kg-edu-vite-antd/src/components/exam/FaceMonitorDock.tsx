import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Button, Space, Tag, Tooltip, Typography } from "antd";
import {
  CameraOutlined,
  CloseOutlined,
  MinusOutlined,
  LoadingOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
  EyeOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { logFaceCheck } from "@/lib/ash_rpc";
import { detectFace, preloadFaceDetector } from "@/lib/face-detect";
import { FACE_SCENE_LABEL, type FaceCheckSettings, type FaceScene } from "@/lib/face-settings";

export type { FaceScene } from "@/lib/face-settings";

const { Text } = Typography;

function drawFrame(video: HTMLVideoElement): { canvas: HTMLCanvasElement; dataUrl: string } | null {
  if (!video.videoWidth) return null;
  const width = 480;
  const height = Math.round((video.videoHeight / video.videoWidth) * width) || 240;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, width, height);
  return { canvas, dataUrl: canvas.toDataURL("image/jpeg", 0.5) };
}

export interface FaceMonitorHandle {
  capture: (scene: FaceScene) => void;
  captureNode: (scene: FaceScene) => void;
  /** 抓拍并返回人脸识别是否通过（用于视频完成校验，不触发违规暂停） */
  verify: (scene: FaceScene) => Promise<boolean>;
}

interface FaceMonitorDockProps {
  enabled: boolean;
  courseId?: string | null;
  videoId?: string | null;
  videoName?: string | null;
  settings: FaceCheckSettings;
  onViolation?: (scene: FaceScene) => void;
  /** 每次实时检测结果回调（用于父组件在“不允许学习”模式下禁用内容） */
  onFaceStatus?: (ok: boolean) => void;
  onClose: () => void;
}

interface LogEntry {
  scene: FaceScene;
  result: "pass" | "fail";
  at: string;
}

const FaceMonitorDock = forwardRef<FaceMonitorHandle, FaceMonitorDockProps>(
  ({ enabled, courseId, videoId, videoName, settings, onViolation, onFaceStatus, onClose }, ref) => {
    const { user } = useAuth();
    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const timedRef = useRef<number | null>(null);
    const randomRef = useRef<number | null>(null);

    const [status, setStatus] = useState<"idle" | "starting" | "live" | "error">("idle");
    const [error, setError] = useState("");
    const [minimized, setMinimized] = useState(false);
    const [recent, setRecent] = useState<LogEntry[]>([]);
    const [lastResult, setLastResult] = useState<"pass" | "fail" | null>(null);
    const [detectError, setDetectError] = useState("");
    const [lastDetect, setLastDetect] = useState("");
    const [frameSource, setFrameSource] = useState("");
    const [live, setLive] = useState<{ faces: number; raw: number; score: number; t: number; brightness?: number } | null>(null);
    const [lastFrameUrl, setLastFrameUrl] = useState("");

    const settingsRef = useRef(settings);
    settingsRef.current = settings;

    // 稳定引用的 ref 回调：仅在挂载/卸载时触发（避免每次渲染重置 srcObject）
    const setVideoEl = useCallback((el: HTMLVideoElement | null) => {
      videoRef.current = el;
      if (el && streamRef.current && el.srcObject !== streamRef.current) {
        el.srcObject = streamRef.current;
        el.play().catch(() => {});
      }
    }, []);
    const captureRef = useRef<(scene: FaceScene, violate?: boolean) => Promise<boolean>>(
      async () => false
    );

    const stopAll = useCallback(() => {
      if (timedRef.current) {
        window.clearInterval(timedRef.current);
        timedRef.current = null;
      }
      if (randomRef.current) {
        window.clearTimeout(randomRef.current);
        randomRef.current = null;
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }, []);

    // 从摄像头轨道直接抓取“最新帧”（不依赖 <video> 是否在播放），
    // 浏览器不支持 ImageCapture 时回退到从 <video> 绘制。
    const grabFrame = useCallback(async (): Promise<{ canvas: HTMLCanvasElement; dataUrl: string } | null> => {
      const track = streamRef.current?.getVideoTracks()[0];
      const IC: any = (window as any).ImageCapture;
      if (track && track.readyState === "live" && IC) {
        try {
          const bitmap: ImageBitmap = await new IC(track).grabFrame();
          const width = 480;
          const height = Math.round((bitmap.height / bitmap.width) * width) || 240;
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(bitmap as any, 0, 0, width, height);
            (bitmap as any).close?.();
            setFrameSource(`capture:${track.label || "cam"}`);
            return { canvas, dataUrl: canvas.toDataURL("image/jpeg", 0.5) };
          }
        } catch (e) {
          console.warn("[face-dock] ImageCapture.grabFrame 失败，回退 video", e);
        }
      }
      const v = videoRef.current;
      if (!v || !v.videoWidth) return null;
      setFrameSource(`video:paused=${v.paused},ready=${v.readyState}`);
      return drawFrame(v);
    }, []);

    const capture = useCallback(
      async (scene: FaceScene, violate = true): Promise<boolean> => {
        if (!enabled) return false;

        const drawn = await grabFrame();
        if (!drawn) {
          setDetectError("无法获取摄像头画面，请检查摄像头权限");
          setLastDetect("取帧失败");
          setLastResult("fail");
          return false;
        }
        const { canvas, dataUrl: frame } = drawn;
        let pass: boolean;
        let detectError: string | undefined;
        if (settingsRef.current.simulateFail) {
          pass = false;
        } else {
          const detected = await detectFace(canvas);
          pass = detected.ok;
          detectError = detected.error;
          setLastDetect(
            detected.error
              ? detected.error
              : `人脸 ${detected.faces}/${detected.raw} · 最高分 ${detected.maxScore.toFixed(2)}`
          );
        }
        const result: "pass" | "fail" = pass ? "pass" : "fail";
        const at = new Date().toLocaleTimeString("zh-CN", { hour12: false });

        setLastResult(result);
        setDetectError(detectError || "");
        setRecent((prev) => [{ scene, result, at }, ...prev].slice(0, 6));

        try {
          await logFaceCheck({
            tenant: getCurrentTenant()?.schemaName || "",
            input: {
              userId: user?.id,
              scene,
              result,
              snapshotUrl: frame,
              courseId: courseId || null,
              videoId: videoId || null,
              videoTitle: videoName || null,
              note: at,
            },
            fields: ["id"],
            headers: getAuthHeaders(user),
          });
        } catch {
          /* 记录失败不影响视频播放 */
        }

        if (!pass && violate && settingsRef.current.mode === "block") {
          onViolation?.(scene);
        }

        return pass;
      },
      [enabled, user, courseId, videoId, videoName, onViolation]
    );
    captureRef.current = capture;

    useImperativeHandle(ref, () => ({
      capture: (scene) => {
        captureRef.current?.(scene);
      },
      captureNode: (scene) => {
        if (settingsRef.current.nodes[scene as keyof typeof settingsRef.current.nodes]) {
          captureRef.current?.(scene);
        }
      },
      verify: (scene) => captureRef.current?.(scene, false) ?? Promise.resolve(false),
    }));

    // 摄像头开关
    useEffect(() => {
      if (!enabled) {
        stopAll();
        setStatus("idle");
        return;
      }
      let cancelled = false;
      setStatus("starting");
      setError("");
      // 预加载人脸检测模型（异步，不阻塞）
      void preloadFaceDetector();

      (async () => {
        try {
          if (!navigator.mediaDevices?.getUserMedia) throw new Error("当前浏览器不支持摄像头调用");
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
          setStatus("live");
        } catch (e: any) {
          if (cancelled) return;
          setStatus("error");
          setError(e?.message || "无法访问摄像头，请检查浏览器权限");
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [enabled, stopAll]);

    // 定时 / 随机抓拍
    useEffect(() => {
      if (!enabled || status !== "live") return;

      if (settings.timedEnabled) {
        timedRef.current = window.setInterval(
          () => captureRef.current?.("timed"),
          Math.max(10, settings.timedIntervalSec) * 1000
        );
      }

      const scheduleRandom = () => {
        const delay = (60 + Math.random() * 120) * 1000;
        randomRef.current = window.setTimeout(() => {
          captureRef.current?.("random");
          if (settingsRef.current.randomEnabled) scheduleRandom();
        }, delay);
      };
      if (settings.randomEnabled) scheduleRandom();

      return () => {
        if (timedRef.current) {
          window.clearInterval(timedRef.current);
          timedRef.current = null;
        }
        if (randomRef.current) {
          window.clearTimeout(randomRef.current);
          randomRef.current = null;
        }
      };
    }, [enabled, status, settings.timedEnabled, settings.timedIntervalSec, settings.randomEnabled]);

    // 实时检测读数（仅用于可视化调试，不写日志）
    useEffect(() => {
      if (!enabled || status !== "live") {
        setLive(null);
        return;
      }
      let stop = false;
      const tick = async () => {
        const v = videoRef.current;
        const drawn = await grabFrame();
        if (!drawn || stop) return;
        const d = await detectFace(drawn.canvas);
        if (stop) return;
        const ok = d.ok && !settingsRef.current.simulateFail;
        setLive({ faces: d.faces, raw: d.raw, score: d.maxScore, t: v ? Number(v.currentTime.toFixed(1)) : 0, brightness: d.brightness });
        setLastFrameUrl(drawn.dataUrl);
        // 主结果标签实时反映当前人脸状态（避免停留在上一次抓拍结果）
        setLastResult(ok ? "pass" : "fail");
        setLastDetect(d.error ? d.error : `人脸 ${d.faces}/${d.raw} · 最高分 ${d.maxScore.toFixed(2)}`);
        setDetectError(d.error || "");
        onFaceStatus?.(ok);
      };
      tick();
      const id = window.setInterval(tick, 1200);
      return () => {
        stop = true;
        window.clearInterval(id);
      };
    }, [enabled, status, grabFrame, onFaceStatus]);

    useEffect(() => () => stopAll(), [stopAll]);

    if (!enabled) return null;

    return (
      <div
        style={{
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 2000,
          width: minimized ? 150 : 230,
          background: "#0b1220",
          borderRadius: 12,
          boxShadow: "0 8px 28px rgba(0,0,0,0.35)",
          overflow: "hidden",
          color: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 8px",
            background: "rgba(255,255,255,0.06)",
          }}
        >
          <Space size={6}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: status === "live" ? "#22c55e" : status === "error" ? "#ef4444" : "#f59e0b",
                display: "inline-block",
              }}
            />
            <Text style={{ color: "#fff", fontSize: 12 }}>人脸监控</Text>
          </Space>
          <Space size={2}>
            <Button type="text" size="small" icon={<MinusOutlined />} style={{ color: "#cbd5e1" }} onClick={() => setMinimized((m) => !m)} />
            <Button type="text" size="small" icon={<CloseOutlined />} style={{ color: "#cbd5e1" }} onClick={onClose} />
          </Space>
        </div>

        {!minimized && (
          <div style={{ position: "relative", width: "100%", aspectRatio: "4 / 3", background: "#000" }}>
            <video
              ref={setVideoEl}
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
                  gap: 6,
                  color: "#fff",
                  fontSize: 12,
                  textAlign: "center",
                  padding: 8,
                }}
              >
                {status === "error" ? (
                  <>
                    <EyeOutlined style={{ fontSize: 24, opacity: 0.6 }} />
                    <span>{error}</span>
                  </>
                ) : (
                  <>
                    <LoadingOutlined style={{ fontSize: 22 }} />
                    <span>正在开启摄像头…</span>
                  </>
                )}
              </div>
            )}
            {lastResult && (
              <div style={{ position: "absolute", left: 6, bottom: 6 }}>
                {lastResult === "pass" ? (
                  <Tag icon={<CheckCircleFilled />} color="green" style={{ margin: 0 }}>识别通过</Tag>
                ) : (
                  <Tag icon={<CloseCircleFilled />} color="red" style={{ margin: 0 }}>识别失败</Tag>
                )}
              </div>
            )}
            {live && (
              <Tag
                color={live.faces > 0 ? "green" : "default"}
                style={{ position: "absolute", top: 6, right: 6, margin: 0 }}
              >
                实时 {live.faces}/{live.raw} · {live.score.toFixed(2)} · t={live.t}s
              </Tag>
            )}
          </div>
        )}

        <div style={{ padding: 8 }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Tooltip title="手动抓拍当前画面">
              <Button size="small" icon={<CameraOutlined />} disabled={status !== "live"} onClick={() => capture("video_playing")}>
                抓拍
              </Button>
            </Tooltip>
          </Space>

          {detectError && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#f87171" }}>{detectError}</div>
          )}
          {!detectError && lastDetect && (
            <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>{lastDetect}</div>
          )}
          {frameSource && (
            <div style={{ marginTop: 2, fontSize: 10, color: "#64748b" }}>帧源: {frameSource}</div>
          )}
          {lastFrameUrl && (
            <div style={{ marginTop: 6, display: "flex", gap: 8, alignItems: "center" }}>
              <img
                src={lastFrameUrl}
                alt="检测帧"
                style={{ width: 80, height: 60, objectFit: "cover", borderRadius: 4, border: "1px solid #334155" }}
              />
              <span style={{ fontSize: 11, color: "#94a3b8" }}>
                检测用帧{live?.brightness != null ? ` · 亮度 ${live.brightness}` : ""}
              </span>
            </div>
          )}

          {!minimized && recent.length > 0 && (
            <div style={{ marginTop: 8, maxHeight: 92, overflowY: "auto" }}>
              {recent.map((r, i) => (
                <div
                  key={i}
                  style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", padding: "2px 0" }}
                >
                  <span>
                    {r.result === "pass" ? "✅" : "❌"} {FACE_SCENE_LABEL[r.scene]}
                  </span>
                  <span>{r.at}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

FaceMonitorDock.displayName = "FaceMonitorDock";

export default FaceMonitorDock;
