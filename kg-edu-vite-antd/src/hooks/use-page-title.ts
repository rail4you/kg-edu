import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getCachedBranding, DEFAULT_BRANDING } from "@/config/branding";

function getAppName(): string {
  try {
    const branding = getCachedBranding();
    return branding?.app_title || DEFAULT_BRANDING.app_title;
  } catch {
    return DEFAULT_BRANDING.app_title;
  }
}

const APP_NAME = getAppName();

/**
 * 路由路径到页面标题的映射
 * 标题格式：页面名称 - 智慧教学系统
 */
const TITLE_MAP: Record<string, string> = {
  // 首页 / 登录
  "/": "首页",
  "/login": "登录",

  // ===== 教师端 =====
  "/teacher/dashboard": "教学概览",
  "/teacher/dashboard/virtual-research-room": "虚拟教研室",
  "/teacher/dashboard/ai-assistant": "AI 助手",
  "/teacher/dashboard/ai-exercise": "AI 出题",
  "/teacher/dashboard/ai-file": "AI 文件",
  "/teacher/dashboard/ai-command": "AI 指令",
  "/teacher/dashboard/course": "课程管理",
  "/teacher/dashboard/course-category": "课程分类",
  "/teacher/dashboard/assign-course": "分配课程",
  "/teacher/dashboard/student-enrollment": "学生选课",
  "/teacher/dashboard/course-info": "课程信息",
  "/teacher/dashboard/book-info": "教材信息",
  "/teacher/dashboard/link": "链接管理",
  "/teacher/dashboard/course-video": "课程视频",
  "/teacher/dashboard/course-evaluation": "课程评价管理",
  "/teacher/dashboard/discussion-session": "讨论会话",
  "/teacher/dashboard/knowledge-resource": "知识管理",
  "/teacher/dashboard/knowledge-relation": "知识关系",
  "/teacher/dashboard/knowledge-cognitive-goals": "知识认知目标",
  "/teacher/dashboard/knowledge-file": "知识文件",
  "/teacher/dashboard/manual": "使用手册",
  "/teacher/dashboard/graph-knowledge": "知识图谱",
  "/teacher/dashboard/graph-tree": "图谱树",
  "/teacher/dashboard/graph-competency": "能力图谱",
  "/teacher/dashboard/graph-ideological": "思政图谱",
  "/teacher/dashboard/graph-question": "问题图谱",
  "/teacher/dashboard/graph-circle": "圈子图谱",
  "/teacher/dashboard/graph-course": "课程图谱",
  "/teacher/dashboard/chapter": "章节管理",
  "/teacher/dashboard/file": "文件管理",
  "/teacher/dashboard/video": "视频管理",
  "/teacher/dashboard/exercise": "练习管理",
  "/teacher/dashboard/question": "题目管理",
  "/teacher/dashboard/homework": "作业管理",
  "/teacher/dashboard/exam-management": "考试管理",
  "/teacher/dashboard/exam-exercises": "考试题目",
  "/teacher/dashboard/exam-statistics": "考试统计",
  "/teacher/dashboard/exam-grading": "考试阅卷",
  "/teacher/dashboard/exam-grade-detail": "成绩详情",
  "/teacher/dashboard/check-in-management": "签到管理",
  "/teacher/dashboard/experiment-management": "实验管理",
  "/teacher/dashboard/experiment-detail": "实验详情",
  "/teacher/dashboard/experiment-form": "实验表单",
  "/teacher/dashboard/course-statistics": "课程统计",
  "/teacher/dashboard/learning-statistics": "学习统计",
  "/teacher/dashboard/learning-recommendations": "学习推荐",
  "/teacher/dashboard/activity-summary": "活动总结",
  "/teacher/dashboard/email-config": "邮件配置",
  "/teacher/dashboard/email-messages": "邮件消息",
  "/teacher/dashboard/settings": "系统设置",
  "/teacher/dashboard/teachers": "教师团队",
  "/teacher/dashboard/template-management": "模板管理",
  "/teacher/dashboard/relation-type": "关系类型",
  "/teacher/dashboard/summary": "课程统计",
  "/teacher/dashboard/study-summary": "学习统计",
  "/teacher/dashboard/video-uploader": "视频上传",
  "/teacher/dashboard/api": "API 调试",
  "/teacher/dashboard/chat": "AI 对话",
  "/teacher/dashboard/ai-discussion": "AI 讨论",

  // ===== 学生端 =====
  "/dashboard/front": "学生首页",
  "/dashboard/overview": "课程概述",
  "/dashboard/intro": "课程概览",
  "/dashboard/course-video": "课程视频",
  "/dashboard/knowledge-cognitive-goals": "认知目标",
  "/dashboard/resource": "教学资源",
  "/dashboard/discussions": "课堂讨论",
  "/dashboard/group-tasks": "小组任务",
  "/dashboard/exam-courses": "考试系统",
  "/dashboard/experiment-courses": "实验系统",
  "/dashboard/experiment-detail": "实验详情",
  "/dashboard/exam-list": "考试列表",
  "/dashboard/exam-taking": "参加考试",
  "/dashboard/micro-majors": "微专业",
  "/dashboard/graph": "知识图谱",
  "/dashboard/graph-layer": "图谱层级",
  "/dashboard/graph-category": "课程知识体系",
  "/dashboard/graph-competency": "能力图谱",
  "/dashboard/email-qa": "邮件问答",
  "/dashboard/learning-recommendations": "学习推荐",
  "/dashboard/teacher": "教师团队",
  "/dashboard/chat": "在线交流",
  "/dashboard/course-info": "课程信息",
  "/dashboard/course-album": "课程相册",
  "/dashboard/manual": "使用手册",

  // ===== 管理端 =====
  "/admin/dashboard": "管理控制台",
  "/admin/dashboard/organizations": "租户管理",
  "/admin/dashboard/admins": "管理员管理",
  "/admin/dashboard/teachers": "教师管理",
  "/admin/dashboard/students": "学生管理",
  "/admin/dashboard/classes": "班级管理",
  "/admin/dashboard/permissions": "权限管理",
  "/admin/dashboard/system": "系统状态",
  "/admin/dashboard/logs": "系统日志",
  "/admin/dashboard/site-content": "站点内容",
};

/**
 * 动态路径匹配规则（正则 -> 标题）
 */
const DYNAMIC_ROUTE_MAP: [RegExp, string][] = [
  [/^\/student\/check-in\//, "课堂签到"],
  [/^\/student\/discussion\//, "课堂讨论"],
  [/^\/student\/group-task\//, "小组任务"],
];

/**
 * 根据路径匹配标题，支持带动态参数的路径
 */
function getTitle(pathname: string): string {
  // 精确匹配
  if (TITLE_MAP[pathname]) {
    return `${TITLE_MAP[pathname]} - ${APP_NAME}`;
  }

  // 动态路径匹配
  for (const [regex, title] of DYNAMIC_ROUTE_MAP) {
    if (regex.test(pathname)) {
      return `${title} - ${APP_NAME}`;
    }
  }

  // 对带参数的路径做前缀匹配
  const entries = Object.entries(TITLE_MAP).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [path, title] of entries) {
    if (pathname.startsWith(path)) {
      return `${title} - ${APP_NAME}`;
    }
  }

  return APP_NAME;
}

export function usePageTitle() {
  const location = useLocation();

  useEffect(() => {
    document.title = getTitle(location.pathname);
  }, [location.pathname]);
}
