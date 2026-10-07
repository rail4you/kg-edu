import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

export interface PortalCourse {
  id: string;
  title: string;
  description?: string | null;
}

export interface KnowledgePoint {
  id: string;
  name: string;
  description?: string | null;
  courseId?: string;
  courseTitle?: string;
}

export interface SmartPortalStats {
  courses: number;
  students: number;
  videos: number;
  exercises: number;
}

export interface SmartPortalData {
  courses: PortalCourse[];
  knowledgePoints: KnowledgePoint[];
  stats: SmartPortalStats;
  loading: boolean;
  errorSources: string[];
}

export const EMPTY_SMART_PORTAL_DATA: SmartPortalData = {
  courses: [],
  knowledgePoints: [],
  stats: { courses: 0, students: 0, videos: 0, exercises: 0 },
  loading: false,
  errorSources: [],
};

function resolveTenant(override?: string): string {
  if (override) return override;
  if (typeof window === "undefined") return "";
  return (
    sessionStorage.getItem("tenant") ||
    getCurrentTenant()?.schemaName ||
    ""
  );
}

function countOf(data: any): number {
  if (typeof data?.count === "number") return data.count;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.results)) return data.results.length;
  return 0;
}

function arrayOf(data: any): any[] {
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

/**
 * 按租户拉取智慧门户所需的动态数据。
 * 各数据源独立请求、`allSettled` 隔离失败，单个失败不影响其它组件。
 */
export function useSmartPortalData(tenantOverride?: string) {
  const { user } = useAuth();
  const tenant = resolveTenant(tenantOverride);

  return useQuery<SmartPortalData>({
    queryKey: ["smart-portal-data", tenant],
    enabled: !!tenant,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const token = sessionStorage.getItem("jwt_access_token") || "";
      const authHeaders = getAuthHeaders(user) as Record<string, string>;
      const baseHeaders: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...authHeaders,
      };

      const run = async (
        action: string,
        fields: string[],
        limit = 1,
        filter?: any
      ) => {
        const res = await fetch("/rpc/run", {
          method: "POST",
          headers: baseHeaders,
          body: JSON.stringify({
            action,
            tenant,
            input: {},
            fields,
            page: { limit, count: true },
            ...(filter ? { filter } : {}),
          }),
        }).then((r) => r.json());
        return res?.data;
      };

      const errorSources: string[] = [];
      const settled = await Promise.allSettled([
        run("list_courses", ["id", "title", "description"], 100),
        run("list_users", ["id"], 1, { role: { eq: "user" } }),
        run("list_videos", ["id"], 1),
        run("list_exercises", ["id"], 1),
        run("list_knowledges", ["id", "name", "description", "course_id"], 200, {
          knowledge_type: { eq: "knowledge_cell" },
        }),
      ]);

      const [coursesR, studentsR, videosR, exercisesR, knowledgeR] = settled;
      const valueOf = <T,>(r: PromiseSettledResult<T>): T | null => {
        if (r.status === "fulfilled") return r.value as unknown as T;
        return null;
      };
      const labels = ["courses", "students", "videos", "exercises", "knowledge"];
      settled.forEach((r, i) => {
        if (r.status === "rejected") errorSources.push(labels[i]);
      });

      const coursesData = valueOf(coursesR as PromiseSettledResult<any>);
      const courses: PortalCourse[] = arrayOf(coursesData).map((c) => ({
        id: String(c.id),
        title: c.title || "未命名课程",
        description: c.description ?? null,
      }));
      const courseTitleById = new Map(courses.map((c) => [c.id, c.title]));
      const visibleCourseIds = new Set(courses.map((c) => c.id));

      // 知识点仅保留当前用户可见课程下的（list_courses 已按可见范围过滤），
      // 避免出现无法关联课程的“孤立”知识点
      const knowledgePoints: KnowledgePoint[] = arrayOf(
        valueOf(knowledgeR as PromiseSettledResult<any>)
      )
        .map((k) => {
          const courseId = k.courseId ?? k.course_id ?? undefined;
          return {
            id: String(k.id),
            name: k.name || k.title || "未命名知识点",
            description: k.description ?? null,
            courseId: courseId ? String(courseId) : undefined,
            courseTitle: courseId ? courseTitleById.get(String(courseId)) : undefined,
          };
        })
        .filter((k) => !!k.courseId && visibleCourseIds.has(k.courseId));

      return {
        courses,
        knowledgePoints,
        stats: {
          courses: countOf(coursesData),
          students: countOf(valueOf(studentsR as PromiseSettledResult<any>)),
          videos: countOf(valueOf(videosR as PromiseSettledResult<any>)),
          exercises: countOf(valueOf(exercisesR as PromiseSettledResult<any>)),
        },
        loading: false,
        errorSources,
      };
    },
  });
}
