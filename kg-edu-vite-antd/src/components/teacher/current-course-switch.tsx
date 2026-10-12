import { SwitchButton } from "@/components/teacher/switch-button";
import { useCurrentCourse } from "@/hooks/use-current-course";

/**
 * 右侧「切换课程」入口，与课程图谱页的课程切换 UI 一致。
 *
 * 复用共享的「当前课程」上下文：选择后即设为当前课程并跨页面持久化，
 * 课程列表就绪时默认选中第一门，不会留空。
 */
export function CurrentCourseSwitch() {
  const { courses, loading, courseId, setCourseId } = useCurrentCourse();

  return (
    <SwitchButton
      title="切换当前课程"
      buttonLabel="切换课程"
      options={courses.map((course) => ({ id: course.id, label: course.title }))}
      value={courseId}
      onChange={(id) => setCourseId(id)}
      loading={loading}
    />
  );
}

export default CurrentCourseSwitch;
