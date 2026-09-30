import * as React from "react";
import { useState, useRef, useEffect } from "react";
import * as echarts from "echarts";
import {
  Layout, Typography, Input, Button, Card, Row, Col, Carousel,
  List, Table, Tag, Space, Avatar, Image, Statistic, Spin, Empty,
} from "antd";
import {
  AppstoreOutlined, PictureOutlined, SearchOutlined, BarChartOutlined,
  TableOutlined, PlayCircleOutlined, CloudOutlined, CalendarOutlined,
  PushpinOutlined, GlobalOutlined, ThunderboltOutlined, FileTextOutlined, DashboardOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";

const { Title, Text, Paragraph } = Typography;

interface RealCourse {
  id: string;
  title: string;
  description?: string | null;
}

interface PortalStats {
  courses: number;
  students: number;
  videos: number;
  exercises: number;
}

function ModuleCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card size="small" title={<span>{icon} {title}</span>} style={{ height: "100%" }}>
      {children}
    </Card>
  );
}

const COLOR_PALETTE = ["#722ed1", "#13c2c2", "#fa8c16", "#eb2f96", "#1890ff", "#52c41a", "#faad14", "#f5222d"];

export default function PortalShowcase({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  // 门户为独立路由，可能未写入 localStorage，优先从 sessionStorage 取当前租户
  const tenant =
    (typeof window !== "undefined" && sessionStorage.getItem("tenant")) ||
    currentTenant?.schemaName ||
    "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  const [kw, setKw] = useState("");
  const [ip, setIp] = useState("查询中…");
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<RealCourse[]>([]);
  const [stats, setStats] = useState<PortalStats>({ courses: 0, students: 0, videos: 0, exercises: 0 });
  const chartRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  useEffect(() => {
    fetch("https://api.ipify.org?format=json").then((r) => r.json()).then((d) => setIp(d.ip)).catch(() => setIp("离线演示"));
  }, []);

  useEffect(() => {
    if (!user || !tenant) return;
    let active = true;
    (async () => {
      try {
        const token = sessionStorage.getItem("jwt_access_token") || "";
        const baseHeaders = {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        } as Record<string, string>;
        const run = async (action: string, input: any, fields: string[], limit = 1, filter?: any) => {
          const res = await fetch("/rpc/run", {
            method: "POST",
            headers: { ...baseHeaders, ...headers },
            body: JSON.stringify({
              action,
              tenant,
              input,
              fields,
              page: { limit, count: true },
              ...(filter ? { filter } : {}),
            }),
          }).then((x) => x.json());
          return res?.data;
        };
        const count = (d: any) =>
          typeof d?.count === "number"
            ? d.count
            : Array.isArray(d)
              ? d.length
              : Array.isArray(d?.results)
                ? d.results.length
                : 0;
        const courseArr = (d: any) =>
          Array.isArray(d?.results) ? d.results : Array.isArray(d) ? d : [];
        // 用 allSettled 保证单个数据源失败不影响其他模块
        const [coursesR, studentsR, videosR, exercisesR] = await Promise.allSettled([
          run("list_courses", {}, ["id", "title", "description"], 100),
          run("list_users", {}, ["id"], 1, { role: { eq: "user" } }),
          run("list_videos", {}, ["id"], 1),
          run("list_exercises", {}, ["id"], 1),
        ]);
        const dataOf = (r: any) => (r.status === "fulfilled" ? r.value : null);
        if (active) {
          const coursesD = dataOf(coursesR);
          setCourses(courseArr(coursesD));
          setStats({
            courses: count(coursesD),
            students: count(dataOf(studentsR)),
            videos: count(dataOf(videosR)),
            exercises: count(dataOf(exercisesR)),
          });
        }
      } catch (e) {
        console.error("加载门户数据失败:", e);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tenant]);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    const labels = ["课程", "学生", "视频", "习题"];
    const values = [stats.courses, stats.students, stats.videos, stats.exercises];
    chart.setOption({
      tooltip: { trigger: "axis" },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: labels },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: values, itemStyle: { color: "#722ed1", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 46 }],
    });
    return () => chart.dispose();
  }, [stats]);

  const filtered = courses.filter(
    (c) => c.title?.toLowerCase().includes(kw.toLowerCase()) ||
      (c.description || "").toLowerCase().includes(kw.toLowerCase()),
  );

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <div style={{ background: "white", padding: "16px 24px", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 12 }}>
        {!embedded && <Button type="link" onClick={() => navigate("/")}>返回首页</Button>}
        <Title level={4} style={{ margin: 0 }}>智慧门户 · 基础模块演示</Title>
        {loading && <Spin size="small" style={{ marginLeft: 12 }} />}
      </div>

      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
        {/* 搜索条 + 日期 + 天气 + IP */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <ModuleCard icon={<SearchOutlined />} title="搜索条 / 搜索">
              <Input.Search placeholder="搜索课程（真实数据）" value={kw} onChange={(e) => setKw(e.target.value)} onSearch={setKw} />
              <Text type="secondary" style={{ fontSize: 12 }}>输入过滤下方图文/文本/搜索列表</Text>
            </ModuleCard>
          </Col>
          <Col xs={24} md={8}>
            <ModuleCard icon={<CalendarOutlined />} title="日期 / 天气">
              <div>{today}</div>
              <div style={{ marginTop: 4 }}><CloudOutlined /> 北京 晴 18°C（天气为外部演示数据）</div>
            </ModuleCard>
          </Col>
          <Col xs={24} md={8}>
            <ModuleCard icon={<GlobalOutlined />} title="IP / 插件">
              <div>出口 IP：<Tag>{ip}</Tag></div>
              <Button size="small" icon={<ThunderboltOutlined />} style={{ marginTop: 8 }} onClick={() => navigate("/teacher/dashboard/ai-practice")}>
                插件槽位：AI 实践
              </Button>
            </ModuleCard>
          </Col>
        </Row>

        {/* 轮播图（真实课程） */}
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <ModuleCard icon={<PictureOutlined />} title="轮播图">
              {courses.length === 0 ? (
                <Empty text="暂无课程数据" />
              ) : (
                <Carousel autoplay>
                  {courses.slice(0, 6).map((c) => (
                    <div key={c.id}>
                      <div style={{ width: "100%", height: 140, borderRadius: 8, background: "linear-gradient(135deg, #1677ff, #0A2463)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", color: "#fff" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, padding: "0 24px", textAlign: "center" }}>{c.title}</div>
                        <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, padding: "0 24px", textAlign: "center", maxWidth: "80%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description || "课程资源"}</div>
                      </div>
                    </div>
                  ))}
                </Carousel>
              )}
            </ModuleCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* 图标列表 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<AppstoreOutlined />} title="图标列表">
              <Row gutter={[8, 8]}>
                {["课程", "考试", "作业", "签到", "图谱", "实践", "表单", "门户"].map((t) => (
                  <Col span={6} key={t} style={{ textAlign: "center" }}>
                    <Avatar style={{ background: "#722ed1" }}>{t[0]}</Avatar>
                    <div style={{ fontSize: 12 }}>{t}</div>
                  </Col>
                ))}
              </Row>
            </ModuleCard>
          </Col>
          {/* 图文列表 / 多图列表（真实课程） */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<FileTextOutlined />} title="图文列表 / 多图列表">
              <List
                size="small"
                dataSource={filtered.slice(0, 6)}
                locale={{ emptyText: "暂无课程" }}
                renderItem={(c, i) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={<Avatar style={{ background: COLOR_PALETTE[i % COLOR_PALETTE.length] }}>{c.title?.charAt(0)}</Avatar>}
                      title={c.title}
                      description={
                        <div style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2, overflow: "hidden", fontSize: 12 }}>
                          {c.description || "课程资源"}
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            </ModuleCard>
          </Col>
          {/* 文本列表 / 搜索列表 / 文本（真实课程） */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<FileTextOutlined />} title="文本列表 / 搜索列表 / 文本">
              <List size="small" dataSource={filtered.slice(0, 6)} locale={{ emptyText: "暂无课程" }} renderItem={(c) => <List.Item>{c.title}</List.Item>} />
              <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>纯文本模块：展示系统课程名称，支持 Markdown。</Paragraph>
            </ModuleCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* 图表（真实统计） */}
          <Col xs={24} md={12}>
            <ModuleCard icon={<BarChartOutlined />} title="图表">
              <div ref={chartRef} style={{ height: 260 }} />
            </ModuleCard>
          </Col>
          {/* 表格（真实课程） */}
          <Col xs={24} md={12}>
            <ModuleCard icon={<TableOutlined />} title="表格">
              <Table
                size="small"
                pagination={filtered.length > 6 ? { pageSize: 6 } : false}
                rowKey="id"
                dataSource={filtered}
                locale={{ emptyText: "暂无课程" }}
                columns={[
                  { title: "课程", dataIndex: "title" },
                  { title: "说明", dataIndex: "description", ellipsis: true, render: (v: string) => v || "-" },
                ]}
              />
            </ModuleCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* 图片 / 按钮 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<PictureOutlined />} title="图片 / 按钮">
              <div style={{ height: 140, borderRadius: 8, background: "linear-gradient(135deg, #1677ff, #0A2463)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 18, fontWeight: 600 }}>校园风采</div>
              <Space style={{ marginTop: 8 }}>
                <Button type="primary">报名</Button>
                <Button>查看详情</Button>
              </Space>
            </ModuleCard>
          </Col>
          {/* 视频 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<PlayCircleOutlined />} title="视频">
              <video controls style={{ width: "100%", borderRadius: 8 }} preload="none">
                <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4" />
              </video>
            </ModuleCard>
          </Col>
          {/* 地图 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<PushpinOutlined />} title="地图">
              <iframe
                title="map"
                style={{ width: "100%", height: 200, border: 0, borderRadius: 8 }}
                src="https://www.openstreetmap.org/export/embed.html?bbox=116.30%2C39.95%2C116.45%2C40.05&layer=mapnik"
              />
            </ModuleCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <ModuleCard icon={<DashboardOutlined />} title="数据统计条（真实数据）">
              <Row gutter={16}>
                <Col xs={12} md={6}><Statistic title="课程数" value={stats.courses} /></Col>
                <Col xs={12} md={6}><Statistic title="学生数" value={stats.students} /></Col>
                <Col xs={12} md={6}><Statistic title="视频数" value={stats.videos} /></Col>
                <Col xs={12} md={6}><Statistic title="习题数" value={stats.exercises} /></Col>
              </Row>
            </ModuleCard>
          </Col>
        </Row>
      </div>
    </Layout>
  );
}