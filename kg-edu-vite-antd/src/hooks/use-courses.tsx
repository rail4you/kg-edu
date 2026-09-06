import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { myCourses } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { extractArrayData } from "@/utils/api-helpers";
import { useAuth } from "@/auth/auth-context";
import { isAuthError } from "@/lib/auth-check";

export interface Course {
  id: string;
  title: string;
  description?: string;
  [key: string]: any;
}

export interface UseCoursesOptions {
  /** 要获取的字段列表，默认为 ["id", "title", "description"] */
  fields?: string[];
  /** 最大重试次数，默认为 5 */
  maxRetry?: number;
  /** 重试延迟（毫秒），默认为 2000 */
  retryDelay?: number;
  /** 是否启用自动重试（当课程为空时），默认为 true */
  autoRetry?: boolean;
  /** 是否在组件挂载时自动获取，默认为 true */
  enabled?: boolean;
  /** 数据过期时间（毫秒），默认为 10 分钟 */
  staleTime?: number;
}

export interface UseCoursesReturn {
  /** 课程列表数据 */
  courses: Course[];
  /** 是否正在加载（包括查询中和重试中） */
  loading: boolean;
  /** 当前重试次数 */
  retryCount: number;
  /** 最大重试次数 */
  maxRetry: number;
  /** 是否已经达到最大重试次数 */
  isMaxRetryReached: boolean;
  /** 手动重新获取课程 */
  refetch: () => void;
  /** 重置重试计数并重新获取 */
  resetAndRefetch: () => void;
  /** 错误信息 */
  error: Error | null;
}

/**
 * 获取课程列表的自定义 Hook，带有自动重试机制
 *
 * @example
 * ```tsx
 * const { courses, loading, retryCount, maxRetry, refetch, resetAndRefetch } = useCourses();
 *
 * if (loading) {
 *   return <Spin>正在获取课程列表 (重试 {retryCount}/{maxRetry})...</Spin>;
 * }
 *
 * if (courses.length === 0) {
 *   return (
 *     <div>
 *       暂无课程数据
 *       <Button onClick={resetAndRefetch}>重新加载</Button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCourses(options: UseCoursesOptions = {}): UseCoursesReturn {
  const {
    fields = ["id", "title", "description"],
    maxRetry = 5,
    retryDelay = 2000,
    autoRetry = true,
    enabled = true,
    staleTime = 10 * 60 * 1000,
  } = options;

  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";

  const [retryCount, setRetryCount] = useState(0);
  const retryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // 清理定时器
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
      }
    };
  }, []);

  const {
    data,
    isLoading: queryLoading,
    refetch,
    error,
  } = useQuery({
    queryKey: ["courses", tenant, fields.join(",")],
    queryFn: async () => {
      const result = await myCourses({
        tenant,
        fields: fields as any,
        headers: {
          ...getAuthHeaders(user),
        } as Record<string, string>,
      });

      if (!result.success) {
        const errMsg = result.errors?.[0]?.message || "获取课程失败";
        // 如果是认证错误，抛出特殊错误以阻止自动重试
        if (isAuthError(result)) {
          const authErr = new Error(errMsg);
          (authErr as any).__authError = true;
          throw authErr;
        }
        throw new Error(errMsg);
      }

      return extractArrayData(result) as Course[];
    },
    enabled: !!tenant && !!user && enabled,
    staleTime,
    retry: (failureCount, error) => {
      // 认证错误不重试，让全局 401 处理器接管
      if ((error as any)?.__authError || isAuthError(error)) {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const courses = Array.isArray(data) ? data : [];
  const isMaxRetryReached = retryCount >= maxRetry;

  // 计算加载状态：查询中 或 (数据为空且未超过重试次数且启用自动重试)
  const loading =
    queryLoading || (autoRetry && courses.length === 0 && !isMaxRetryReached);

  // 自动重试逻辑
  useEffect(() => {
    // 清除之前的定时器
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // 只在以下条件下触发重试：
    // 1. 不在查询中
    // 2. 课程为空
    // 3. 未超过最大重试次数
    // 4. 启用了自动重试
    // 5. tenant 和 user 存在
    // 6. enabled 为 true
    // 如果是认证错误，不自动重试
    const isAuthErr = error && isAuthError(error);
    if (
      !queryLoading &&
      courses.length === 0 &&
      !isMaxRetryReached &&
      !isAuthErr &&
      autoRetry &&
      tenant &&
      user &&
      enabled &&
      isMountedRef.current
    ) {
      retryTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) {
          console.log(`[useCourses] 课程列表为空，正在进行第 ${retryCount + 1} 次重试...`);
          setRetryCount((prev) => prev + 1);
          refetch();
        }
      }, retryDelay);
    }

    return () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [
    queryLoading,
    courses.length,
    isMaxRetryReached,
    autoRetry,
    tenant,
    user,
    enabled,
    retryCount,
    retryDelay,
    refetch,
  ]);

  // 重置重试计数并重新获取
  const resetAndRefetch = useCallback(() => {
    setRetryCount(0);
    refetch();
  }, [refetch]);

  return {
    courses,
    loading,
    retryCount,
    maxRetry,
    isMaxRetryReached,
    refetch: () => refetch(),
    resetAndRefetch,
    error: error as Error | null,
  };
}

/**
 * 渲染课程选择器的辅助组件
 *
 * @example
 * ```tsx
 * const { courses, loading, retryCount, maxRetry, isMaxRetryReached, resetAndRefetch } = useCourses();
 *
 * <CourseSelector
 *   courses={courses}
 *   loading={loading}
 *   retryCount={retryCount}
 *   maxRetry={maxRetry}
 *   isMaxRetryReached={isMaxRetryReached}
 *   selectedCourseId={selectedCourseId}
 *   onSelect={setSelectedCourseId}
 *   onRetry={resetAndRefetch}
 * />
 * ```
 */
export interface CourseSelectorProps {
  courses: Course[];
  loading: boolean;
  retryCount: number;
  maxRetry: number;
  isMaxRetryReached: boolean;
  selectedCourseId?: string;
  onSelect: (courseId: string) => void;
  onRetry?: () => void;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  width?: number | string;
}

export function CourseSelector({
  courses,
  loading,
  retryCount,
  maxRetry,
  isMaxRetryReached,
  selectedCourseId,
  onSelect,
  onRetry,
  style,
  className,
  placeholder = "选择课程",
  width = 280,
}: CourseSelectorProps) {
  const { Spin, Select, Space, Typography, Button } = require("antd");
  const { Text } = Typography;

  if (loading) {
    return (
      <Space>
        <Spin size="small" />
        <Text type="secondary">
          {retryCount > 0
            ? `正在获取课程列表 (重试 ${retryCount}/${maxRetry})...`
            : "加载课程中..."}
        </Text>
      </Space>
    );
  }

  if (courses.length === 0) {
    return (
      <Space>
        <Text type="secondary">暂无课程数据</Text>
        {onRetry && (
          <Button size="small" onClick={onRetry}>
            重新加载
          </Button>
        )}
      </Space>
    );
  }

  return (
    <Select
      style={{ width, maxWidth: 400, ...style }}
      className={className}
      placeholder={placeholder}
      value={selectedCourseId || undefined}
      onChange={onSelect}
      loading={loading}
      options={courses.map((course) => ({
        value: course.id,
        label: course.title,
      }))}
    />
  );
}
