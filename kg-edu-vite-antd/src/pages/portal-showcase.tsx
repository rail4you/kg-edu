import * as React from "react";
import { useState, useRef, useEffect } from "react";
import * as echarts from "echarts";
import {
  Layout, Typography, Input, Button, Card, Row, Col, Carousel,
  List, Table, Tag, Space, Avatar, Image, Statistic,
} from "antd";
import {
  AppstoreOutlined, PictureOutlined, SearchOutlined, BarChartOutlined,
  TableOutlined, PlayCircleOutlined, CloudOutlined, CalendarOutlined,
  PushpinOutlined, GlobalOutlined, ThunderboltOutlined, FileTextOutlined, DashboardOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";

const { Title, Text, Paragraph } = Typography;

const DEMO_COURSES = [
  { id: "1", title: "高等数学", dept: "理学院", students: 320, img: "https://picsum.photos/seed/math/400/200" },
  { id: "2", title: "大学英语", dept: "外国语学院", students: 450, img: "https://picsum.photos/seed/eng/400/200" },
  { id: "3", title: "程序设计基础", dept: "信息学院", students: 280, img: "https://picsum.photos/seed/code/400/200" },
  { id: "4", title: "平面构成", dept: "艺术学院", students: 190, img: "https://picsum.photos/seed/art/400/200" },
];

function ModuleCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card size="small" title={<span>{icon} {title}</span>} style={{ height: "100%" }}>
      {children}
    </Card>
  );
}

export default function PortalShowcase() {
  const navigate = useNavigate();
  const [kw, setKw] = useState("");
  const [ip, setIp] = useState("查询中…");
  const chartRef = useRef<HTMLDivElement>(null);
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric", weekday: "long" });

  useEffect(() => {
    fetch("https://api.ipify.org?format=json").then((r) => r.json()).then((d) => setIp(d.ip)).catch(() => setIp("离线演示"));
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    chart.setOption({
      tooltip: {},
      xAxis: { type: "category", data: DEMO_COURSES.map((c) => c.title) },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: DEMO_COURSES.map((c) => c.students), itemStyle: { color: "#722ed1" } }],
    });
    return () => chart.dispose();
  }, []);

  const filtered = DEMO_COURSES.filter((c) => c.title.includes(kw) || c.dept.includes(kw));

  return (
    <Layout style={{ minHeight: "100vh", background: "#f5f5f5" }}>
      <div style={{ background: "white", padding: "16px 24px", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 12 }}>
        <Button type="link" onClick={() => navigate("/")}>返回首页</Button>
        <Title level={3} style={{ margin: 0 }}>智慧门户 · 基础模块演示（18 种）</Title>
      </div>

      <div style={{ padding: 24, maxWidth: 1280, margin: "0 auto" }}>
        {/* 搜索条 + 日期 + 天气 + IP */}
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <ModuleCard icon={<SearchOutlined />} title="搜索条 / 搜索">
              <Input.Search placeholder="搜索课程或院系" value={kw} onChange={(e) => setKw(e.target.value)} onSearch={setKw} />
              <Text type="secondary" style={{ fontSize: 12 }}>输入过滤下方图文/文本/搜索列表</Text>
            </ModuleCard>
          </Col>
          <Col xs={24} md={8}>
            <ModuleCard icon={<CalendarOutlined />} title="日期 / 天气">
              <div>{today}</div>
              <div style={{ marginTop: 4 }}><CloudOutlined /> 北京 晴 18°C（演示数据）</div>
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

        {/* 轮播图 */}
        <ModuleCard icon={<PictureOutlined />} title="轮播图">
          <Carousel autoplay>
            {DEMO_COURSES.map((c) => (
              <div key={c.id}>
                <img src={c.img} alt={c.title} style={{ width: "100%", height: 220, objectFit: "cover", borderRadius: 8 }} />
              </div>
            ))}
          </Carousel>
        </ModuleCard>

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
          {/* 图文列表 / 多图列表 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<FileTextOutlined />} title="图文列表 / 多图列表">
              <List
                size="small"
                dataSource={filtered}
                renderItem={(c) => (
                  <List.Item>
                    <List.Item.Meta avatar={<Avatar src={c.img} />} title={c.title} description={`${c.dept} · ${c.students}人`} />
                  </List.Item>
                )}
              />
            </ModuleCard>
          </Col>
          {/* 文本列表 / 搜索列表 / 文本 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<FileTextOutlined />} title="文本列表 / 搜索列表 / 文本">
              <List size="small" dataSource={filtered} renderItem={(c) => <List.Item>{c.title}<Text type="secondary">（{c.dept}）</Text></List.Item>} />
              <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8 }}>纯文本模块：门户公告内容，支持 Markdown。</Paragraph>
            </ModuleCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* 图表 */}
          <Col xs={24} md={12}>
            <ModuleCard icon={<BarChartOutlined />} title="图表">
              <div ref={chartRef} style={{ height: 260 }} />
            </ModuleCard>
          </Col>
          {/* 表格 */}
          <Col xs={24} md={12}>
            <ModuleCard icon={<TableOutlined />} title="表格">
              <Table size="small" pagination={false} rowKey="id" dataSource={filtered} columns={[
                { title: "课程", dataIndex: "title" },
                { title: "院系", dataIndex: "dept" },
                { title: "人数", dataIndex: "students" },
              ]} />
            </ModuleCard>
          </Col>
        </Row>

        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          {/* 图片 / 按钮 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<PictureOutlined />} title="图片 / 按钮">
              <Image src="https://picsum.photos/seed/campus/400/180" style={{ borderRadius: 8 }} />
              <Space style={{ marginTop: 8 }}>
                <Button type="primary">报名</Button>
                <Button>查看详情</Button>
              </Space>
            </ModuleCard>
          </Col>
          {/* 视频 */}
          <Col xs={24} md={8}>
            <ModuleCard icon={<PlayCircleOutlined />} title="视频">
              <video controls style={{ width: "100%", borderRadius: 8 }} preload="none" poster="https://picsum.photos/seed/video/400/180">
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
            <ModuleCard icon={<DashboardOutlined />} title="数据统计条">
              <Row gutter={16}>
                <Col span={6}><Statistic title="课程数" value={128} /></Col>
                <Col span={6}><Statistic title="学生数" value={1240} /></Col>
                <Col span={6}><Statistic title="视频数" value={356} /></Col>
                <Col span={6}><Statistic title="习题数" value={2840} /></Col>
              </Row>
            </ModuleCard>
          </Col>
        </Row>
      </div>
    </Layout>
  );
}
