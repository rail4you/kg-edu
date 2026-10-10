import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as echarts from "echarts";
import {
  Row,
  Col,
  Typography,
  Statistic,
  List,
  Avatar,
  Table,
  Tag,
  Empty,
  Carousel,
  Image,
  Input,
  Button,
  Space,
  Tooltip,
} from "antd";
import {
  ReadOutlined,
  TeamOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  LinkOutlined,
  CalendarOutlined,
  GlobalOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { PortalBlock } from "@/lib/smart-portal";
import type { SmartPortalData } from "./use-smart-portal-data";
import { usePortalQuery } from "./portal-context";

const { Text, Paragraph } = Typography;

export const METRIC_LABELS: Record<string, string> = {
  courses: "课程",
  students: "学生",
  videos: "视频",
  exercises: "习题",
};

export const METRIC_KEYS = Object.keys(METRIC_LABELS);

export const METRIC_ICONS: Record<string, React.ReactNode> = {
  courses: <ReadOutlined />,
  students: <TeamOutlined />,
  videos: <VideoCameraOutlined />,
  exercises: <FileTextOutlined />,
};

export interface BlockRenderProps {
  block: PortalBlock;
  data: SmartPortalData;
  onNavigate?: (path: string) => void;
}

const asNumber = (v: unknown, fallback: number): number => {
  const n = typeof v === "number" ? v : parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
};

const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : [];

const asBool = (v: unknown, fallback = false): boolean =>
  typeof v === "boolean" ? v : v === "true" ? true : v === "false" ? false : fallback;

function metricValues(data: SmartPortalData, metrics: string[]) {
  return metrics.map((m) => {
    switch (m) {
      case "courses":
        return data.stats.courses;
      case "students":
        return data.stats.students;
      case "videos":
        return data.stats.videos;
      case "exercises":
        return data.stats.exercises;
      default:
        return 0;
    }
  });
}

/* ----------------------------- stats ----------------------------- */

export const StatsWidget: React.FC<BlockRenderProps> = ({ block, data }) => {
  const metrics = asStringArray(block.config.metrics).filter((m) => m in METRIC_LABELS);
  const list = metrics.length ? metrics : METRIC_KEYS;
  const span = Math.max(1, Math.floor(24 / Math.min(list.length, 4)));
  return (
    <Row gutter={[16, 16]}>
      {list.map((m) => (
        <Col xs={12} md={span} key={m}>
          <Statistic title={METRIC_LABELS[m]} value={data.stats[m as keyof typeof data.stats] ?? 0} />
        </Col>
      ))}
    </Row>
  );
};

/* ----------------------------- chart ----------------------------- */

export const ChartWidget: React.FC<BlockRenderProps> = ({ block, data }) => {
  const ref = useRef<HTMLDivElement>(null);
  const chartType = (block.config.chartType as string) || "bar";
  const metrics = asStringArray(block.config.metrics).filter((m) => m in METRIC_LABELS);
  const list = metrics.length ? metrics : METRIC_KEYS;

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    const labels = list.map((m) => METRIC_LABELS[m]);
    const values = metricValues(data, list);

    const series = [
      {
        type: chartType,
        data:
          chartType === "pie"
            ? labels.map((name, i) => ({ name, value: values[i] }))
            : values,
        ...(chartType === "bar" ? { itemStyle: { color: "#1766d8", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 46 } : {}),
        ...(chartType === "line" ? { smooth: true, itemStyle: { color: "#1766d8" } } : {}),
        ...(chartType === "pie" ? { radius: ["40%", "70%"] } : {}),
      },
    ];

    chart.setOption({
      tooltip: { trigger: chartType === "pie" ? "item" : "axis" },
      legend: chartType === "pie" ? { bottom: 0 } : undefined,
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: chartType === "pie" ? undefined : { type: "category", data: labels },
      yAxis: chartType === "pie" ? undefined : { type: "value" },
      series,
    });

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [chartType, JSON.stringify(list), JSON.stringify(data.stats)]);

  return <div ref={ref} style={{ width: "100%", height: 260 }} />;
};

/* -------------------------- course-list -------------------------- */

export const CourseListWidget: React.FC<BlockRenderProps> = ({ block, data, onNavigate }) => {
  const limit = asNumber(block.config.limit, 6);
  const layout = (block.config.layout as string) || "card";
  const { query } = usePortalQuery();
  const kw = query.trim().toLowerCase();
  const courses = (kw
    ? data.courses.filter(
        (c) =>
          c.title.toLowerCase().includes(kw) ||
          (c.description || "").toLowerCase().includes(kw)
      )
    : data.courses
  ).slice(0, limit);

  if (!courses.length) return <Empty description="暂无课程数据" />;

  if (layout === "table") {
    return (
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={courses}
        columns={[
          { title: "课程", dataIndex: "title" },
          { title: "说明", dataIndex: "description", ellipsis: true, render: (v: string) => v || "-" },
        ]}
      />
    );
  }

  if (layout === "text") {
    return (
      <List
        size="small"
        dataSource={courses}
        renderItem={(c) => (
          <List.Item
            style={{ cursor: "pointer" }}
            onClick={() => onNavigate?.(`/dashboard/course-info/${c.id}`)}
          >
            <Text>{c.title}</Text>
          </List.Item>
        )}
      />
    );
  }

  return (
    <Row gutter={[12, 12]}>
      {courses.map((c, i) => (
        <Col xs={24} sm={12} key={c.id}>
          <div
            onClick={() => onNavigate?.(`/dashboard/course-info/${c.id}`)}
            style={{
              display: "flex",
              gap: 12,
              alignItems: "center",
              padding: 12,
              border: "1px solid #eef1f6",
              borderRadius: 10,
              cursor: "pointer",
              height: "100%",
            }}
          >
            <Avatar
              shape="square"
              size={40}
              style={{ background: ["#1766d8", "#7a4a12", "#0f9d58", "#722ed1"][i % 4] }}
            >
              {c.title.charAt(0)}
            </Avatar>
            <div style={{ minWidth: 0 }}>
              <Text strong ellipsis style={{ display: "block" }}>
                {c.title}
              </Text>
              <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
                {c.description || "课程资源"}
              </Text>
            </div>
          </div>
        </Col>
      ))}
    </Row>
  );
};

/* ----------------------- knowledge-points ------------------------ */

const KP_COLORS = ["blue", "geekblue", "cyan", "purple", "magenta", "green", "gold", "volcano"];

function courseColor(id?: string): string {
  if (!id) return "blue";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return KP_COLORS[h % KP_COLORS.length];
}

export const KnowledgePointsWidget: React.FC<BlockRenderProps> = ({ block, data }) => {
  const limit = asNumber(block.config.limit, 12);
  const layout = (block.config.layout as string) || "tags";
  const { query } = usePortalQuery();
  const kw = query.trim().toLowerCase();
  const points = (kw
    ? data.knowledgePoints.filter(
        (k) =>
          k.name.toLowerCase().includes(kw) ||
          (k.courseTitle || "").toLowerCase().includes(kw)
      )
    : data.knowledgePoints
  ).slice(0, limit);

  if (!points.length) return <Empty description="暂无知识点数据" />;

  if (layout === "list") {
    return (
      <List
        size="small"
        dataSource={points}
        renderItem={(k) => (
          <List.Item>
            <List.Item.Meta
              avatar={<Tag color={courseColor(k.courseId)}>KP</Tag>}
              title={<Text style={{ fontSize: 13 }}>{k.name}</Text>}
              description={
                k.courseTitle ? (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {k.courseTitle}
                  </Text>
                ) : undefined
              }
            />
          </List.Item>
        )}
      />
    );
  }

  return (
    <Space size={[8, 8]} wrap>
      {points.map((k) => (
        <Tooltip key={k.id} title={k.courseTitle ? `所属课程：${k.courseTitle}` : undefined}>
          <Tag color={courseColor(k.courseId)} style={{ fontSize: 13, padding: "2px 10px" }}>
            {k.name}
          </Tag>
        </Tooltip>
      ))}
    </Space>
  );
};

/* ---------------------------- carousel --------------------------- */

export const CarouselWidget: React.FC<BlockRenderProps> = ({ block, data, onNavigate }) => {
  const limit = asNumber(block.config.limit, 5);
  const autoPlay = asBool(block.config.autoPlay, true);
  const courses = data.courses.slice(0, limit);

  if (!courses.length) return <Empty description="暂无轮播内容" />;

  return (
    <Carousel autoplay={autoPlay}>
      {courses.map((c) => (
        <div key={c.id}>
          <div
            onClick={() => onNavigate?.(`/dashboard/course-info/${c.id}`)}
            style={{
              height: 140,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1766d8, #0f3f8c)",
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              padding: "0 24px",
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 700, textAlign: "center" }}>{c.title}</div>
            <div style={{ fontSize: 12, opacity: 0.85, marginTop: 6, textAlign: "center" }}>
              {c.description || "课程资源"}
            </div>
          </div>
        </div>
      ))}
    </Carousel>
  );
};

/* ------------------------------ text ----------------------------- */

export const TextWidget: React.FC<BlockRenderProps> = ({ block }) => {
  const content = (block.config.content as string) || "";
  const align = (block.config.align as "left" | "center" | "right") || "left";
  return (
    <Paragraph style={{ whiteSpace: "pre-line", textAlign: align, marginBottom: 0 }}>
      {content || "（未配置文本内容）"}
    </Paragraph>
  );
};

/* ----------------------------- image ----------------------------- */

export const ImageWidget: React.FC<BlockRenderProps> = ({ block, onNavigate }) => {
  const src = block.config.src as string;
  const link = block.config.link as string;
  const caption = block.config.caption as string;
  if (!src) return <Empty description="未配置图片地址" />;
  return (
    <div style={{ textAlign: "center" }}>
      <Image
        src={src}
        alt={caption || "portal"}
        style={{ width: "100%", borderRadius: 10, maxHeight: 320, objectFit: "cover" }}
        fallback="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='200'%3E%3Crect width='100%25' height='100%25' fill='%23eef1f6'/%3E%3C/svg%3E"
      />
      {caption && (
        <div style={{ marginTop: 6, fontSize: 12, color: "#8c8c8c" }}>{caption}</div>
      )}
      {link && (
        <a style={{ fontSize: 12 }} onClick={() => onNavigate?.(link)}>
          <LinkOutlined /> 查看详情
        </a>
      )}
    </div>
  );
};

/* ----------------------------- video ----------------------------- */

export const VideoWidget: React.FC<BlockRenderProps> = ({ block }) => {
  const src = block.config.src as string;
  const poster = block.config.poster as string;
  if (!src) return <Empty description="未配置视频地址" />;
  return (
    <video controls poster={poster || undefined} style={{ width: "100%", borderRadius: 10 }} preload="none">
      <source src={src} />
    </video>
  );
};

/* ---------------------------- icon-nav --------------------------- */

interface NavOption {
  label: string;
  to: string;
}

export const IconNavWidget: React.FC<BlockRenderProps> = ({ block, onNavigate }) => {
  const items = (block.config.items as NavOption[]) || [];
  if (!items.length) return <Empty description="未配置导航项" />;
  const cols = Math.min(items.length, 4) || 1;
  const span = Math.max(6, Math.floor(24 / cols));
  return (
    <Row gutter={[8, 12]}>
      {items.map((it, i) => (
        <Col xs={8} md={span} key={`${it.label}-${i}`} style={{ textAlign: "center" }}>
          <div
            onClick={() => it.to && onNavigate?.(it.to)}
            style={{ cursor: it.to ? "pointer" : "default" }}
          >
            <Avatar size={44} style={{ background: "#eef5ff", color: "#1766d8" }}>
              <AppstoreOutlined />
            </Avatar>
            <div style={{ fontSize: 13, marginTop: 6 }}>{it.label}</div>
          </div>
        </Col>
      ))}
    </Row>
  );
};

/* ----------------------------- table ----------------------------- */

export const TableWidget: React.FC<BlockRenderProps> = ({ block, data }) => {
  const source = (block.config.source as string) || "courses";
  const limit = asNumber(block.config.limit, 8);

  if (source === "knowledge") {
    const rows = data.knowledgePoints.slice(0, limit);
    if (!rows.length) return <Empty description="暂无知识点数据" />;
    return (
      <Table
        size="small"
        rowKey="id"
        pagination={false}
        dataSource={rows}
        columns={[
          { title: "知识点", dataIndex: "name" },
          { title: "说明", dataIndex: "description", ellipsis: true, render: (v: string) => v || "-" },
        ]}
      />
    );
  }

  const rows = data.courses.slice(0, limit);
  if (!rows.length) return <Empty description="暂无课程数据" />;
  return (
    <Table
      size="small"
      rowKey="id"
      pagination={false}
      dataSource={rows}
      columns={[
        { title: "课程", dataIndex: "title" },
        { title: "说明", dataIndex: "description", ellipsis: true, render: (v: string) => v || "-" },
      ]}
    />
  );
};

/* ---------------------------- search ----------------------------- */

export const SearchWidget: React.FC<BlockRenderProps> = ({ block }) => {
  const { setQuery } = usePortalQuery();
  const [value, setValue] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const placeholder = (block.config.placeholder as string) || "搜索课程、知识点…";

  const apply = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery(v), 220);
  };

  useEffect(() => () => timer.current && clearTimeout(timer.current), []);

  return (
    <Input.Search
      value={value}
      placeholder={placeholder}
      allowClear
      enterButton
      onChange={(e) => {
        setValue(e.target.value);
        apply(e.target.value);
      }}
      onSearch={(v) => {
        setValue(v);
        if (timer.current) clearTimeout(timer.current);
        setQuery(v);
      }}
      onClear={() => {
        setValue("");
        setQuery("");
      }}
    />
  );
};

/* ---------------------------- date ------------------------------- */

export const DateWidget: React.FC<BlockRenderProps> = ({ block }) => {
  const [now, setNow] = useState(() => new Date());
  const mode = (block.config.mode as string) || "date";
  const showTime = asBool(block.config.showTime, false);

  useEffect(() => {
    if (!showTime) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [showTime]);

  const text =
    mode === "time"
      ? now.toLocaleTimeString("zh-CN")
      : now.toLocaleDateString("zh-CN", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: block.config.showWeekday === false ? undefined : "long",
        });

  return (
    <Space size={8}>
      <CalendarOutlined style={{ color: "#1766d8" }} />
      <span style={{ fontSize: 15 }}>{text}</span>
      {showTime && mode !== "time" && (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {now.toLocaleTimeString("zh-CN")}
        </Text>
      )}
    </Space>
  );
};

/* ----------------------------- IP -------------------------------- */

export const IpWidget: React.FC<BlockRenderProps> = ({ block }) => {
  const [ip, setIp] = useState("—");
  const label = (block.config.label as string) || "出口 IP";

  useEffect(() => {
    let active = true;
    // 优先使用本平台后端（始终可用）；失败再尝试公共 IP 服务
    fetch("/api/client-ip")
      .then((r) => r.json())
      .then((d) => {
        if (active && d?.success && d?.data?.ip) setIp(d.data.ip);
      })
      .catch(() => {})
      .finally(() => {
        if (!active) return;
        // 若后端未返回有效值，回退公共 IP 服务
        fetch("https://api.ipify.org?format=json")
          .then((r) => r.json())
          .then((d) => active && d?.ip && setIp(d.ip))
          .catch(() => {});
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Space size={8}>
      <GlobalOutlined style={{ color: "#1766d8" }} />
      <span>{label}：</span>
      <Tag>{ip}</Tag>
    </Space>
  );
};

/* ----------------------------- map ------------------------------- */

/** 经纬度 → 瓦片坐标 */
const lngLatToTile = (lng: number, lat: number, z: number) => {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );
  return { x, y };
};

const tencentTileUrl = (z: number, x: number, y: number) =>
  `https://rt0.map.gtimg.com/realtimerender?z=${z}&x=${x}&y=${y}&type=vector&style=0`;

export const MapWidget: React.FC<BlockRenderProps> = ({ block }) => {
  const bbox = (block.config.bbox as string) || "116.30,39.95,116.45,40.05";
  const height = asNumber(block.config.height, 220);
  const nums = bbox
    .split(",")
    .map((n) => Number(n.trim()))
    .filter((n) => !Number.isNaN(n));
  const [minLon, minLat, maxLon, maxLat] =
    nums.length === 4 ? nums : [116.30, 39.95, 116.45, 40.05];
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLon + maxLon) / 2;

  const z = 11;
  const { x: cx, y: cy } = lngLatToTile(centerLng, centerLat, z);
  const cols = 5;
  const rows = 3;
  const tile = 256;

  const tiles: React.ReactNode[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      tiles.push(
        <img
          key={`${z}-${x}-${y}`}
          src={tencentTileUrl(z, x, y)}
          alt=""
          loading="lazy"
          style={{ width: tile, height: tile, display: "block" }}
        />
      );
    }
  }

  return (
    <div
      style={{
        width: "100%",
        height,
        borderRadius: 8,
        overflow: "hidden",
        position: "relative",
        background: "#e8eef5",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: cols * tile,
          height: rows * tile,
          transform: "translate(-50%, -50%)",
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, ${tile}px)`,
          gridTemplateRows: `repeat(${rows}, ${tile}px)`,
        }}
      >
        {tiles}
      </div>
    </div>
  );
};

/* ---------------------------- plugin ----------------------------- */

export const PluginWidget: React.FC<BlockRenderProps> = ({ block }) => {
  const label = (block.config.label as string) || "插件演示";
  const description = (block.config.description as string) || "扩展能力展示（演示，无跳转）";
  return (
    <div>
      <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 8 }}>
        {description}
      </Paragraph>
      <Space size={8}>
        <Button icon={<ThunderboltOutlined />} disabled>
          {label}
        </Button>
        <Tag>演示</Tag>
      </Space>
    </div>
  );
};
