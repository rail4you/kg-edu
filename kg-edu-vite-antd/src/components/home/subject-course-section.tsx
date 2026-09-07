import { Empty, Skeleton, Tag, Typography } from "antd";
import { BankOutlined, BarChartOutlined, BookOutlined, EyeOutlined, RightOutlined } from "@ant-design/icons";
import type { CatalogCourse, SubjectStat } from "@/hooks/use-course-catalog";

const { Text, Title } = Typography;

interface SubjectCourseSectionProps {
  subject: SubjectStat;
  courses: CatalogCourse[];
  isLoading: boolean;
  onMore: (subjectCode: string) => void;
  onCourseClick: (course: CatalogCourse) => void;
}

/**
 * 按学科分组的课程区块
 * 风格仿照人卫慕课的"国家精品 / 临床医学 / 药学"等分类区块
 */
export default function SubjectCourseSection({
  subject,
  courses,
  isLoading,
  onMore,
  onCourseClick,
}: SubjectCourseSectionProps) {
  if (!isLoading && courses.length === 0) {
    return null;
  }

  return (
    <section className="portal-subject-section">
      <div className="portal-subject-section__header">
        <div className="portal-subject-section__title-wrap">
          <span className="portal-subject-section__icon">
            <BookOutlined />
          </span>
          <Title level={3} className="portal-subject-section__title">
            {subject.name}
          </Title>
          <Tag className="portal-subject-section__count">{subject.count} 门</Tag>
        </div>
        <button
          type="button"
          className="portal-subject-section__more"
          onClick={() => onMore(subject.code)}
        >
          更多
          <RightOutlined />
        </button>
      </div>

      {isLoading ? (
        <div className="portal-subject-grid">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="portal-course-card portal-course-card--loading">
              <Skeleton.Image active className="portal-course-card__skeleton-cover" />
              <div style={{ padding: 14 }}>
                <Skeleton active paragraph={{ rows: 2 }} title={{ width: "70%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="portal-subject-grid">
          {courses.map((course) => {
            const isPlaceholder = !course.imageUrl;
            return (
              <button
                key={`${subject.code}-${course.id}-${course.orgSchemaName}`}
                type="button"
                className={`portal-course-card ${course.isEnrolled ? "is-enrolled" : "is-open"}`}
                onClick={() => onCourseClick(course)}
              >
                <div
                  className={`portal-course-card__cover ${isPlaceholder ? "is-placeholder" : ""}`}
                  style={
                    !isPlaceholder
                      ? { backgroundImage: `url(${course.imageUrl})` }
                      : undefined
                  }
                >
                  {isPlaceholder && (
                    <div className="portal-course-card__cover-fallback">
                      <BookOutlined />
                    </div>
                  )}
                  <div className="portal-course-card__cover-badges">
                    <span className="portal-course-card__cover-badge portal-course-card__cover-badge--subject">
                      {course.standardSubject.name}
                    </span>
                    {course.isEnrolled && (
                      <span className="portal-course-card__cover-badge portal-course-card__cover-badge--enrolled">
                        已选课
                      </span>
                    )}
                  </div>
                  <div className="portal-course-card__cover-overlay">
                    <div className="portal-course-card__cover-overlay-title">
                      {course.title}
                    </div>
                  </div>
                </div>
                <div className="portal-course-card__body">
                  <Text className="portal-course-card__title" ellipsis>
                    {course.title}
                  </Text>
                  <div className="portal-course-card__school">
                    <BankOutlined />
                    <span className="portal-course-card__school-name">{course.orgName}</span>
                    <span className="portal-course-card__school-divider">|</span>
                    <span className="portal-course-card__school-teacher">教师：{course.teacherName}</span>
                  </div>
                  <div className="portal-course-card__footer">
                    <span
                      className={`portal-course-card__progress ${course.isEnrolled ? "portal-course-card__progress--enrolled" : ""}`}
                    >
                      <BarChartOutlined />
                      {course.isEnrolled ? "学习中" : "进行中"}
                    </span>
                    <span className="portal-course-card__learners">
                      <EyeOutlined />
                      {course.enrolledCount ?? course.browseCount ?? 0}人学习
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {courses.length === 0 && !isLoading && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`暂无 ${subject.name} 相关课程`}
        />
      )}
    </section>
  );
}
