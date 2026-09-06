import { BookOutlined, RightOutlined } from "@ant-design/icons";
import { Skeleton } from "antd";
import { useNavigate } from "react-router-dom";
import type { CatalogCourse } from "@/hooks/use-course-catalog";
import type { CourseCategorySection } from "@/hooks/use-course-categories";

/** 课程卡片（移动端 2 列布局，与原样式一致） */
function CourseCard({
  course,
  onClick,
}: {
  course: CatalogCourse;
  onClick: (course: CatalogCourse) => void;
}) {
  const hasImage = !!course.imageUrl;

  return (
    <button type="button" className="nqc-card" onClick={() => onClick(course)}>
      <div
        className="nqc-card__cover"
        style={
          hasImage
            ? { backgroundImage: `url(${course.imageUrl})` }
            : undefined
        }
      >
        {!hasImage && (
          <div className="nqc-card__cover-fallback">
            <BookOutlined />
          </div>
        )}
        {course.isEnrolled && (
          <span className="nqc-card__enrolled-badge">已选课</span>
        )}
        <div className="nqc-card__cover-title">{course.title}</div>
      </div>
      <div className="nqc-card__title">{course.title}</div>
      <div className="nqc-card__org">{course.orgName}</div>
      <div className="nqc-card__teacher">{course.teacherName || ""}</div>
    </button>
  );
}

/**
 * 移动端课程分组区块。
 */
function SectionBlock({
  title,
  courses,
  isLoading,
  onMore,
  onCourseClick,
}: {
  title: string;
  courses: CatalogCourse[];
  isLoading?: boolean;
  onMore?: () => void;
  onCourseClick: (course: CatalogCourse) => void;
}) {
  if (!isLoading && courses.length === 0) return null;

  return (
    <section className="national-quality-section">
      <header className="national-quality-section__header">
        <h3 className="national-quality-section__title">{title}</h3>
        {onMore && (
          <a className="national-quality-section__more" onClick={onMore}>
            更多 <RightOutlined />
          </a>
        )}
      </header>

      {isLoading ? (
        <div className="national-quality-section__grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="nqc-card" style={{ padding: 0 }}>
              <Skeleton.Image active style={{ width: "100%", height: 100 }} />
              <div style={{ padding: 8 }}><Skeleton active paragraph={{ rows: 1 }} title={{ width: "70%" }} /></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="national-quality-section__grid">
          {courses.slice(0, 4).map((course) => (
            <CourseCard
              key={`${course.id}-${course.orgSchemaName}`}
              course={course}
              onClick={onCourseClick}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * 首页移动端课程列表 — 管理端动态类别（推荐/新开等）
 * 样式与原国家精品区块一致。
 */
export default function MobileCourseSections({
  sections,
  isLoading,
  onCourseClick,
}: {
  sections: CourseCategorySection[];
  isLoading: boolean;
  onCourseClick: (course: CatalogCourse) => void;
}) {
  const navigate = useNavigate();

  return (
    <>
      {sections.map((section) => (
        <SectionBlock
          key={section.category.id}
          title={section.category.name}
          courses={section.courses}
          isLoading={isLoading}
          onMore={() => navigate(`/courses?tab=${section.category.id}`)}
          onCourseClick={onCourseClick}
        />
      ))}
    </>
  );
}
