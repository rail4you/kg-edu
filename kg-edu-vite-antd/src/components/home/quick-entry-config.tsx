import type { ReactNode } from "react";
import {
  BookOutlined,
  BulbOutlined,
  CloudOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  RocketOutlined,
} from "@ant-design/icons";

export interface QuickEntryItem {
  key: string;
  label: string;
  href: string;
  icon: ReactNode;
  color: string;
  gradient: string;
}

/**
 * 首页 6 个快速入口（学银在线风格 3×2 网格）
 * 顺序：智慧课程 / 微专业 / 数字教材 / 教学资源库 / 示范教学包 / 关于我们
 */
export const QUICK_ENTRIES: QuickEntryItem[] = [
  {
    key: "smart-courses",
    label: "智慧课程",
    href: "/courses",
    icon: <BookOutlined />,
    color: "#1677FF",
    gradient: "linear-gradient(135deg, #1677FF 0%, #5B9BFF 100%)",
  },
  {
    key: "micro-majors",
    label: "微专业",
    href: "/micro-majors",
    icon: <RocketOutlined />,
    color: "#16B67F",
    gradient: "linear-gradient(135deg, #16B67F 0%, #4FD7A4 100%)",
  },
  {
    key: "textbook",
    label: "数字教材",
    href: "/textbook",
    icon: <FileTextOutlined />,
    color: "#2FA8FF",
    gradient: "linear-gradient(135deg, #2FA8FF 0%, #6DC4FF 100%)",
  },
  {
    key: "resources",
    label: "教学资源库",
    href: "/resources",
    icon: <CloudOutlined />,
    color: "#FF8A3D",
    gradient: "linear-gradient(135deg, #FF8A3D 0%, #FFB27A 100%)",
  },
  {
    key: "demo",
    label: "示范教学包",
    href: "/demo",
    icon: <BulbOutlined />,
    color: "#1677FF",
    gradient: "linear-gradient(135deg, #1677FF 0%, #5B9BFF 100%)",
  },
  {
    key: "about",
    label: "关于我们",
    href: "/about",
    icon: <InfoCircleOutlined />,
    color: "#FFB400",
    gradient: "linear-gradient(135deg, #FFB400 0%, #FFD062 100%)",
  },
];