import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Empty,
  Grid,
  Input,
  Layout,
  Pagination,
  Select,
  Skeleton,
} from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import GlobalFooter from "@/components/layout/global-footer";
import PortalHeader from "@/components/layout/portal-header";
import {
  buildSubjectStats,
  useCourseCatalog,
  type CatalogCourse,
} from "@/hooks/use-course-catalog";
import { useLevelTitleMap } from "@/hooks/use-portal-config";
import { setCurrentTenant } from "@/lib/tenant";
import "@/styles/home-portal-theme.css";
import "@/styles/portal-editorial.css";

const { Content } = Layout;

const COURSES_PER_PAGE = 12;

const LEVEL_OPTIONS = [
  { value: "undergraduate", label: "本科" },
  { value: "graduate", label: "研究生" },
  { value: "higher_vocational", label: "高职" },
  { value: "secondary_vocational", label: "中职" },
];

/** 用门户配置中的动态层级名称覆盖默认标签 */
function useDynamicLevelOptions() {
  const levelTitleMap = useLevelTitleMap();
  return LEVEL_OPTIONS.map((opt) => ({
    value: opt.value,
    label: levelTitleMap[opt.value]?.title || opt.label,
  }));
}

function CourseCard({
  course,
  index,
  onClick,
}: {
  course: CatalogCourse;
  index: number;
  onClick: (course: CatalogCourse) => void;
}) {
  const hasImage = Boolean(course.imageUrl);
  const artVariant = (course.id.charCodeAt(0) + course.title.length) % 3;
  const variantClass = ["", "alt", "third"][artVariant];
  const subtitle = course.standardSubject?.name || course.orgName;

  return (
    <article className={`cl-cc${course.isEnrolled ? " is-enrolled" : ""}`}>
      <a
        className={`cl-cc__cover ${variantClass}`}
        onClick={() => onClick(course)}
        style={
          hasImage
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(6,19,39,.35) 0%, rgba(6,19,39,.72) 100%), url(${course.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "#fff",
              }
            : undefined
        }
      >
        <small>COURSE {String(index + 1).padStart(2, "0")}</small>
        <b>{course.title}</b>
        <span className="cl-cc__cover-sub">{subtitle}</span>
      </a>
      <h3>
        <a onClick={() => onClick(course)}>{course.title}</a>
      </h3>
      <div className="cl-cc__meta">
        {[course.teacherName, course.major].filter(Boolean).join(" · ") ||
          course.orgName}
      </div>
      <p title={course.description || course.title}>
        {course.description && course.description !== course.title
          ? course.description
          : "课程简介正在完善中，点击进入可查看课程详情与学习内容。"}
      </p>
      <div className="cl-cc__row">
        <span className={`cl-cc__tag${course.isEnrolled ? " is-enrolled" : ""}`}>
          {course.isEnrolled ? "学习中" : "已发布"}
        </span>
        <button
          type="button"
          className={`cl-cc__btn${course.isEnrolled ? " is-enrolled" : ""}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick(course);
          }}
        >
          {course.isEnrolled ? "继续学习 →" : "查看课程 →"}
        </button>
      </div>
    </article>
  );
}

export default function CourseListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const screens = Grid.useBreakpoint();
  const { courses, subjectStats: allSubjectStats, isLoading } = useCourseCatalog();
  const levelOptions = useDynamicLevelOptions();

  const isMobile = !screens.md;

  // 学历层级：沿用 URL 参数（首页层级入口可带入）
  const selectedLevel = searchParams.get("level") || "all";
  // 学科：本地选择，不再读取首页导航带入的 subject 参数
  const [selectedSubject, setSelectedSubject] = useState("all");
  const searchQuery = searchParams.get("q") || "";
  const [page, setPage] = useState(1);

  // 学科统计随层级联动
  const subjectStats = useMemo(
    () =>
      selectedLevel !== "all"
        ? buildSubjectStats(courses, selectedLevel)
        : allSubjectStats,
    [courses, selectedLevel, allSubjectStats],
  );
  const visibleSubjects = useMemo(
    () => subjectStats.filter((s) => s.count > 0),
    [subjectStats],
  );

  // Local search state（避免输入时频繁同步 URL）
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSearchChange = useCallback(
    (value: string) => {
      setLocalSearch(value);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      searchTimerRef.current = setTimeout(() => {
        const next = new URLSearchParams(searchParams);
        if (!value) next.delete("q");
        else next.set("q", value);
        setPage(1);
        setSearchParams(next);
      }, 300);
    },
    [searchParams, setSearchParams],
  );

  // 层级切换时重置学科选择与分页
  const handleLevelChange = (level: string | undefined) => {
    const next = new URLSearchParams(searchParams);
    if (!level || level === "all") next.delete("level");
    else next.set("level", level);
    setSelectedSubject("all");
    setPage(1);
    setSearchParams(next);
  };

  const filteredCourses = useMemo(() => {
    let result = courses;
    if (selectedLevel !== "all") {
      result = result.filter((c) => c.educationLevel === selectedLevel);
    }
    if (selectedSubject !== "all") {
      result = result.filter((c) => c.standardSubject.code === selectedSubject);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          c.teacherName?.toLowerCase().includes(q) ||
          c.orgName.toLowerCase().includes(q),
      );
    }
    // 已选课课程排在前面
    return [...result].sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return 0;
    });
  }, [courses, selectedLevel, selectedSubject, searchQuery]);

  const maxPage = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE));
  const currentPage = Math.min(page, maxPage);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * COURSES_PER_PAGE,
    currentPage * COURSES_PER_PAGE,
  );

  const handleCourseClick = (course: CatalogCourse) => {
    setCurrentTenant({
      id: course.orgSchemaName,
      name: course.orgName,
      schemaName: course.orgSchemaName,
    });
    navigate(
      `/dashboard/front?courseId=${course.id}&tenant=${course.orgSchemaName}&from=courses`,
    );
  };

  return (
    <Layout className="home-page cl-page cl-courses-page">
      <PortalHeader activeKey="/courses" sectionTitle="导航" />

      <Content>
        <div className="ed-container">
          {/* 原型课程页顶部：标题 + 描述 */}
          <div className="ed-page-head">
            <h1>探索课程</h1>
            <p>找到适合自己的学习方向。</p>
          </div>

          {/* 原型筛选卡片：搜索 + 学历层级 + 学科分类 */}
          <section className="cl-filter-bar">
            <div
              className="cl-filter-bar__inner"
              style={{
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Input
                placeholder="搜索课程名称"
                prefix={<SearchOutlined />}
                allowClear
                size={isMobile ? "middle" : "large"}
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                onPressEnter={(e) => {
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                  const value = (e.target as HTMLInputElement).value;
                  const next = new URLSearchParams(searchParams);
                  if (!value) next.delete("q");
                  else next.set("q", value);
                  setPage(1);
                  setSearchParams(next);
                }}
                className="cl-search-input"
                style={{ flex: "1 1 260px", minWidth: 200 }}
              />
              <Select
                style={{ width: isMobile ? "100%" : 160 }}
                placeholder="全部层级"
                value={selectedLevel !== "all" ? selectedLevel : undefined}
                onChange={handleLevelChange}
                allowClear
                options={levelOptions}
              />
              <Select
                style={{ width: isMobile ? "100%" : 180 }}
                placeholder="全部学科"
                value={selectedSubject !== "all" ? selectedSubject : undefined}
                onChange={(val) => {
                  setSelectedSubject(val || "all");
                  setPage(1);
                }}
                allowClear
                options={visibleSubjects.map((s) => ({
                  label: `${s.name} (${s.count})`,
                  value: s.code,
                }))}
              />
            </div>
          </section>

          {isLoading ? (
            <div
              className="ed-featured"
              style={
                isMobile
                  ? { gridTemplateColumns: "1fr", gap: 12 }
                  : undefined
              }
            >
              {Array.from({ length: isMobile ? 6 : 12 }).map((_, index) => (
                <div key={index} className="cl-cc">
                  <Skeleton.Image active style={{ width: "100%", height: 125 }} />
                  <div style={{ padding: "14px 4px" }}>
                    <Skeleton active paragraph={{ rows: 3 }} title={{ width: "80%" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : paginatedCourses.length > 0 ? (
            <>
              <div
                className="ed-featured"
                style={
                  isMobile
                    ? { gridTemplateColumns: "1fr", gap: 12 }
                    : undefined
                }
              >
                {paginatedCourses.map((course, index) => (
                  <CourseCard
                    key={`${course.id}_${course.orgSchemaName}`}
                    course={course}
                    index={index}
                    onClick={handleCourseClick}
                  />
                ))}
              </div>
              <div className="cl-pagination">
                <Pagination
                  current={currentPage}
                  pageSize={COURSES_PER_PAGE}
                  total={filteredCourses.length}
                  onChange={setPage}
                  showSizeChanger={false}
                  showTotal={isMobile ? undefined : (total) => `共 ${total} 门课程`}
                  size={isMobile ? "small" : "default"}
                />
              </div>
            </>
          ) : (
            <Empty
              className="home-empty"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="当前筛选条件下暂无课程"
            />
          )}
        </div>
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
