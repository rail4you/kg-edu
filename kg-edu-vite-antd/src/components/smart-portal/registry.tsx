import * as React from "react";
import {
  BarChartOutlined,
  DashboardOutlined,
  ReadOutlined,
  PartitionOutlined,
  PictureOutlined,
  PlayCircleOutlined,
  AppstoreOutlined,
  TableOutlined,
  FileTextOutlined,
  SearchOutlined,
  CalendarOutlined,
  GlobalOutlined,
  EnvironmentOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import type { BlockType, PortalBlock } from "@/lib/smart-portal";
import { createBlockId, DEFAULT_SPAN } from "@/lib/smart-portal";
import {
  CourseListWidget,
  ChartWidget,
  StatsWidget,
  KnowledgePointsWidget,
  CarouselWidget,
  TextWidget,
  ImageWidget,
  VideoWidget,
  IconNavWidget,
  TableWidget,
  SearchWidget,
  DateWidget,
  IpWidget,
  MapWidget,
  PluginWidget,
  METRIC_KEYS,
  type BlockRenderProps,
} from "./widgets";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "switch"
  | "metrics"
  | "options";

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  options?: { label: string; value: string }[];
  min?: number;
  max?: number;
  help?: string;
}

export interface BlockDef {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  defaultSpan: number;
  defaultTitle: string;
  createDefault: () => Record<string, unknown>;
  configFields: FieldDef[];
  Render: React.FC<BlockRenderProps>;
}

export const BLOCK_REGISTRY: Record<BlockType, BlockDef> = {
  text: {
    type: "text",
    label: "文本 / 图文",
    icon: <FileTextOutlined />,
    defaultSpan: 24,
    defaultTitle: "文本",
    createDefault: () => ({ content: "在此输入文本内容", align: "left" }),
    configFields: [
      { key: "content", label: "内容", type: "textarea", placeholder: "支持换行" },
      {
        key: "align",
        label: "对齐",
        type: "select",
        options: [
          { label: "左对齐", value: "left" },
          { label: "居中", value: "center" },
          { label: "右对齐", value: "right" },
        ],
      },
    ],
    Render: TextWidget,
  },
  stats: {
    type: "stats",
    label: "数据统计",
    icon: <DashboardOutlined />,
    defaultSpan: 24,
    defaultTitle: "数据概览",
    createDefault: () => ({ metrics: [...METRIC_KEYS] }),
    configFields: [
      { key: "metrics", label: "统计指标", type: "metrics", help: "选择要展示的指标" },
    ],
    Render: StatsWidget,
  },
  chart: {
    type: "chart",
    label: "图表",
    icon: <BarChartOutlined />,
    defaultSpan: 12,
    defaultTitle: "图表",
    createDefault: () => ({ chartType: "bar", metrics: [...METRIC_KEYS] }),
    configFields: [
      {
        key: "chartType",
        label: "图表类型",
        type: "select",
        options: [
          { label: "柱状图", value: "bar" },
          { label: "饼图", value: "pie" },
          { label: "折线图", value: "line" },
        ],
      },
      { key: "metrics", label: "统计指标", type: "metrics" },
    ],
    Render: ChartWidget,
  },
  "course-list": {
    type: "course-list",
    label: "课程列表",
    icon: <ReadOutlined />,
    defaultSpan: 12,
    defaultTitle: "课程推荐",
    createDefault: () => ({ limit: 6, layout: "card" }),
    configFields: [
      { key: "limit", label: "显示数量", type: "number", min: 1, max: 50 },
      {
        key: "layout",
        label: "展示样式",
        type: "select",
        options: [
          { label: "卡片", value: "card" },
          { label: "纯文本", value: "text" },
          { label: "表格", value: "table" },
        ],
      },
    ],
    Render: CourseListWidget,
  },
  "knowledge-points": {
    type: "knowledge-points",
    label: "知识点",
    icon: <PartitionOutlined />,
    defaultSpan: 12,
    defaultTitle: "知识点",
    createDefault: () => ({ limit: 12, layout: "tags" }),
    configFields: [
      { key: "limit", label: "显示数量", type: "number", min: 1, max: 100 },
      {
        key: "layout",
        label: "展示样式",
        type: "select",
        options: [
          { label: "标签", value: "tags" },
          { label: "列表", value: "list" },
        ],
      },
    ],
    Render: KnowledgePointsWidget,
  },
  carousel: {
    type: "carousel",
    label: "轮播图",
    icon: <PictureOutlined />,
    defaultSpan: 24,
    defaultTitle: "轮播图",
    createDefault: () => ({ limit: 5, autoPlay: true }),
    configFields: [
      { key: "limit", label: "显示数量", type: "number", min: 1, max: 10 },
      { key: "autoPlay", label: "自动播放", type: "switch" },
    ],
    Render: CarouselWidget,
  },
  image: {
    type: "image",
    label: "图片",
    icon: <PictureOutlined />,
    defaultSpan: 8,
    defaultTitle: "图片",
    createDefault: () => ({ src: "", link: "", caption: "" }),
    configFields: [
      { key: "src", label: "图片地址", type: "text", placeholder: "https:// 或 /assets/..." },
      { key: "link", label: "跳转链接", type: "text", placeholder: "应用内路径，如 /dashboard/overview" },
      { key: "caption", label: "说明文字", type: "text" },
    ],
    Render: ImageWidget,
  },
  video: {
    type: "video",
    label: "视频",
    icon: <PlayCircleOutlined />,
    defaultSpan: 12,
    defaultTitle: "视频",
    createDefault: () => ({ src: "", poster: "" }),
    configFields: [
      { key: "src", label: "视频地址", type: "text" },
      { key: "poster", label: "封面地址", type: "text" },
    ],
    Render: VideoWidget,
  },
  "icon-nav": {
    type: "icon-nav",
    label: "图标导航",
    icon: <AppstoreOutlined />,
    defaultSpan: 12,
    defaultTitle: "快捷入口",
    createDefault: () => ({
      items: [
        { label: "课程概述", to: "/dashboard/overview" },
        { label: "考试系统", to: "/dashboard/exam-courses" },
        { label: "互动课堂", to: "/dashboard/interaction" },
      ],
    }),
    configFields: [{ key: "items", label: "导航项", type: "options" }],
    Render: IconNavWidget,
  },
  table: {
    type: "table",
    label: "表格",
    icon: <TableOutlined />,
    defaultSpan: 12,
    defaultTitle: "表格",
    createDefault: () => ({ source: "courses", limit: 8 }),
    configFields: [
      {
        key: "source",
        label: "数据来源",
        type: "select",
        options: [
          { label: "课程", value: "courses" },
          { label: "知识点", value: "knowledge" },
        ],
      },
      { key: "limit", label: "显示数量", type: "number", min: 1, max: 50 },
    ],
    Render: TableWidget,
  },
  search: {
    type: "search",
    label: "搜索条",
    icon: <SearchOutlined />,
    defaultSpan: 24,
    defaultTitle: "搜索",
    createDefault: () => ({ placeholder: "搜索课程、知识点…" }),
    configFields: [
      { key: "placeholder", label: "占位提示", type: "text" },
    ],
    Render: SearchWidget,
  },
  date: {
    type: "date",
    label: "日期",
    icon: <CalendarOutlined />,
    defaultSpan: 8,
    defaultTitle: "",
    createDefault: () => ({ mode: "date", showWeekday: true, showTime: false }),
    configFields: [
      {
        key: "mode",
        label: "显示内容",
        type: "select",
        options: [
          { label: "日期", value: "date" },
          { label: "时间", value: "time" },
        ],
      },
      { key: "showWeekday", label: "显示星期", type: "switch" },
      { key: "showTime", label: "附带当前时间", type: "switch" },
    ],
    Render: DateWidget,
  },
  ip: {
    type: "ip",
    label: "IP",
    icon: <GlobalOutlined />,
    defaultSpan: 8,
    defaultTitle: "",
    createDefault: () => ({ label: "出口 IP" }),
    configFields: [{ key: "label", label: "标签", type: "text" }],
    Render: IpWidget,
  },
  map: {
    type: "map",
    label: "地图",
    icon: <EnvironmentOutlined />,
    defaultSpan: 24,
    defaultTitle: "地图",
    createDefault: () => ({ bbox: "116.30,39.95,116.45,40.05", height: 220 }),
    configFields: [
      {
        key: "bbox",
        label: "范围（minLon,minLat,maxLon,maxLat）",
        type: "text",
        placeholder: "116.30,39.95,116.45,40.05",
      },
      { key: "height", label: "高度(px)", type: "number", min: 120, max: 640 },
    ],
    Render: MapWidget,
  },
  plugin: {
    type: "plugin",
    label: "插件",
    icon: <ThunderboltOutlined />,
    defaultSpan: 8,
    defaultTitle: "插件",
    createDefault: () => ({
      label: "插件演示",
      description: "扩展能力展示（演示，无跳转）",
    }),
    configFields: [
      { key: "label", label: "按钮文案", type: "text" },
      { key: "description", label: "说明", type: "text" },
    ],
    Render: PluginWidget,
  },
};

export const BLOCK_LIST = Object.values(BLOCK_REGISTRY);

/** 用注册表补全/规范一个块（缺失 config 时取默认值） */
export function hydrateBlock(block: PortalBlock): PortalBlock {
  const def = BLOCK_REGISTRY[block.type];
  if (!def) return block;
  const defaults = def.createDefault();
  return {
    ...block,
    title: block.title ?? def.defaultTitle,
    span: block.span || def.defaultSpan || DEFAULT_SPAN,
    config: { ...defaults, ...block.config },
  };
}

/** 按类型创建默认块 */
export function createBlock(type: BlockType): PortalBlock {
  const def = BLOCK_REGISTRY[type];
  return {
    id: createBlockId(),
    type,
    title: def.defaultTitle,
    span: def.defaultSpan || DEFAULT_SPAN,
    config: def.createDefault(),
  };
}
