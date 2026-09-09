/**
 * 快捷导航图标预置库
 * - 全部图标位于 public/icons/home/<value>.svg，风格统一（120x120 线性彩色）
 * - 前 7 个为原有图标（保证已有页面效果不变），后 12 个为新增教育通用图标
 * - TemplatePage.icon 存储 value；为空时按 slug 自动匹配（兼容老数据）
 */

export interface QuickNavIconOption {
  /** 存储值，对应 public/icons/home/<value>.svg */
  value: string;
  /** 中文名称（管理端选择器展示） */
  label: string;
  /** 图片地址 */
  src: string;
}

export const QUICK_NAV_ICON_OPTIONS: QuickNavIconOption[] = [
  // ---- 原有图标（保持兼容） ----
  { value: "course", label: "智慧课程", src: "/icons/home/course.svg" },
  { value: "micro_major", label: "微专业", src: "/icons/home/micro_major.svg" },
  { value: "resource_library", label: "教学资源库", src: "/icons/home/resource_library.svg" },
  { value: "demo_package", label: "示范教学包", src: "/icons/home/demo_package.svg" },
  { value: "digital_textbook", label: "数字教材", src: "/icons/home/digital_textbook.svg" },
  { value: "partners", label: "合作单位", src: "/icons/home/partners.svg" },
  { value: "about_us", label: "关于我们", src: "/icons/home/about_us.svg" },
  // ---- 新增教育通用图标 ----
  { value: "exam", label: "考试测验", src: "/icons/home/exam.svg" },
  { value: "certificate", label: "证书认证", src: "/icons/home/certificate.svg" },
  { value: "live_class", label: "直播课堂", src: "/icons/home/live_class.svg" },
  { value: "experiment", label: "实验实训", src: "/icons/home/experiment.svg" },
  { value: "homework", label: "作业练习", src: "/icons/home/homework.svg" },
  { value: "schedule", label: "课程表", src: "/icons/home/schedule.svg" },
  { value: "discussion", label: "讨论问答", src: "/icons/home/discussion.svg" },
  { value: "video_course", label: "视频课程", src: "/icons/home/video_course.svg" },
  { value: "analytics", label: "学情分析", src: "/icons/home/analytics.svg" },
  { value: "announcement", label: "通知公告", src: "/icons/home/announcement.svg" },
  { value: "books", label: "图书文献", src: "/icons/home/books.svg" },
  { value: "graduation_cap", label: "学位毕业", src: "/icons/home/graduation_cap.svg" },
];

const ICON_SRC_MAP = new Map(QUICK_NAV_ICON_OPTIONS.map((o) => [o.value, o.src]));

/** 固定路由的默认图标（课程 / 微专业） */
const FIXED_ICON_SRC: Record<string, string> = {
  "/courses": "/icons/home/course.svg",
  "/micro-majors": "/icons/home/micro_major.svg",
};

/** 动态模板页 slug 关键字兜底（老数据 icon 为空时，保证已有图标文字效果不变） */
const SLUG_FALLBACK: Array<{ match: (slug: string) => boolean; src: string }> = [
  { match: (s) => s.includes("about"), src: "/icons/home/about_us.svg" },
  { match: (s) => s.includes("partner"), src: "/icons/home/partners.svg" },
  { match: (s) => s.includes("resource"), src: "/icons/home/resource_library.svg" },
  { match: (s) => s.includes("textbook"), src: "/icons/home/digital_textbook.svg" },
  { match: (s) => s.includes("demo"), src: "/icons/home/demo_package.svg" },
];

/**
 * 解析快捷导航图标地址
 * 优先级：显式 icon 配置 > 固定路由默认 > slug 关键字兜底 > 默认首个图标
 */
export function getQuickNavIconSrc(navKey: string, icon?: string): string {
  if (icon && ICON_SRC_MAP.has(icon)) {
    return ICON_SRC_MAP.get(icon)!;
  }
  if (FIXED_ICON_SRC[navKey]) {
    return FIXED_ICON_SRC[navKey];
  }
  const slug = navKey.replace("/page/", "");
  for (const fb of SLUG_FALLBACK) {
    if (fb.match(slug)) return fb.src;
  }
  // 兼容：直接拼接（允许未来新增 svg 无需改代码即可显示）
  if (icon) {
    return `/icons/home/${icon}.svg`;
  }
  return "/icons/home/course.svg";
}

/** 校验 icon 是否为预置值（非预置返回 ""，渲染时走兜底） */
export function normalizeQuickNavIcon(icon: string | undefined): string {
  if (!icon) return "";
  return ICON_SRC_MAP.has(icon) ? icon : "";
}
