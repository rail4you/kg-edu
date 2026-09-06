import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCourseCategories,
  type CourseCategory,
} from "@/lib/course-categories";
import {
  useCourseCatalog,
  type CatalogCourse,
} from "@/hooks/use-course-catalog";

/** 类别 + 匹配后的课程列表 */
export interface CourseCategorySection {
  category: CourseCategory;
  courses: CatalogCourse[];
}

/**
 * 课程类别（公开只读，缓存 60s）。
 * 每个类别按 (租户 schema + 课程 id) 从全局课程目录中匹配管理端配置的课程。
 * 类别未配置课程时返回空列表（不自动填充）。
 */
export function useCourseCategories() {
  const { courses, isLoading } = useCourseCatalog();

  const { data: categories = [] } = useQuery({
    queryKey: ["course-categories"],
    queryFn: fetchCourseCategories,
    staleTime: 60_000,
  });

  const sections: CourseCategorySection[] = useMemo(() => {
    return categories
      .filter((cat) => cat.enabled)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cat) => {
        const matched: CatalogCourse[] =
          cat.items.length > 0
            ? cat.items
                .map((item) =>
                  courses.find(
                    (c) => c.orgSchemaName === item.tenantSchema && c.id === item.courseId
                  )
                )
                .filter((c): c is CatalogCourse => Boolean(c))
            : [];
        return { category: cat, courses: matched };
      });
  }, [categories, courses]);

  return { categories: sections, isLoading };
}

export type { CourseCategory };
