import type { MenuDataItem } from "@ant-design/pro-components";

export const teacherMenuData: MenuDataItem[] = [
  {
    path: "/teacher/dashboard",
    name: "教师工作台",
    icon: "home",
  },
  {
    path: "/teacher/dashboard/ai",
    name: "AI 工作台",
    icon: "robot",
    children: [
      {
        path: "/teacher/dashboard/chat-x",
        name: "AI 助手",
      },
    ],
  },
  {
    path: "/teacher/dashboard/knowledge-resource",
    name: "知识点管理",
    icon: "book",
  },
  {
    path: "/teacher/dashboard/knowledge-relation",
    name: "知识关系",
    icon: "apartment",
  },
  {
    path: "/teacher/dashboard/course",
    name: "课程管理",
    icon: "read",
  },
  {
    path: "/teacher/dashboard/exercise",
    name: "习题管理",
    icon: "file-text",
  },
  {
    path: "/teacher/dashboard/exam-management",
    name: "考试管理",
    icon: "schedule",
  },
  {
    path: "/teacher/dashboard/homework",
    name: "作业管理",
    icon: "solution",
  },
  {
    path: "/teacher/dashboard/student-enrollment",
    name: "学生管理",
    icon: "team",
  },
  {
    path: "/teacher/dashboard/course-evaluation",
    name: "课程评价管理",
    icon: "message",
  },
];

export const studentMenuData: MenuDataItem[] = [
  {
    path: "/dashboard",
    name: "学习中心",
    icon: "home",
  },
  {
    path: "/dashboard/course",
    name: "我的课程",
    icon: "read",
  },
  {
    path: "/dashboard/exam-courses",
    name: "我的考试",
    icon: "schedule",
  },
  {
    path: "/dashboard/graph",
    name: "知识图谱",
    icon: "partition",
    children: [
      {
        path: "/dashboard/graph",
        name: "图谱总览",
      },
      {
        path: "/dashboard/graph-category",
        name: "课程知识体系",
      },
      {
        path: "/dashboard/graph-layer",
        name: "图谱层级",
      },
    ],
  },
];

export const adminMenuData: MenuDataItem[] = [
  {
    path: "/admin/dashboard",
    name: "管理控制台",
    icon: "dashboard",
  },
  {
    path: "/admin/dashboard/admins",
    name: "管理员管理",
    icon: "safety-certificate",
  },
  {
    path: "/admin/dashboard/teachers",
    name: "教师管理",
    icon: "team",
  },
  {
    path: "/admin/dashboard/students",
    name: "学生管理",
    icon: "user",
  },
  {
    path: "/admin/dashboard/classes",
    name: "班级管理",
    icon: "cluster",
  },
  {
    path: "/admin/dashboard/permissions",
    name: "权限管理",
    icon: "lock",
  },
  {
    path: "/admin/dashboard/system",
    name: "系统状态",
    icon: "monitor",
  },
  {
    path: "/admin/dashboard/logs",
    name: "系统日志",
    icon: "fileText",
  },
];
