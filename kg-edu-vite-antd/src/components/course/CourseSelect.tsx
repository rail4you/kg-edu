import type { CSSProperties } from "react";
import { Empty, Select, Spin } from "antd";
import { useCourses, type Course } from "@/hooks/use-courses";

export interface CourseSelectProps {
  /** 当前选中的课程 ID */
  value?: string | null;
  /** 选择变化回调，返回课程 ID 与对应课程对象 */
  onChange?: (courseId: string | undefined, course?: Course) => void;
  placeholder?: string;
  allowClear?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
  className?: string;
  size?: "large" | "middle" | "small";
  /** 请求的课程字段，默认 ["id", "title"] */
  fields?: string[];
  /** 最大自动重试次数（当课程列表为空时） */
  maxRetry?: number;
  /** 是否支持搜索 */
  showSearch?: boolean;
}

/**
 * 通用课程选择器。
 *
 * 统一处理课程加载状态：加载中展示 loading 效果，避免在数据返回前
 * 显示「暂无课程」的假空态。内部复用 useCourses，与其他页面共享缓存。
 */
export function CourseSelect({
  value,
  onChange,
  placeholder = "请选择课程",
  allowClear = true,
  disabled,
  style,
  className,
  size,
  fields = ["id", "title"],
  maxRetry,
  showSearch = true,
}: CourseSelectProps) {
  const { courses, loading, error } = useCourses({ fields, maxRetry });

  const options = courses.map((course) => ({
    label: course.title,
    value: course.id,
  }));

  return (
    <Select
      className={className}
      style={style}
      size={size}
      placeholder={loading ? "正在加载课程…" : placeholder}
      value={value || undefined}
      onChange={(next) =>
        onChange?.(next, courses.find((course) => course.id === next))
      }
      allowClear={allowClear}
      disabled={disabled}
      loading={loading}
      showSearch={showSearch}
      optionFilterProp="label"
      options={options}
      notFoundContent={
        loading ? (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <Spin size="small" />
          </div>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={error ? "课程加载失败" : "暂无课程"}
          />
        )
      }
    />
  );
}

export default CourseSelect;
