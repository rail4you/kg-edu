import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  listMicroMajors,
  getMicroMajor,
  assignStudentToMicroMajor,
  listCoursesByMicroMajor,
} from "@/lib/ash_rpc";

export interface MicroMajor {
  id: string;
  name: string;
  projectBackground?: string | null;
  knowledgeObjective?: string | null;
  abilityObjective?: string | null;
  qualityObjective?: string | null;
  projectFeatures?: string | null;
  learningCycle?: string | null;
  assessmentMethod?: string | null;
  tuitionFee?: string | null;
  coverUrl?: string | null;
  intro?: string | null;
  responsibleTeacherId?: string | null;
  consultantTeacherId?: string | null;
  sortOrder?: number;
  publishedAt?: string | null;
  insertedAt?: string | null;
  updatedAt?: string | null;
  status?: "draft" | "active" | "archived";
  responsibleTeacher?: MicroMajorTeacher | null;
  consultantTeacher?: MicroMajorTeacher | null;
  microMajorCourses?: MicroMajorCourse[];
  courses?: Array<{ id: string; title: string; description?: string | null }>;
}

export interface MicroMajorTeacher {
  id: string;
  name?: string | null;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  bio?: string | null;
  colledge?: string | null;
  major?: string | null;
}

export interface MicroMajorCourse {
  id: string;
  microMajorId: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  teacherId?: string | null;
  semester?: string | null;
  sortOrder: number;
  credits?: number | null;
  semesterHours?: number | null;
}

const TALENT_DIRECTION_LABELS: Record<string, string> = {
  urgent_needed: "急缺人才",
  applied_skill: "应用技能",
  interdisciplinary: "交叉学科",
  other: "其他方向",
};

function extractResults<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && "results" in data) {
    const results = (data as { results?: unknown }).results;
    return Array.isArray(results) ? results as T[] : [];
  }
  return [];
}

export function useMicroMajorCatalog(tenant: string) {
  const { user } = useAuth();
  const headers = user ? getAuthHeaders(user) as Record<string, string> : undefined;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["micro-major-catalog", tenant],
    queryFn: async () => {
      const result = await listMicroMajors({
        tenant,
        fields: [
          "id",
          "name",
          "projectBackground",
          "knowledgeObjective",
          "abilityObjective",
          "qualityObjective",
          "projectFeatures",
          "learningCycle",
          "assessmentMethod",
          "tuitionFee",
          "coverUrl",
          "intro",
          "sortOrder",
          "publishedAt",
          "status",
          { responsibleTeacher: ["id", "name", "avatarUrl", "jobTitle", "bio", "colledge", "major"] },
          { consultantTeacher: ["id", "name", "avatarUrl", "jobTitle", "bio", "colledge", "major"] },
          { microMajorCourses: ["id", "microMajorId", "courseId", "courseType", "semester", "sortOrder", "credits", "semesterHours"] },
        ],
        sort: "sortOrder",
        page: { limit: 100, offset: 0 },
        headers,
      });
      
      if (!result.success) {
        throw new Error("获取微专业列表失败");
      }
      
      return extractResults<MicroMajor>(result.data);
    },
    enabled: !!tenant,
    staleTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const microMajors = useMemo(() => (data || []).filter(m => m.status === "active"), [data]);

  return {
    microMajors,
    isLoading,
    error,
    refetch,
  };
}

export function useMicroMajorDetail(tenant: string, microMajorId: string) {
  const { user } = useAuth();
  const headers = user ? getAuthHeaders(user) as Record<string, string> : undefined;

  const { data: major, isLoading: majorLoading, error: majorError, refetch: refetchMajor } = useQuery({
    queryKey: ["micro-major-detail", tenant, microMajorId],
    queryFn: async () => {
      const result = await getMicroMajor({
        tenant,
        input: { id: microMajorId },
        fields: [
          "id",
          "name",
          "projectBackground",
          "knowledgeObjective",
          "abilityObjective",
          "qualityObjective",
          "projectFeatures",
          "learningCycle",
          "assessmentMethod",
          "tuitionFee",
          "coverUrl",
          "intro",
          "responsibleTeacherId",
          "consultantTeacherId",
          "sortOrder",
          "publishedAt",
          "status",
          { responsibleTeacher: ["id", "name", "avatarUrl", "jobTitle", "bio", "colledge", "major"] },
          { consultantTeacher: ["id", "name", "avatarUrl", "jobTitle", "bio", "colledge", "major"] },
        ],
        headers,
      });
      
      if (!result.success) {
        throw new Error("获取微专业详情失败");
      }
      
      return result.data as MicroMajor;
    },
    enabled: !!tenant && !!microMajorId,
  });

  const { data: courses, isLoading: coursesLoading, refetch: refetchCourses } = useQuery({
    queryKey: ["micro-major-courses", tenant, microMajorId],
    queryFn: async () => {
      const result = await listCoursesByMicroMajor({
        tenant,
        input: { microMajorId },
        fields: [
          "id",
          "microMajorId",
          "title",
          "description",
          "imageUrl",
          "teacherId",
          "semester",
          "sortOrder",
          "credits",
          "semesterHours",
        ],
        headers,
      });
      
      if (!result.success) {
        return [];
      }
      
      return extractResults<MicroMajorCourse>(result.data);
    },
    enabled: !!tenant && !!microMajorId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  return {
    major,
    courses: courses || [],
    isLoading: majorLoading || coursesLoading,
    error: majorError,
    refetch: () => {
      refetchMajor();
      refetchCourses();
    },
  };
}

export async function handleSelectMicroMajor(
  tenant: string,
  microMajorId: string,
  user: Parameters<typeof getAuthHeaders>[0] & { id: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const headers = getAuthHeaders(user) as Record<string, string>;
    const result = await assignStudentToMicroMajor({
      tenant,
      input: { microMajorId, studentId: user.id },
      fields: ["id", "microMajorId", "studentId", "status"],
      headers,
    });
    
    if (!result.success) {
      return { success: false, error: "选择失败" };
    }
    
    return { success: true };
  } catch {
    return { success: false, error: "选择失败，请重试" };
  }
}

export function getTalentDirectionLabel(direction?: string | null): string {
  if (!direction) return "未知方向";
  return TALENT_DIRECTION_LABELS[direction] || direction;
}

export function getCourseTypeLabel(type?: string): string {
  if (type === "required") return "必修";
  if (type === "elective") return "选修";
  return type || "未知";
}

export function getSupportRoleLabel(role?: string): string {
  if (role === "core") return "核心";
  if (role === "supporting") return "支撑";
  if (role === "practice") return "实践";
  return role || "未知";
}
