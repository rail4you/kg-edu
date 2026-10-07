import * as React from "react";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Input, Tabs, Tag, Space, message,
  List, Avatar, Divider, Table,
} from "antd";
import { ArrowLeftOutlined, SearchOutlined, StarOutlined, StarFilled, SendOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useNavigate } from "react-router-dom";
import { followResearch, listFollowsByUser, unfollowResearch } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text, Paragraph } = Typography;

/** 各栏目的示例数据（真实可检索/可追踪的学术条目） */
const EXAMPLE_INTERESTS = [
  "知识图谱",
  "大语言模型",
  "计算机视觉",
  "强化学习",
  "联邦学习",
];
const EXAMPLE_SCHOLARS = ["周志华", "张钹", "姚期智", "李飞飞"];
const EXAMPLE_VENUES = ["中国科学", "计算机学报", "软件学报", "自动化学报", "清华大学学报"];

function followTypeLabel(kind: string) {
  return kind === "scholar" ? "学者" : kind === "venue" ? "期刊" : "研究兴趣";
}
function followTypeColor(kind: string) {
  return kind === "scholar" ? "gold" : kind === "venue" ? "green" : "purple";
}
function followDetail(f: any) {
  const ex = f.extra || {};
  if (f.kind === "scholar") {
    const parts: string[] = [];
    if (ex.affiliation) parts.push(ex.affiliation);
    if (ex.works != null) parts.push(`论文 ${ex.works}`);
    if (ex.cited != null) parts.push(`被引 ${ex.cited}`);
    if (Array.isArray(ex.topics) && ex.topics.length) parts.push(ex.topics.join("、"));
    return parts.length ? parts.join(" · ") : "学者";
  }
  if (f.kind === "venue") {
    return ex.works != null ? `收录 ${ex.works} 篇` : "期刊";
  }
  const parts: string[] = [];
  if (Array.isArray(ex.authors) && ex.authors.length) parts.push(ex.authors.join(", "));
  if (ex.venue) parts.push(ex.venue);
  if (ex.year) parts.push(ex.year);
  if (ex.cited != null) parts.push(`被引 ${ex.cited}`);
  return parts.length ? parts.join(" · ") : "研究作品";
}

export default function ResearchTrack() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  // —— 兴趣 ——
  const [interest, setInterest] = useState("知识图谱");
  const [works, setWorks] = useState<any[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [exampleLoading, setExampleLoading] = useState(false);

  // —— 学者 ——
  const [scholarName, setScholarName] = useState("");
  const [authors, setAuthors] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [twinMsgs, setTwinMsgs] = useState<Array<{ role: string; content: string }>>([]);
  const [twinInput, setTwinInput] = useState("");
  const [twinLoading, setTwinLoading] = useState(false);

  // —— 期刊 ——
  const [venue, setVenue] = useState("中国科学");
  const [digest, setDigest] = useState<any>(null);
  const [digestLoading, setDigestLoading] = useState(false);

  // —— 进入页面自动加载各栏目示例（真实数据） ——
  useEffect(() => {
    if (!user) return;
    doSearchWorks();
    loadExampleScholars();
    setVenue(EXAMPLE_VENUES[0]);
  }, [user]);

  const loadExampleScholars = async () => {
    setExampleLoading(true);
    try {
      const seen = new Set<string>();
      const all: any[] = [];
      for (const name of EXAMPLE_SCHOLARS) {
        try {
          const r = await api(`/search?type=authors&query=${encodeURIComponent(name)}&limit=2`);
          for (const a of r?.data?.authors || []) {
            if (!seen.has(a.id)) {
              seen.add(a.id);
              all.push(a);
            }
          }
        } catch { /* 忽略单个示例加载失败 */ }
      }
      setAuthors(all.slice(0, 8));
    } finally {
      setExampleLoading(false);
    }
  };

  const { data: follows, refetch: refetchFollows } = useQuery({
    queryKey: ["research-follows"],
    queryFn: async () => {
      if (!user?.id) return [];
      const r = await listFollowsByUser({ tenant, input: { userId: user.id }, fields: ["id", "kind", "label", "refId", "extra"], headers });
      return r.success ? (r.data as any[]) : [];
    },
    enabled: !!user?.id,
  });

  const api = async (path: string, opts?: any) => {
    const url = `/api/track${path}`;
    const r = await fetch(url, { headers: { ...headers, "x-org-schema": tenant }, ...(opts || {}) }).then((x) => x.json());
    return r;
  };

  const doSearchWorks = async (q?: string) => {
    const query = (q ?? interest).trim();
    if (!query) return;
    setSearching(true);
    try {
      const r = await api(`/search?type=works&query=${encodeURIComponent(query)}`);
      if (r.success) {
        setWorks(r.data.works || []);
        setTopics(r.data.topics || []);
      } else message.error(r.error || "检索失败");
    } finally {
      setSearching(false);
    }
  };

  const doSearchAuthors = async () => {
    if (!scholarName.trim()) return;
    setSearching(true);
    try {
      const r = await api(`/search?type=authors&query=${encodeURIComponent(scholarName)}`);
      if (r.success) setAuthors(r.data.authors || []);
      else message.error(r.error || "检索失败");
    } finally {
      setSearching(false);
    }
  };

  const loadProfile = async (openalexId: string) => {
    setSearching(true);
    try {
      const r = await api(`/author?openalex_id=${encodeURIComponent(openalexId)}`);
      if (r.success) {
        setProfile(r.data);
        setTwinMsgs([{ role: "ai", content: `我是${r.data.name}的学术数字分身，可以问我研究方向与学术观点。` }]);
      } else message.error(r.error || "画像失败");
    } finally {
      setSearching(false);
    }
  };

  const twinSend = async () => {
    const text = twinInput.trim();
    if (!text || !profile || twinLoading) return;
    setTwinInput("");
    setTwinMsgs((m) => [...m, { role: "user", content: text }]);
    setTwinLoading(true);
    try {
      // 分身 persona 经服务端组装后由大模型回答；无 Key 时降级走通用对话
      const r = await fetch("/api/track/twin-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ tenant, openalex_id: profile.id, message: text }),
      }).then((x) => x.json());
      const reply = r.success ? r.data.reply : `（分身暂不可用：${r.error || "未知错误"}）`;
      setTwinMsgs((m) => [...m, { role: "ai", content: reply }]);
    } finally {
      setTwinLoading(false);
    }
  };

  const loadDigest = async () => {
    if (!venue.trim()) return;
    setDigestLoading(true);
    try {
      const r = await api(`/venue-digest?query=${encodeURIComponent(venue)}`);
      if (r.success) setDigest(r.data);
      else message.error(r.error || "分析失败");
    } finally {
      setDigestLoading(false);
    }
  };

  const follow = async (kind: "interest" | "scholar" | "venue", refId: string, label: string, extra?: any) => {
    const r = await followResearch({
      tenant,
      input: { userId: user?.id, kind, refId, label, extra },
      fields: ["id"],
      headers,
    });
    if (r.success) {
      message.success(`已追踪：${label}`);
      refetchFollows();
    } else message.error("追踪失败");
  };

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", paddingBottom: 24 }}>
      <div style={{ padding: 24, background: "white", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>AI 追踪（研究兴趣 / 学者 / 期刊）</Title>
      </div>

      <div style={{ padding: 24 }}>
        <Tabs
          defaultActiveKey="interest"
          items={[
            {
              key: "interest",
              label: "研究兴趣追踪",
              children: (
                <Card>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input value={interest} onChange={(e) => setInterest(e.target.value)} onPressEnter={() => doSearchWorks()} placeholder="输入研究兴趣，如：知识图谱" />
                    <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={() => doSearchWorks()}>搜索</Button>
                  </Space.Compact>
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary">示例兴趣：</Text>
                    {EXAMPLE_INTERESTS.map((t) => (
                      <Tag key={t} color="blue" style={{ cursor: "pointer", margin: 2 }} onClick={() => { setInterest(t); doSearchWorks(t); }}>{t}</Tag>
                    ))}
                  </div>
                  {topics.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <Text type="secondary">推荐相关方向：</Text>
                      {topics.map((t) => (
                        <Tag key={t} color="purple" style={{ cursor: "pointer", margin: 2 }} onClick={() => { setInterest(t); doSearchWorks(t); }}>{t}</Tag>
                      ))}
                    </div>
                  )}
                  <List
                    style={{ marginTop: 8 }}
                    dataSource={works}
                    renderItem={(w: any) => (
                      <List.Item
                        actions={[
                          <Button key="f" type="link" size="small" icon={<StarOutlined />} onClick={() => follow("interest", w.id, w.title, { authors: w.authors, venue: w.venue, year: w.year, cited: w.cited_by_count })}>追踪</Button>,
                        ]}
                      >
                        <List.Item.Meta
                          title={<a href={w.id} target="_blank" rel="noreferrer">{w.title}</a>}
                          description={`${(w.authors || []).join(", ")} · ${w.venue || ""} ${w.year || ""} · 被引 ${w.cited_by_count}`}
                        />
                      </List.Item>
                    )}
                  />
                </Card>
              ),
            },
            {
              key: "scholar",
              label: "学者追踪",
              children: (
                <>
                  <Card>
                    <Space.Compact style={{ width: "100%" }}>
                      <Input value={scholarName} onChange={(e) => setScholarName(e.target.value)} onPressEnter={doSearchAuthors} placeholder="学者姓名，如：周志华" />
                      <Button type="primary" icon={<SearchOutlined />} loading={searching} onClick={doSearchAuthors}>搜索</Button>
                    </Space.Compact>
                    {exampleLoading && authors.length === 0 && (
                      <div style={{ marginTop: 12, textAlign: "center" }}>
                        <Spin /> <Text type="secondary" style={{ marginLeft: 8 }}>正在加载示例学者…</Text>
                      </div>
                    )}
                    <List
                      style={{ marginTop: 8 }}
                      dataSource={authors}
                      renderItem={(a: any) => (
                        <List.Item
                          actions={[
                            <Button key="f" type="link" size="small" icon={<StarOutlined />} onClick={() => follow("scholar", a.id, a.name, { affiliation: a.affiliation, works: a.works_count, cited: a.cited_by_count, topics: a.topics })}>追踪</Button>,
                          ]}
                        >
                          <List.Item.Meta
                            avatar={<Avatar>{(a.name || "?")[0]}</Avatar>}
                            title={a.name}
                            description={`${a.affiliation || ""} · 论文 ${a.works_count} · 被引 ${a.cited_by_count} · ${(a.topics || []).join("、")}`}
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                  {profile && (
                    <Card title={`学者数字分身：${profile.name}`} style={{ marginTop: 16 }}>
                      <div><Text type="secondary">方向：{(profile.topics || []).join("、")}</Text></div>
                      <div style={{ marginTop: 4 }}><Text type="secondary">代表作：</Text></div>
                      {(profile.top_works || []).slice(0, 3).map((w: any) => (
                        <div key={w.id} style={{ fontSize: 12 }}>· {w.title}（{w.year}，被引{w.cited_by_count}）</div>
                      ))}
                      <Divider />
                      <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8, marginBottom: 8 }}>
                        {twinMsgs.map((m, i) => (
                          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.role === "user" ? "#1890ff" : "white", color: m.role === "user" ? "white" : undefined, border: "1px solid #e0e0e0", borderRadius: 8, padding: "8px 12px", whiteSpace: "pre-wrap" }}>
                            {m.content}
                          </div>
                        ))}
                        {twinLoading && <Text type="secondary">分身思考中…</Text>}
                      </div>
                      <Space.Compact style={{ width: "100%" }}>
                        <Input value={twinInput} onChange={(e) => setTwinInput(e.target.value)} onPressEnter={twinSend} placeholder="向学者分身提问" />
                        <Button type="primary" icon={<SendOutlined />} loading={twinLoading} onClick={twinSend}>发送</Button>
                      </Space.Compact>
                    </Card>
                  )}
                </>
              ),
            },
            {
              key: "venue",
              label: "期刊追踪",
              children: (
                <Card>
                  <Space.Compact style={{ width: "100%" }}>
                    <Input value={venue} onChange={(e) => setVenue(e.target.value)} onPressEnter={loadDigest} placeholder="期刊名，如：计算机学报" />
                    <Button type="primary" loading={digestLoading} onClick={loadDigest}>提炼分析</Button>
                    {digest && (
                      <Button icon={<StarOutlined />} onClick={() => follow("venue", digest.venue.id, digest.venue.name, { works: digest.venue.works_count })}>追踪该刊</Button>
                    )}
                  </Space.Compact>
                  <Divider style={{ marginTop: 16 }}>示例期刊</Divider>
                  <List
                    size="small"
                    dataSource={EXAMPLE_VENUES}
                    renderItem={(v) => (
                      <List.Item
                        actions={[
                          <Button key="a" size="small" type="link" icon={<SearchOutlined />} onClick={() => { setVenue(v); loadDigest(); }}>分析</Button>,
                        ]}
                      >
                        <Text>{v}</Text>
                      </List.Item>
                    )}
                  />
                  {digest && (
                    <div style={{ marginTop: 12 }}>
                      <Title level={5}>{digest.venue.name}（收录 {digest.venue.works_count} 篇）</Title>
                      <Title level={5} style={{ marginTop: 12 }}>文章要点</Title>
                      {(digest.digest?.points || []).map((p: string, i: number) => <div key={i}>· {p}</div>)}
                      <Title level={5} style={{ marginTop: 12 }}>观点对比</Title>
                      <Paragraph>{digest.digest?.comparison}</Paragraph>
                      <Title level={5}>技术趋势</Title>
                      <Paragraph>{digest.digest?.trends}</Paragraph>
                      <Divider />
                      <Text type="secondary">近期论文（{digest.papers?.length}）</Text>
                      {(digest.papers || []).slice(0, 5).map((p: any) => (
                        <div key={p.id} style={{ fontSize: 12 }}>· {p.title}（{p.year}）</div>
                      ))}
                    </div>
                  )}
                </Card>
              ),
            },
            {
              key: "follows",
              label: `我的追踪（${(follows || []).length}）`,
              children: (
                <Card>
                  {(follows || []).length === 0 ? (
                    <Text type="secondary">暂无追踪记录。在各栏目点「追踪」后，这里会展示研究方向 / 学者 / 期刊的历史记录。</Text>
                  ) : (
                    <Table
                      size="middle"
                      rowKey={(f: any) => f.id}
                      pagination={false}
                      tableLayout="fixed"
                      columns={[
                        {
                          title: "类型",
                          dataIndex: "kind",
                          width: 100,
                          render: (k: string) => <Tag color={followTypeColor(k)}>{followTypeLabel(k)}</Tag>,
                        },
                        {
                          title: "名称",
                          dataIndex: "label",
                          width: 240,
                          ellipsis: true,
                          render: (v: string) => <Text strong>{v}</Text>,
                        },
                        {
                          title: "详情",
                          render: (_: any, f: any) => (
                            <div style={{ whiteSpace: "normal", wordBreak: "break-word" }}>
                              <Text type="secondary">{followDetail(f)}</Text>
                            </div>
                          ),
                        },
                        {
                          title: "操作",
                          width: 100,
                          render: (_: any, f: any) => (
                            <Button type="link" size="small" danger onClick={async () => {
                              await unfollowResearch({ tenant, primaryKey: f.id, headers });
                              refetchFollows();
                            }}>取消追踪</Button>
                          ),
                        },
                      ]}
                      dataSource={follows || []}
                    />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
