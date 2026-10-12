import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useCourses, type Course } from "@/hooks/use-courses";

/** 教师端「当前课程」在 localStorage 中的存储键 */
const STORAGE_KEY = "teacher-current-course";

export interface CurrentCourseContextValue {
  /** 教师可选课程列表 */
  courses: Course[];
  /** 课程列表是否加载中 */
  loading: boolean;
  /** 当前课程 ID（保证不为空：加载完成后自动选中第一门） */
  courseId: string | undefined;
  /** 当前课程对象 */
  course: Course | undefined;
  /** 切换当前课程 */
  setCourseId: (id: string | undefined) => void;
}

const CurrentCourseContext = createContext<CurrentCourseContextValue | undefined>(
  undefined,
);

function readStoredCourseId(): string | undefined {
  try {
    return localStorage.getItem(STORAGE_KEY) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * 教师端「当前课程」上下文。
 *
 * 统一课程选择：跨页面共享同一门当前课程，持久化到 localStorage；
 * 当课程列表就绪且当前选中无效/为空时，自动选中第一门课程，避免空态。
 */
export function CurrentCourseProvider({ children }: { children: ReactNode }) {
  const { courses, loading } = useCourses({
    fields: ["id", "title", "description"],
  });
  const [courseId, setCourseIdState] = useState<string | undefined>(
    readStoredCourseId,
  );

  // 课程列表就绪后：若当前选中无效或为空，默认选中第一门课程
  useEffect(() => {
    if (loading || courses.length === 0) return;
    const valid = courseId && courses.some((c) => c.id === courseId);
    if (!valid) {
      const first = courses[0].id;
      setCourseIdState(first);
      try {
        localStorage.setItem(STORAGE_KEY, first);
      } catch {
        /* ignore */
      }
    }
  }, [courses, loading, courseId]);

  const setCourseId = useCallback((id: string | undefined) => {
    setCourseIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const course = useMemo(
    () => courses.find((c) => c.id === courseId),
    [courses, courseId],
  );

  const value = useMemo<CurrentCourseContextValue>(
    () => ({ courses, loading, courseId, course, setCourseId }),
    [courses, loading, courseId, course, setCourseId],
  );

  return (
    <CurrentCourseContext.Provider value={value}>
      {children}
    </CurrentCourseContext.Provider>
  );
}

/**
 * 读取教师端「当前课程」。必须在 {@link CurrentCourseProvider} 内使用。
 * 未包裹时退化为读取 localStorage（只读），保证组件不崩溃。
 */
export function useCurrentCourse(): CurrentCourseContextValue {
  const ctx = useContext(CurrentCourseContext);
  if (ctx) return ctx;
  const stored = readStoredCourseId();
  return {
    courses: [],
    loading: false,
    courseId: stored,
    course: undefined,
    setCourseId: () => {},
  };
}

export default useCurrentCourse;
