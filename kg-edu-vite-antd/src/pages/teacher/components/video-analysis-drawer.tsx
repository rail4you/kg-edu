import * as React from "react";
import { useEffect, useRef, useState } from "react";
import {
  Drawer,
  Tabs,
  Empty,
  Tag,
  Tree,
  List,
  Button,
  Typography,
  message,
  Spin,
} from "antd";
import { FundOutlined, ClockCircleOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface Segment {
  start_sec: number;
  end_sec: number;
  title: string;
  summary: string;
}

interface Mark {
  id: string;
  point_sec: number;
  label: string;
  knowledge_resource_id: string;
}

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

interface VideoAnalysisDrawerProps {
  open: boolean;
  onClose: () => void;
  videoId: string;
  videoUrl?: string | null;
  videoTitle?: string;
  courseId?: string | null;
  tenant: string;
  headers: Record<string, string>;
}

export default function VideoAnalysisDrawer({
  open,
  onClose,
  videoId,
  videoUrl,
  videoTitle,
  courseId,
  tenant,
  headers,
}: VideoAnalysisDrawerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setMarks([]);
      setStatus(null);
      setAnalyzing(false);
    }
  }, [open]);

  const startAnalyze = async () => {
    setAnalyzing(true);
    try {
      const r = await fetch(`/api/video-analysis/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          tenant,
          videoType: "video",
          videoId,
          courseId: courseId || undefined,
        }),
      }).then((x) => x.json());
      if (!r.success) {
        message.error(r.error || "发起解析失败");
        return;
      }
      message.success("解析任务已发起，处理中…");
      pollStatus(r.analysis_id);
    } finally {
      setAnalyzing(false);
    }
  };

  const pollStatus = async (analysisId: string) => {
    for (let i = 0; i < 120; i++) {
      await new Promise((res) => setTimeout(res, 5000));
      const r = await fetch(`/api/video-analysis/${analysisId}`, {
        headers: { ...headers, "x-org-schema": tenant },
      }).then((x) => x.json());
      if (!r.success) continue;
      setStatus(r.data.status);
      if (r.data.status === "done") {
        setResult(r.data);
        fetchMarks();
        message.success("视频解析完成");
        return;
      }
      if (r.data.status === "failed") {
        message.error(r.data.error_message || "解析失败");
        return;
      }
    }
    message.warning("解析超时，请稍后刷新查看");
  };

  const fetchMarks = async () => {
    const r = await fetch(
      `/api/video-analysis/none/marks?tenant=${encodeURIComponent(tenant)}&videoType=${encodeURIComponent("video")}&videoId=${encodeURIComponent(videoId)}`,
      { headers: { ...headers } },
    ).then((x) => x.json());
    if (r.success) setMarks(r.data || []);
  };

  const seek = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  const segments: Segment[] = result?.segments || [];
  const wordcloud: Array<{ word: string; weight: number }> = result?.wordcloud || [];
  const maxW = Math.max(1, ...wordcloud.map((w) => w.weight));

  const treeData = [
    {
      title: `视频摘要：${(result?.summary || "（待解析）").slice(0, 60)}`,
      key: "root",
      children: segments.map((s, i) => ({
        title: `${fmtTime(s.start_sec)}-${fmtTime(s.end_sec)} ${s.title}`,
        key: `seg-${i}`,
        children: marks
          .filter((m) => m.point_sec >= s.start_sec && m.point_sec < s.end_sec)
          .map((m) => ({ title: `📌 ${fmtTime(m.point_sec)} ${m.label}`, key: m.id })),
      })),
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>AI 视频解析{videoTitle ? `：${videoTitle}` : ""}</span>
          {status && (
            <Tag color={status === "done" ? "green" : status === "failed" ? "red" : "processing"}>
              {status}
            </Tag>
          )}
        </div>
      }
      open={open}
      onClose={onClose}
      width={920}
      destroyOnClose
      extra={
        <Button
          type="primary"
          icon={<FundOutlined />}
          loading={analyzing}
          onClick={startAnalyze}
        >
          发起 AI 解析
        </Button>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div>
          <div style={{ borderRadius: 8, overflow: "hidden", background: "#000" }}>
            {videoUrl ? (
              <video
                ref={videoRef}
                controls
                style={{ width: "100%", display: "block" }}
                preload="metadata"
              >
                <source src={videoUrl} type="video/mp4" />
              </video>
            ) : (
              <div style={{ padding: 32, color: "#999", textAlign: "center" }}>
                视频 URL 缺失
              </div>
            )}
          </div>
          <Typography.Title level={5} style={{ marginTop: 16 }}>
            知识点打点（{marks.length}）
          </Typography.Title>
          {marks.length === 0 ? (
            <Empty description="解析完成后自动打点" />
          ) : (
            <List
              size="small"
              dataSource={marks}
              renderItem={(m) => (
                <List.Item
                  actions={[
                    <Button
                      key="seek"
                      type="link"
                      icon={<ClockCircleOutlined />}
                      onClick={() => seek(m.point_sec)}
                    >
                      {fmtTime(m.point_sec)} 定位
                    </Button>,
                  ]}
                >
                  <Tag color="blue">{fmtTime(m.point_sec)}</Tag>
                  <Text>{m.label}</Text>
                </List.Item>
              )}
            />
          )}
        </div>
        <div>
          <Tabs
            defaultActiveKey="summary"
            items={[
              {
                key: "summary",
                label: "摘要",
                children: result?.summary ? (
                  <Paragraph>{result.summary}</Paragraph>
                ) : (
                  <Empty description="点击右上「发起 AI 解析」" />
                ),
              },
              {
                key: "segments",
                label: `分段总结（${segments.length}）`,
                children: (
                  <List
                    dataSource={segments}
                    renderItem={(s) => (
                      <List.Item
                        actions={[
                          <Button key="seek" type="link" onClick={() => seek(s.start_sec)}>
                            {fmtTime(s.start_sec)} 观看
                          </Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={`${fmtTime(s.start_sec)} - ${fmtTime(s.end_sec)}　${s.title}`}
                          description={s.summary}
                        />
                      </List.Item>
                    )}
                  />
                ),
              },
              {
                key: "mindmap",
                label: "思维导图",
                children:
                  segments.length === 0 ? (
                    <Empty description="暂无" />
                  ) : (
                    <Tree treeData={treeData} defaultExpandAll showLine />
                  ),
              },
              {
                key: "wordcloud",
                label: "知识点词云",
                children:
                  wordcloud.length === 0 ? (
                    <Empty description="暂无" />
                  ) : (
                    <div style={{ lineHeight: 2.4 }}>
                      {wordcloud.map((w) => (
                        <Tag
                          key={w.word}
                          color={w.weight >= maxW * 0.6 ? "red" : w.weight >= maxW * 0.3 ? "orange" : "blue"}
                          style={{ fontSize: 12 + Math.round((w.weight / maxW) * 14), margin: 4 }}
                        >
                          {w.word}×{w.weight}
                        </Tag>
                      ))}
                    </div>
                  ),
              },
            ]}
          />
        </div>
      </div>
    </Drawer>
  );
}
