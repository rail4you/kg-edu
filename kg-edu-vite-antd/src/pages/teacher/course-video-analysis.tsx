import * as React from "react";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Button,
  Typography,
  Spin,
  Empty,
  Tabs,
  Tag,
  Tree,
  List,
  message,
  Row,
  Col,
} from "antd";
import { ArrowLeftOutlined, FundOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useParams, useNavigate } from "react-router-dom";
import { getCourseVideo, listCourseVideos } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { AppPage } from "@/components/proto";

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

export default function CourseVideoAnalysis() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { videoId } = useParams();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const { data: video } = useQuery({
    queryKey: ["course-video-one", videoId],
    queryFn: async () => {
      const r = await getCourseVideo({
        tenant,
        input: { id: videoId! },
        fields: ["id", "videoUrl", "courseId"],
        headers,
      });
      return r.success ? (r.data as any) : null;
    },
    enabled: !!videoId && !!user,
  });

  // 无 videoId 时展示视频列表入口
  const { data: videoList } = useQuery({
    queryKey: ["course-video-list"],
    queryFn: async () => {
      const r = await listCourseVideos({ tenant, fields: ["id", "name", "courseId"], headers });
      return r.success ? ((r.data as any[]) || []) : [];
    },
    enabled: !videoId && !!user,
  });

  if (!videoId) {
    return (
      <AppPage
        title="AI 章节视频解析 ★"
        description="选择课程视频并发起 AI 章节解析"
        actions={
          <Button
            type="text"
            className="teacher-page-back-btn"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          />
        }
      >
        <Card title="选择要解析的课程视频">
          <List
            dataSource={videoList || []}
            renderItem={(v: any) => (
              <List.Item
                actions={[
                  <Button key="go" type="primary" size="small" onClick={() => navigate(`/teacher/dashboard/course-video-analysis/${v.id}`)}>
                    AI 解析
                  </Button>,
                ]}
              >
                <Text>{v.name} </Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{String(v.id).slice(0, 8)}…</Text>
              </List.Item>
            )}
          />
        </Card>
      </AppPage>
    );
  }

  const fetchAnalysis = async () => {
    const r = await fetch(`/api/video-analysis/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({
        tenant,
        videoType: "course_video",
        videoId,
        courseId: video?.courseId,
      }),
    });
    return r.json();
  };

  const [result, setResult] = useState<any>(null);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  const startAnalyze = async () => {
    setAnalyzing(true);
    try {
      const r = await fetchAnalysis();
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
      `/api/video-analysis/none/marks?tenant=${encodeURIComponent(tenant)}&videoId=${videoId}`,
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

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

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
    <AppPage
      title="AI 章节视频解析"
      description="自动生成视频摘要、分段总结与知识点打点"
      actions={
        <>
          <Button
            type="text"
            className="teacher-page-back-btn"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
          />
          {status && <Tag color={status === "done" ? "green" : status === "failed" ? "red" : "processing"}>{status}</Tag>}
          <Button type="primary" icon={<FundOutlined />} loading={analyzing} onClick={startAnalyze}>
            发起 AI 解析
          </Button>
        </>
      }
    >
      <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card title="视频">
              {video?.videoUrl ? (
                <video ref={videoRef} controls style={{ width: "100%", borderRadius: 8 }} preload="metadata">
                  <source src={video.videoUrl} type="video/mp4" />
                </video>
              ) : (
                <Empty description="视频加载中…" />
              )}
            </Card>
            <Card title={`知识点打点（${marks.length}）`} style={{ marginTop: 16 }}>
              {marks.length === 0 ? (
                <Empty description="解析完成后自动打点" />
              ) : (
                <List
                  size="small"
                  dataSource={marks}
                  renderItem={(m) => (
                    <List.Item
                      actions={[
                        <Button key="seek" type="link" icon={<ClockCircleOutlined />} onClick={() => seek(m.point_sec)}>
                          {fmtTime(m.point_sec)} 定位播放
                        </Button>,
                      ]}
                    >
                      <Tag color="blue">{fmtTime(m.point_sec)}</Tag>
                      <Text>{m.label}</Text>
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card>
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
            </Card>
          </Col>
        </Row>
    </AppPage>
  );
}
