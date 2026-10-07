import { useEffect, useMemo, useState } from "react";
import { Tabs, Empty, Tag, Tree, List, Typography, Button, Skeleton, Divider } from "antd";
import { ClockCircleOutlined, FundOutlined } from "@ant-design/icons";

const { Text, Paragraph, Title } = Typography;

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

interface VideoAnalysisPanelProps {
  videoId: string;
  tenant: string;
  headers: Record<string, string>;
  onSeek?: (sec: number) => void;
}

/** 学生端：只读展示某视频的 AI 解析结果（摘要 / 分段总结 / 视频大纲 / 知识点词云） */
export default function VideoAnalysisPanel({
  videoId,
  tenant,
  headers,
  onSeek,
}: VideoAnalysisPanelProps) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<any | null>(null);
  const [marks, setMarks] = useState<Mark[]>([]);

  useEffect(() => {
    let active = true;
    if (!videoId || !tenant) {
      setResult(null);
      setMarks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const qs = `tenant=${encodeURIComponent(tenant)}&videoType=video&videoId=${encodeURIComponent(videoId)}`;
      const [meta, marksRes] = await Promise.all([
        fetch(`/api/video-analysis/by-video?${qs}`, { headers }).then((r) => r.json()).catch(() => null),
        fetch(`/api/video-analysis/none/marks?${qs}`, { headers }).then((r) => r.json()).catch(() => null),
      ]);
      if (!active) return;
      if (marksRes?.success) setMarks(marksRes.data || []);

      const info = meta?.data;
      if (info?.status === "done") {
        const full = await fetch(`/api/video-analysis/${info.id}`, {
          headers: { ...headers, "x-org-schema": tenant },
        })
          .then((r) => r.json())
          .catch(() => null);
        if (active && full?.success) setResult(full.data);
      } else {
        setResult(null);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, tenant]);

  const segments: Segment[] = result?.segments || [];
  const rawWordcloud: Array<{ word: string; weight: number }> = result?.wordcloud || [];

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

  if (loading) {
    return <Skeleton active paragraph={{ rows: 4 }} />;
  }

  // 无解析结果时学生端不显示该区块
  if (!result) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <Divider style={{ margin: "12px 0" }} />
      <Title level={5} style={{ margin: "0 0 8px", display: "flex", alignItems: "center", gap: 8 }}>
        <FundOutlined style={{ color: "#2573E6" }} />
        AI 解析
      </Title>
      <Tabs
        size="small"
        defaultActiveKey="summary"
        items={[
          {
            key: "summary",
            label: "摘要",
            children: result.summary ? <Paragraph>{result.summary}</Paragraph> : <Empty description="暂无" />,
          },
          {
            key: "segments",
            label: `分段总结（${segments.length}）`,
            children: (
              <List
                size="small"
                dataSource={segments}
                locale={{ emptyText: "暂无" }}
                renderItem={(s) => (
                  <List.Item
                    actions={
                      onSeek
                        ? [
                            <Button key="seek" type="link" onClick={() => onSeek(s.start_sec)}>
                              {fmtTime(s.start_sec)} 观看
                            </Button>,
                          ]
                        : undefined
                    }
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
        ]}
      />
      {uniqueMarks.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            知识点打点（{uniqueMarks.length}）
          </Text>
          <div style={{ marginTop: 6 }}>
            {uniqueMarks.slice(0, 20).map((m) => (
              <Tag
                key={m.id}
                color="blue"
                style={{ margin: 4, cursor: onSeek ? "pointer" : "default" }}
                onClick={() => onSeek?.(m.point_sec)}
              >
                <ClockCircleOutlined /> {fmtTime(m.point_sec)} {m.label}
              </Tag>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
