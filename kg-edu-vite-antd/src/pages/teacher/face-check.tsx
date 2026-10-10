import * as React from "react";
import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Tag, Space, Select, Switch, InputNumber,
  message, List, Row, Col, Alert,
} from "antd";
import { ArrowLeftOutlined, CameraOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import { logFaceCheck, listFaceChecks } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { uploadFileViaServer } from "@/lib/oss-upload";
import { AppPage } from "@/components/proto";

const { Text } = Typography;

type Scene = "entry" | "video_start" | "video_playing" | "video_resume" | "video_end" | "timed" | "random";
const SCENES: Array<{ value: Scene; label: string }> = [
  { value: "entry", label: "进入课程" },
  { value: "video_start", label: "视频起始" },
  { value: "video_playing", label: "播放中" },
  { value: "video_resume", label: "暂停再播放" },
  { value: "video_end", label: "视频结束" },
  { value: "timed", label: "定时抓拍" },
  { value: "random", label: "随机抓拍" },
];

export default function FaceCheck() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [timedEnabled, setTimedEnabled] = useState(true);
  const [timedMinutes, setTimedMinutes] = useState(10);
  const [randomEnabled, setRandomEnabled] = useState(true);
  const [failMode, setFailMode] = useState<"record" | "block">("record");
  const [blocked, setBlocked] = useState(false);
  const [capturing, setCapturing] = useState(false);

  const { data: logs, refetch } = useQuery({
    queryKey: ["face-logs"],
    queryFn: async () => {
      const r = await listFaceChecks({ tenant, fields: ["id", "scene", "result", "snapshotUrl"] as any, headers });
      const rows = r.success ? ((r.data as any[]) || []) : [];
      return rows.slice(0, 50);
    },
    enabled: !!user,
  });

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
    } catch {
      message.error("无法打开摄像头（演示可用上传快照代替）");
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  };

  useEffect(() => () => stopCamera(), []);

  // 定时抓拍（演示：按分钟计；随机抓拍：每次 checkpoint 30% 概率附加一次）
  useEffect(() => {
    if (!cameraOn || !timedEnabled) return;
    const timer = setInterval(() => capture("timed"), timedMinutes * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, timedEnabled, timedMinutes]);

  const capture = async (scene: Scene, simulatedFail = false) => {
    setCapturing(true);
    try {
      let snapshotUrl: string | undefined;
      if (videoRef.current && cameraOn) {
        const canvas = canvasRef.current!;
        canvas.width = videoRef.current.videoWidth || 640;
        canvas.height = videoRef.current.videoHeight || 480;
        canvas.getContext("2d")!.drawImage(videoRef.current, 0, 0);
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.8));
        if (blob) {
          const file = new File([blob], `face_${Date.now()}.jpg`, { type: "image/jpeg" });
          snapshotUrl = (await uploadFileViaServer(file)).url;
        }
      }
      // 演示判定：可手动模拟失败；真实 1:N 比对需对接人脸厂商 SDK（预留）
      const pass = !simulatedFail;
      await logFaceCheck({
        tenant,
        fields: ["id"] as any,
        input: {
          userId: user?.id,
          scene,
          result: pass ? "pass" : "fail",
          snapshotUrl,
          note: pass ? "抓拍正常" : "演示模拟识别失败",
        },
        headers,
      });
      if (!pass) {
        if (failMode === "block") {
          setBlocked(true);
          message.error("识别失败：已按配置阻止继续学习");
        } else {
          message.warning("识别失败：已记录并允许继续学习");
        }
      } else {
        message.success(`抓拍成功（${SCENES.find((s) => s.value === scene)?.label}）`);
        if (randomEnabled && ["video_playing", "video_start"].includes(scene) && Math.random() < 0.3) {
          capture("random");
        }
      }
      refetch();
    } catch {
      message.error("抓拍失败");
    } finally {
      setCapturing(false);
    }
  };

  if (authLoading) {
    return (
      <AppPage className="face-check-wrap" title="人脸识别与抓拍演示" description="加载中">
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage
      className="face-check-wrap"
      title="人脸识别与抓拍演示"
      description="摄像头抓拍与识别策略演示"
      actions={
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate(-1)}
        />
      }
    >
      {blocked && (
        <Alert
          type="error"
          showIcon
          message="当前处于阻止学习状态（识别失败 + 不允许学习模式）"
          action={<Button size="small" onClick={() => { setBlocked(false); capture("entry"); }}>重新验证</Button>}
          style={{ marginBottom: 16 }}
        />
      )}
      <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title="实时画面">
              <video ref={videoRef} style={{ width: "100%", borderRadius: 8, background: "#000" }} muted playsInline />
              <canvas ref={canvasRef} style={{ display: "none" }} />
              <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                {!cameraOn ? (
                  <Button icon={<VideoCameraOutlined />} onClick={startCamera}>打开摄像头</Button>
                ) : (
                  <Button onClick={stopCamera}>关闭摄像头</Button>
                )}
              </div>
              <div style={{ marginTop: 12 }}>
                <Text strong>节点抓拍：</Text>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                  {SCENES.filter((s) => !["timed", "random"].includes(s.value)).map((s) => (
                    <Button key={s.value} size="small" icon={<CameraOutlined />} loading={capturing} onClick={() => capture(s.value)}>
                      {s.label}
                    </Button>
                  ))}
                  <Button size="small" danger loading={capturing} onClick={() => capture("video_playing", true)}>
                    模拟识别失败
                  </Button>
                </div>
              </div>
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title="抓拍策略配置">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <Text>定时抓拍（每 N 分钟）</Text>
                <Space>
                  <InputNumber value={timedMinutes} onChange={(v) => setTimedMinutes(v || 10)} min={1} max={60} disabled={!timedEnabled} />
                  <Switch checked={timedEnabled} onChange={setTimedEnabled} />
                </Space>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <Text>随机抓拍（播放中按概率触发）</Text>
                <Switch checked={randomEnabled} onChange={setRandomEnabled} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <Text>识别失败处理</Text>
                <Select value={failMode} onChange={setFailMode} style={{ width: 190 }} options={[
                  { value: "record", label: "记录并继续学习" },
                  { value: "block", label: "不允许学习" },
                ]} />
              </div>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginTop: 8 }}>
                说明：演示用人脸呈现性检测 + 快照存证；1:N 身份比对需对接人脸厂商 SDK（接口已预留 note/result 字段）。
              </Text>
            </Card>
            <Card title="抓拍记录" style={{ marginTop: 16 }}>
              <List
                size="small"
                dataSource={logs || []}
                renderItem={(l: any) => (
                  <List.Item>
                    <Tag color={l.result === "pass" ? "green" : "red"}>{l.result === "pass" ? "通过" : "失败"}</Tag>
                    <Text style={{ fontSize: 12 }}>{SCENES.find((s) => s.value === l.scene)?.label || l.scene}</Text>
                    {l.snapshotUrl && <a href={l.snapshotUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, marginLeft: 8 }}>快照</a>}
                  </List.Item>
                )}
              />
            </Card>
          </Col>
        </Row>
    </AppPage>
  );
}
