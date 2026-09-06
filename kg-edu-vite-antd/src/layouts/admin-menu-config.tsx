import type { ReactNode } from "react";
import {
  BankOutlined,
  BgColorsOutlined,
  ClusterOutlined,
  DashboardOutlined,
  FileTextOutlined,
  KeyOutlined,
  LayoutOutlined,
  LockOutlined,
  TagsOutlined,
  MonitorOutlined,
  ProfileOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";

export interface AdminNavigationItem {
  path: string;
  name: string;
  description: string;
  icon: ReactNode;
  color: string;
}

const dashboardItem: AdminNavigationItem = {
  path: "/admin/dashboard",
  name: "管理控制台",
  description: "查看管理员常用入口和系统概览",
  icon: <DashboardOutlined />,
  color: "#1677ff",
};

const superAdminItems: AdminNavigationItem[] = [
  {
    path: "/admin/dashboard/organizations",
    name: "租户管理",
    description: "管理租户信息、启停状态和接入配置",
    icon: <BankOutlined />,
    color: "#722ed1",
  },
  {
    path: "/admin/dashboard/api-key-config",
    name: "API Key 配置",
    description: "管理 AI 服务 API Key（通义千问等）",
    icon: <KeyOutlined />,
    color: "#eb2f96",
  },
  {
    path: "/admin/dashboard/site-content",
    name: "站点内容",
    description: "配置平台简介、联系我们、隐私条款等展示文案",
    icon: <ProfileOutlined />,
    color: "#13c2c2",
  },
  {
    path: "/admin/dashboard/portal-config",
    name: "门户配置",
    description: "配置学历层级名称与模板页（首页导航动态内容）",
    icon: <LayoutOutlined />,
    color: "#fa8c16",
  },
  {
    path: "/admin/dashboard/course-categories",
    name: "门户课程类别",
    description: "配置首页推荐/新开等课程模块与课程列表 Tab（按租户选课）",
    icon: <TagsOutlined />,
    color: "#eb2f96",
  },
  {
    path: "/admin/dashboard/branding",
    name: "品牌配置",
    description: "配置 Logo、应用名称与页脚版权（全站生效）",
    icon: <BgColorsOutlined />,
    color: "#722ed1",
  },
];

const standardItems: AdminNavigationItem[] = [
  {
    path: "/admin/dashboard/admins",
    name: "管理员管理",
    description: "维护管理员账号、角色和访问权限",
    icon: <SafetyCertificateOutlined />,
    color: "#eb2f96",
  },
  {
    path: "/admin/dashboard/teachers",
    name: "教师管理",
    description: "管理教师资料、账号状态和组织归属",
    icon: <TeamOutlined />,
    color: "#1677ff",
  },
  {
    path: "/admin/dashboard/students",
    name: "学生管理",
    description: "管理学生信息、学籍和班级关联",
    icon: <UserOutlined />,
    color: "#13c2c2",
  },
  {
    path: "/admin/dashboard/classes",
    name: "班级管理",
    description: "创建、编辑和管理班级，关联学生信息",
    icon: <ClusterOutlined />,
    color: "#52c41a",
  },
  {
    path: "/admin/dashboard/groups",
    name: "小组管理",
    description: "创建学生小组，分配成员和管理分组",
    icon: <TeamOutlined />,
    color: "#fa8c16",
  },
  {
    path: "/admin/dashboard/permissions",
    name: "权限管理",
    description: "配置角色权限和访问控制策略",
    icon: <LockOutlined />,
    color: "#faad14",
  },
  {
    path: "/admin/dashboard/system",
    name: "系统状态",
    description: "查看系统运行状态和性能指标",
    icon: <MonitorOutlined />,
    color: "#2f54eb",
  },
  {
    path: "/admin/dashboard/logs",
    name: "系统日志",
    description: "监控系统日志和审计记录",
    icon: <FileTextOutlined />,
    color: "#f5222d",
  },
];

export function getAdminNavigationItems(role?: string): AdminNavigationItem[] {
  return [
    dashboardItem,
    ...(role === "super_admin" ? superAdminItems : []),
    ...standardItems,
  ];
}

export function getAdminDashboardItems(role?: string): AdminNavigationItem[] {
  return getAdminNavigationItems(role).filter((item) => item.path !== dashboardItem.path);
}
