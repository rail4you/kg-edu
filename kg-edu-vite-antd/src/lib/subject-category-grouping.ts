import type { CatalogCourse, SubjectStat } from "@/hooks/use-course-catalog";
import { buildSubjectStats } from "@/hooks/use-course-catalog";

/**
 * 学科分类归类（学银在线风格 - 按教育层次分 4 个面板）
 *
 * - 研究生：13 门类 + 交叉学科 + 公共基础课（本科）
 * - 本科：13 门类 + 公共基础课（本科）
 * - 高职：8 个热门高职大类 + 公共基础课（高职）
 * - 中职：8 个热门高职大类（侧重动手技能，数量与本科/研究生对齐）
 */

export type SubjectCategoryKey = "graduate" | "undergraduate" | "higher-vocational" | "secondary-vocational";

export type SubjectCategoryAccent = "blue" | "purple" | "green" | "orange";

export interface SubjectCategoryConfig {
  key: SubjectCategoryKey;
  title: string;
  subtitle: string;
  accent: SubjectCategoryAccent;
  subjectCodes: string[];
}

export const SUBJECT_CATEGORY_CONFIGS: SubjectCategoryConfig[] = [
  {
    key: "graduate",
    title: "研究生",
    subtitle: "学术型 / 专业学位",
    accent: "blue",
    subjectCodes: [
      "interdisciplinary",
      "public-undergraduate",
      "philosophy",
      "economics",
      "law",
      "education",
      "literature",
      "history",
      "science",
      "engineering",
      "agriculture",
      "medicine",
      "management",
      "arts",
      "military",
    ],
  },
  {
    key: "undergraduate",
    title: "本科",
    subtitle: "13 个学科门类",
    accent: "purple",
    subjectCodes: [
      "philosophy",
      "economics",
      "law",
      "education",
      "literature",
      "history",
      "science",
      "engineering",
      "agriculture",
      "medicine",
      "management",
      "arts",
      "military",
      "public-undergraduate",
    ],
  },
  {
    key: "higher-vocational",
    title: "高职",
    subtitle: "热门专业大类",
    accent: "blue",
    subjectCodes: [
      "public-vocational",
      "electronics-info",
      "equipment",
      "medical-vocational",
      "business",
      "civil-construction",
      "transportation",
      "sports-education",
    ],
  },
  {
    key: "secondary-vocational",
    title: "中职",
    subtitle: "动手技能型课程",
    accent: "orange",
    subjectCodes: [
      "public-vocational",
      "electronics-info",
      "equipment",
      "business",
      "medical-vocational",
      "transportation",
      "tourism",
      "culture-arts",
    ],
  },
];

export interface SubjectCategoryPanel {
  config: SubjectCategoryConfig;
  subjects: SubjectStat[];
  totalCourses: number;
  hasAny: boolean;
}

/** 每个分类面板对应的教育层次（课程 education_level 字段值） */
export const CATEGORY_EDUCATION_LEVEL: Record<SubjectCategoryKey, string> = {
  graduate: "graduate",
  undergraduate: "undergraduate",
  "higher-vocational": "higher_vocational",
  "secondary-vocational": "secondary_vocational",
};

/**
 * 把真实课程数据分配到 4 个分类面板。
 * - 每个面板只统计对应教育层次（education_level）的课程，用真实数据驱动
 * - 展示配置中的全部专业大类（即使暂未开课也会列出）
 * - 有课程的按 count 倒序排在前面
 * - `titleOverrides` 用于覆盖面板标题（门户配置中的动态层级名称）
 */
export function buildSubjectCategoryPanels(
  courses: CatalogCourse[],
  titleOverrides?: Record<string, { title: string; subtitle: string }>,
): SubjectCategoryPanel[] {
  return SUBJECT_CATEGORY_CONFIGS.map((config) => {
    const override =
      titleOverrides?.[config.key] ??
      titleOverrides?.[CATEGORY_EDUCATION_LEVEL[config.key]];
    const effectiveConfig = override
      ? {
          ...config,
          title: override.title || config.title,
          subtitle: override.subtitle || config.subtitle,
        }
      : config;

    const level = CATEGORY_EDUCATION_LEVEL[config.key];
    const levelStats = buildSubjectStats(courses, level);

    const subjects = effectiveConfig.subjectCodes
      .map((code) => levelStats.find((subject) => subject.code === code))
      .filter((subject): subject is SubjectStat => Boolean(subject))
      .sort((left, right) => right.count - left.count);

    const totalCourses = subjects.reduce((sum, subject) => sum + subject.count, 0);

    return {
      config: effectiveConfig,
      subjects,
      totalCourses,
      hasAny: totalCourses > 0,
    };
  });
}