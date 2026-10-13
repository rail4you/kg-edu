import { useMemo, useCallback, useEffect, useRef } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { Select, Typography, Space, Tag } from "antd";
import { useQuery } from "@tanstack/react-query";
import { listMicroMajors, listCoursesByMicroMajor, listMmChapters } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";
import { SwitchButton } from "@/components/teacher/switch-button";

const { Text } = Typography;

const MM_STORAGE_KEY = "mm_context_mmId";
const COURSE_STORAGE_KEY = "mm_context_courseId";

interface ContextSelectorProps {
  /** Whether to show the course selector (needed for chapters/videos/exercises/resources) */
  showCourse?: boolean;
  /** Only list courses that already have chapters */
  coursesWithChaptersOnly?: boolean;
}

/**
 * Shared context selector for micro major pages.
 * Reads/writes ?mmId and ?courseId search params in the URL.
 * Persists selection across pages via sessionStorage.
 */
export default function ContextSelector({ showCourse = false, coursesWithChaptersOnly = false }: ContextSelectorProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");

  // On mount: restore from sessionStorage if URL has no mmId
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (mmId || location.pathname.includes("/micro-major/dashboard")) {
      restoredRef.current = true;
      return;
    }
    const savedMM = sessionStorage.getItem(MM_STORAGE_KEY);
    const savedCourse = sessionStorage.getItem(COURSE_STORAGE_KEY);
    if (savedMM) {
      restoredRef.current = true;
      const next = new URLSearchParams(searchParams.toString());
      next.set("mmId", savedMM);
      if (savedCourse && showCourse) {
        next.set("courseId", savedCourse);
      }
      navigate(location.pathname + "?" + next.toString(), { replace: true });
    } else {
      restoredRef.current = true;
    }
  }, []);

  // Persist to sessionStorage whenever selection changes
  useEffect(() => {
    if (mmId) sessionStorage.setItem(MM_STORAGE_KEY, mmId);
    if (courseId) sessionStorage.setItem(COURSE_STORAGE_KEY, courseId);
  }, [mmId, courseId]);

  // Update mmId in search params
  const handleMMChange = useCallback(
    (value: string | undefined) => {
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set("mmId", value);
        next.delete("courseId");
      } else {
        next.delete("mmId");
        next.delete("courseId");
        sessionStorage.removeItem(MM_STORAGE_KEY);
        sessionStorage.removeItem(COURSE_STORAGE_KEY);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Update courseId in search params
  const handleCourseChange = useCallback(
    (value: string | undefined) => {
      const next = new URLSearchParams(searchParams);
      if (value) {
        next.set("courseId", value);
      } else {
        next.delete("courseId");
        sessionStorage.removeItem(COURSE_STORAGE_KEY);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Fetch micro majors
  const { data: mmData } = useQuery({
    queryKey: ["mm-selector-ctx", tenant],
    queryFn: async () => {
      const result = await listMicroMajors({
        tenant: tenant!,
        fields: ["id", "name", "status"],
        headers,
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant,
  });
  const microMajors = (mmData as { id: string; name: string; status?: string }[]) || [];

  // Fetch courses for selected micro major
  const { data: coursesData } = useQuery({
    queryKey: ["mm-ctx-courses", mmId],
    queryFn: async () => {
      if (!mmId) return [];
      const result = await listCoursesByMicroMajor({
        tenant: tenant!,
        input: { microMajorId: mmId },
        fields: ["id", "title"],
      });
      return extractArrayData(result) || [];
    },
    enabled: !!tenant && !!mmId,
  });
  const courses = (coursesData as { id: string; title: string }[]) || [];

  // When required, only keep courses that already have chapters
  const courseIds = useMemo(() => courses.map((c) => c.id), [courses]);
  const { data: chapterCourseIds } = useQuery({
    queryKey: ["mm-ctx-chapter-courses", mmId, courseIds],
    queryFn: async () => {
      const result = await listMmChapters({
        tenant: tenant!,
        fields: ["id", "microMajorCourseId"],
        filter: { microMajorCourseId: { in: courseIds } },
        page: { limit: 1000 },
        headers,
      });
      const rows = extractArrayData(result) as { microMajorCourseId?: string | null }[];
      return new Set(rows.map((r) => r.microMajorCourseId).filter(Boolean) as string[]);
    },
    enabled: !!tenant && !!mmId && coursesWithChaptersOnly && courseIds.length > 0,
  });

  const courseOptions = useMemo(() => {
    if (!coursesWithChaptersOnly || !chapterCourseIds) return courses;
    return courses.filter((c) => chapterCourseIds.has(c.id));
  }, [courses, coursesWithChaptersOnly, chapterCourseIds]);

  // Find current names
  const currentMM = useMemo(
    () => microMajors.find((m) => m.id === mmId),
    [microMajors, mmId]
  );
  const currentCourse = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId]
  );

  return (
    <div className="pu-filters pu-filters--flush">
      <SwitchButton
        title="切换微专业"
        buttonLabel="切换微专业"
        options={microMajors.map((m) => ({ id: m.id, label: m.name }))}
        value={mmId}
        onChange={(id) => handleMMChange(id)}
      />
      {showCourse && mmId && (
        <SwitchButton
          title="切换课程"
          buttonLabel="切换课程"
          options={courseOptions.map((c) => ({ id: c.id, label: c.title }))}
          value={courseId}
          onChange={(id) => handleCourseChange(id)}
        />
      )}
    </div>
  );
}
