import * as React from "react";
import { Button, Progress, Space, Table, Tag, Typography, Empty } from "antd";
import { ReloadOutlined, FundOutlined, EyeOutlined } from "@ant-design/icons";

const { Text } = Typography;

export interface AnalysisTask {
  id: string;
  video_id: string;
  status: string;
  summary?: string | null;
  error_message?: string | null;
  inserted_at?: string;
  updated_at?: string;
}

interface VideoLike {
  id: string;
  title?: string;
}

interface VideoAnalysisTasksProps {
  videos: VideoLike[];
  courseId?: string | null;
  tenant: string;
  headers: Record<string, string>;
  onOpenAnalysis: (video: VideoLike) => void;
}

const statusMeta = (status?: string) => {
  switch (status) {
    case "done":
      return { label: "已完成", color: "green", percent: 100, progressStatus: "success" as const };
    case "failed":
      return { label: "失败", color: "red", percent: 100, progressStatus: "exception" as const };
    case "processing":
      return { label: "解析中", color: "processing", percent: 60, progressStatus: "active" as const };
    case "pending":
      return { label: "排队中", color: "orange", percent: 20, progressStatus: "active" as const };
    default:
      return { label: "未解析", color: "default", percent: 0, progressStatus: "normal" as const };
  }
};

export default function VideoAnalysisTasks({
  videos,
  courseId,
  tenant,
  headers,
  onOpenAnalysis,
}: VideoAnalysisTasksProps) {
  const [tasks, setTasks] = React.useState<Record<string, AnalysisTask>>({});
  const [loading, setLoading] = React.useState(false);
  const [triggering, setTriggering] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!tenant) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ tenant });
      if (courseId) qs.set("courseId", courseId);
      const r = await fetch(`/api/video-analysis?${qs.toString()}`, {
        headers,
        cache: "no-store",
      }).then((x) => x.json());
      if (r.success) {
        const map: Record<string, AnalysisTask> = {};
        (r.data || []).forEach((a: AnalysisTask) => {
          if (!map[a.video_id]) map[a.video_id] = a;
        });
        setTasks(map);
      }
    } finally {
      setLoading(false);
    }
  }, [tenant, courseId, headers]);

  React.useEffect(() => {
    load();
  }, [load]);

  // 有进行中的任务时轮询
  React.useEffect(() => {
    const hasActive = Object.values(tasks).some(
      (t) => t.status === "pending" || t.status === "processing",
    );
    if (!hasActive) return;
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
  }, [tasks, load]);

  const triggerAnalyze = async (video: VideoLike) => {
    setTriggering(video.id);
    try {
      await fetch(`/api/video-analysis/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ tenant, videoType: "video", videoId: video.id, courseId: courseId || undefined }),
      });
      await load();
    } finally {
      setTriggering(null);
    }
  };

  if (videos.length === 0) {
    return <Empty description="请先选择课程" style={{ padding: "48px 0" }} />;
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={load}>
          刷新
        </Button>
      </div>
      <Table
        className="theme-table"
        rowKey="id"
        dataSource={videos}
        pagination={{ pageSize: 10, showTotal: (t) => `共 ${t} 条` }}
        columns={[
          {
            title: "视频",
            dataIndex: "title",
            render: (t: string, v: VideoLike) => <Text strong>{t || v.id}</Text>,
          },
          {
            title: "解析进度",
            width: 240,
            render: (_, v: VideoLike) => {
              const task = tasks[v.id];
              const meta = statusMeta(task?.status);
              return (
                <Space direction="vertical" size={2} style={{ width: "100%" }}>
                  <Space>
                    <Tag color={meta.color}>{meta.label}</Tag>
                    {task?.status === "failed" && (
                      <Text type="danger" style={{ fontSize: 12 }}>
                        视频解析错误
                      </Text>
                    )}
                  </Space>
                  <Progress
                    percent={meta.percent}
                    status={meta.progressStatus}
                    size="small"
                    style={{ margin: 0 }}
                  />
                </Space>
              );
            },
          },
          {
            title: "更新时间",
            width: 180,
            render: (_, v: VideoLike) => {
              const t = tasks[v.id]?.updated_at;
              return t ? <Text type="secondary" style={{ fontSize: 12 }}>{new Date(t).toLocaleString("zh-CN")}</Text> : "-";
            },
          },
          {
            title: "操作",
            width: 180,
            render: (_, v: VideoLike) => {
              const task = tasks[v.id];
              const active = task?.status === "pending" || task?.status === "processing";
              return (
                <Space>
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<FundOutlined />}
                    loading={triggering === v.id}
                    disabled={active}
                    onClick={() => triggerAnalyze(v)}
                  >
                    {task ? "重新解析" : "发起解析"}
                  </Button>
                  <Button size="small" icon={<EyeOutlined />} onClick={() => onOpenAnalysis(v)}>
                    查看
                  </Button>
                </Space>
              );
            },
          },
        ]}
      />
    </div>
  );
}
