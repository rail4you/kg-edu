import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
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
  Progress,
  Skeleton,
  Space,
  Tooltip,
} from "antd";
import {
  FundOutlined,
  ClockCircleOutlined,
  CheckCircleTwoTone,
  CloseCircleTwoTone,
  LoadingOutlined,
} from "@ant-design/icons";

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

const statusPercent = (status: string | null) => {
  switch (status) {
    case "done":
    case "failed":
      return 100;
    case "processing":
      return 60;
    case "pending":
      return 20;
    default:
      return 0;
  }
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

  const busy = analyzing || status === "pending" || status === "processing";
  const percent = statusPercent(status);

  const fetchMarks = React.useCallback(async () => {
    const r = await fetch(
      `/api/video-analysis/none/marks?tenant=${encodeURIComponent(tenant)}&videoType=${encodeURIComponent("video")}&videoId=${encodeURIComponent(videoId)}`,
      { headers: { ...headers } },
    ).then((x) => x.json());
    if (r.success) setMarks(r.data || []);
  }, [tenant, videoId, headers]);

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
        message.error("视频解析错误");
        return;
      }
    }
    message.warning("解析超时，请稍后刷新查看");
  };

  const loadExisting = React.useCallback(async () => {
    const r = await fetch(
      `/api/video-analysis/by-video?tenant=${encodeURIComponent(tenant)}&videoType=${encodeURIComponent("video")}&videoId=${encodeURIComponent(videoId)}`,
      { headers: { ...headers } },
    ).then((x) => x.json());
    if (r.success && r.data) {
      setStatus(r.data.status);
      if (r.data.status === "done") {
        const full = await fetch(`/api/video-analysis/${r.data.id}`, {
          headers: { ...headers, "x-org-schema": tenant },
        }).then((x) => x.json());
        if (full.success) setResult(full.data);
      } else if (r.data.status === "pending" || r.data.status === "processing") {
        pollStatus(r.data.id);
      }
    }
    fetchMarks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, videoId, headers, fetchMarks]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setMarks([]);
      setStatus(null);
      setAnalyzing(false);
      return;
    }
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, videoId]);

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
      setStatus("pending");
      message.success("解析任务已发起，处理中…");
      pollStatus(r.analysis_id);
    } finally {
      setAnalyzing(false);
    }
  };

  const seek = (sec: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = sec;
      videoRef.current.play().catch(() => {});
    }
  };

  const segments: Segment[] = result?.segments || [];
  const rawWordcloud: Array<{ word: string; weight: number }> = result?.wordcloud || [];

  // 知识点词云去重：按词取最大权重
  const wordcloud = useMemo(() => {
    const map = new Map<string, number>();
    rawWordcloud.forEach((w) => {
      const word = (w.word || "").trim();
      if (!word) return;
      map.set(word, Math.max(map.get(word) ?? 0, w.weight || 0));
    });
    return Array.from(map, ([word, weight]) => ({ word, weight })).sort(
      (a, b) => b.weight - a.weight,
    );
  }, [rawWordcloud]);

  // 知识点打点去重：同一知识点只保留第一次出现
  const uniqueMarks = useMemo(() => {
    const seen = new Set<string>();
    const out: Mark[] = [];
    for (const m of [...marks].sort((a, b) => a.point_sec - b.point_sec)) {
      const key = m.knowledge_resource_id || m.label;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
    return out;
  }, [marks]);

  const maxW = Math.max(1, ...wordcloud.map((w) => w.weight));

  const treeData = [
    {
      title: `视频摘要：${(result?.summary || "（待解析）").slice(0, 60)}`,
      key: "root",
      children: segments.map((s, i) => ({
        title: `${fmtTime(s.start_sec)}-${fmtTime(s.end_sec)} ${s.title}`,
        key: `seg-${i}`,
        children: uniqueMarks
          .filter((m) => m.point_sec >= s.start_sec && m.point_sec < s.end_sec)
          .map((m) => ({ title: `📌 ${fmtTime(m.point_sec)} ${m.label}`, key: m.id })),
      })),
    },
  ];

  const tabItems = [
    {
      key: "summary",
      label: "摘要",
      children: result?.summary ? (
        <Paragraph style={{ marginBottom: 0 }}>{result.summary}</Paragraph>
      ) : (
        <Empty description="点击右上「发起 AI 解析」" />
      ),
    },
    {
      key: "segments",
      label: `分段总结（${segments.length}）`,
      children: (
        <List
          size="small"
          dataSource={segments}
          locale={{ emptyText: <Empty description="暂无" /> }}
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
      key: "outline",
      label: "视频大纲",
      children:
        segments.length === 0 ? (
          <Empty description="暂无" />
        ) : (
          <Tree treeData={treeData} defaultExpandAll showLine />
        ),
    },
    {
      key: "wordcloud",
      label: `知识点词云（${wordcloud.length}）`,
      children:
        wordcloud.length === 0 ? (
          <Empty description="暂无" />
        ) : (
          <div style={{ lineHeight: 2.2 }}>
            {wordcloud.map((w) => (
              <Tag
                key={w.word}
                color={w.weight >= maxW * 0.6 ? "red" : w.weight >= maxW * 0.3 ? "orange" : "blue"}
                style={{
                  fontSize: 12 + Math.round((w.weight / maxW) * 8),
                  lineHeight: 1.6,
                  height: "auto",
                  padding: "3px 10px",
                  margin: 4,
                  whiteSpace: "normal",
                }}
              >
                {w.word}×{w.weight}
              </Tag>
            ))}
          </div>
        ),
    },
    {
      key: "marks",
      label: `知识点打点（${uniqueMarks.length}）`,
      children:
        uniqueMarks.length === 0 ? (
          <Empty description="解析完成后自动打点" />
        ) : (
          <List
            size="small"
            dataSource={uniqueMarks}
            renderItem={(m) => (
              <List.Item
                actions={[
                  <Button
                    key="seek"
                    type="link"
                    icon={<ClockCircleOutlined />}
                    onClick={() => seek(m.point_sec)}
                  >
                    定位
                  </Button>,
                ]}
              >
                <Tag color="blue">{fmtTime(m.point_sec)}</Tag>
                <Text>{m.label}</Text>
              </List.Item>
            )}
          />
        ),
    },
  ];

  return (
    <Drawer
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>AI 视频解析{videoTitle ? `：${videoTitle}` : ""}</span>
          {status && (
            <Tooltip title={status === "done" ? "解析完成" : status === "failed" ? "解析失败" : "解析中"}>
              {status === "done" ? (
                <CheckCircleTwoTone twoToneColor="#52c41a" style={{ fontSize: 16 }} />
              ) : status === "failed" ? (
                <CloseCircleTwoTone twoToneColor="#ff4d4f" style={{ fontSize: 16 }} />
              ) : (
                <LoadingOutlined style={{ fontSize: 16, color: "#1677ff" }} />
              )}
            </Tooltip>
          )}
        </div>
      }
      open={open}
      onClose={onClose}
      width={980}
      destroyOnClose
      extra={
        <Button
          type="primary"
          icon={<FundOutlined />}
          loading={analyzing}
          disabled={busy}
          onClick={startAnalyze}
        >
          发起 AI 解析
        </Button>
      }
    >
      {(busy || status === "done" || status === "failed") && (
        <div style={{ marginBottom: 16 }}>
          <Progress
            percent={percent}
            status={
              status === "failed" ? "exception" : status === "done" ? "success" : "active"
            }
            size="small"
          />
          {busy && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              AI 正在解析视频（转写 / 分段 / 知识点抽取），请稍候…
            </Text>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* 视频播放器 */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <div
            style={{
              width: "100%",
              maxWidth: 640,
              borderRadius: 10,
              overflow: "hidden",
              background: "#000",
            }}
          >
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
        </div>

        {/* 解析结果 */}
        {busy ? (
          <Spin tip="AI 解析中…">
            <Space direction="vertical" style={{ width: "100%" }} size={16}>
              <Skeleton active title paragraph={{ rows: 3 }} />
              <Skeleton active title={false} paragraph={{ rows: 3 }} />
            </Space>
          </Spin>
        ) : (
          <Tabs defaultActiveKey="summary" items={tabItems} />
        )}
      </div>
    </Drawer>
  );
}
