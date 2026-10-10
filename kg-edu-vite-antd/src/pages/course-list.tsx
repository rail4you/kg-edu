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
import { buildSubjectStats, useCourseCatalog, type CatalogCourse } from "@/hooks/use-course-catalog";
import { useLevelTitleMap } from "@/hooks/use-portal-config";
import { useCourseCategories } from "@/hooks/use-course-categories";
import { setCurrentTenant } from "@/lib/tenant";
import "@/styles/home-portal-theme.css";
import "@/styles/portal-editorial.css";

const { Content } = Layout;

const COURSES_PER_PAGE = 12;

/** 固定 Tab：全部课程（其后为管理端动态配置的课程类别） */
const ALL_COURSES_TAB = { key: "all", label: "全部课程" };

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
  onClick,
}: {
  course: CatalogCourse;
  onClick: (course: CatalogCourse) => void;
}) {
  const hasImage = Boolean(course.imageUrl);
  const artVariant = ((course.id.charCodeAt(0) + course.title.length) % 3);
  const variantClass = ["", "alt", "third"][artVariant];

  return (
    <article className={`cl-cc${course.isEnrolled ? " is-enrolled" : ""}`}>
      <a
        className={`cl-cc__cover ${variantClass}`}
        onClick={() => onClick(course)}
        style={
          hasImage
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(6,19,39,.25) 0%, rgba(6,19,39,.72) 100%), url(${course.imageUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                color: "#fff",
              }
            : undefined
        }
      >
        <b>{course.title}</b>
      </a>
      <h3><a onClick={() => onClick(course)}>{course.title}</a></h3>
      <div className="cl-cc__meta">
        {[course.teacherName, course.major].filter(Boolean).join(" · ") || course.orgName}
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
  const { courses, subjectStats: allSubjectStats, organizations, isLoading } = useCourseCatalog();
  // 动态层级名称
  const levelOptions = useDynamicLevelOptions();

  const selectedLevel = searchParams.get("level") || "all";

  // 学科统计随层级联动：选中层级后，学科面板只统计该层级内的课程
  const subjectStats = useMemo(
    () =>
      selectedLevel !== "all"
        ? buildSubjectStats(courses, selectedLevel)
        : allSubjectStats,
    [courses, selectedLevel, allSubjectStats],
  );
  const isMobile = !screens.md;
  // 动态课程类别（Tab：全部课程 + 管理端配置的类别）
  const { categories: categorySections } = useCourseCategories();
  const categoryTabs = useMemo(
    () => [
      ALL_COURSES_TAB,
      ...categorySections.map((s) => ({ key: s.category.id, label: s.category.name })),
    ],
    [categorySections]
  );

  // 各分类课程数（用于左侧分类列表）
  const tabCounts = useMemo(() => {
    const map: Record<string, number> = { all: courses.length };
    categorySections.forEach((s) => { map[s.category.id] = s.courses.length; });
    return map;
  }, [courses, categorySections]);

  const activeTab = searchParams.get("tab") || "all";
  const selectedSubject = searchParams.get("subject") || "all";
  const selectedOrg = searchParams.get("org") || "all";
  const searchQuery = searchParams.get("q") || "";
  const [page, setPage] = useState(1);

  // Local search state to avoid URL-sync issues during typing
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // 从首页选层级进入时，定位到左侧列表中的对应层级项
  const activeLevelRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (isMobile) return;
    activeLevelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedLevel, isMobile]);

  // Sync local state when URL changes externally (e.g. browser back/forward)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setLocalSearch(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (!value) next.delete("q");
      else next.set("q", value);
      setPage(1);
      setSearchParams(next);
    }, 300);
  }, [searchParams, setSearchParams]);

  const courseSource = useMemo(() => {
    if (activeTab === "all") return courses;
    const section = categorySections.find((s) => s.category.id === activeTab);
    return section ? section.courses : courses;
  }, [activeTab, courses, categorySections]);

  const visibleSubjects = useMemo(
    () => subjectStats.filter((s) => s.count > 0),
    [subjectStats]
  );

  useEffect(() => {
    if (
      isMobile &&
      selectedSubject !== "all" &&
      !subjectStats.some((subject) => subject.code === selectedSubject && subject.count > 0)
    ) {
      const next = new URLSearchParams(searchParams);
      next.delete("subject");
      setSearchParams(next, { replace: true });
    }
  }, [isMobile, selectedSubject, subjectStats, searchParams, setSearchParams]);

  const filteredCourses = useMemo(() => {
    let result = courseSource;
    // 第一层：按教育层级（本科/研究生/高职/中职）过滤
    if (selectedLevel !== "all") {
      result = result.filter((c) => c.educationLevel === selectedLevel);
    }
    if (selectedSubject !== "all") {
      result = result.filter((c) => c.standardSubject.code === selectedSubject);
    }
    if (selectedOrg !== "all") {
      result = result.filter((c) => c.orgSchemaName === selectedOrg);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.teacherName?.toLowerCase().includes(q) ||
        c.orgName.toLowerCase().includes(q)
      );
    }
    // 已选课课程排在前面
    result = [...result].sort((a, b) => {
      if (a.isEnrolled && !b.isEnrolled) return -1;
      if (!a.isEnrolled && b.isEnrolled) return 1;
      return 0;
    });
    return result;
  }, [selectedLevel, selectedSubject, selectedOrg, searchQuery, courseSource]);

  const maxPage = Math.max(1, Math.ceil(filteredCourses.length / COURSES_PER_PAGE));
  const currentPage = Math.min(page, maxPage);
  const paginatedCourses = filteredCourses.slice(
    (currentPage - 1) * COURSES_PER_PAGE,
    currentPage * COURSES_PER_PAGE,
  );

  const updateSearchParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (!value) next.delete(key);
      else next.set(key, value);
    });
    setPage(1);
    setSearchParams(next);
  };

  const handleCourseClick = (course: CatalogCourse) => {
    const tenant = {
      id: course.orgSchemaName,
      name: course.orgName,
      schemaName: course.orgSchemaName,
    };
    setCurrentTenant(tenant);
    navigate(`/dashboard/front?courseId=${course.id}&tenant=${course.orgSchemaName}&from=courses`);
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

          {/* 移动端：紧凑筛选条 - 下拉框选择器 */}
          {isMobile && (
            <section className="cl-filter-bar cl-filter-bar--mobile" style={{ padding: "8px 14px", background: "#fff" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Select
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="选择层级"
                  value={selectedLevel !== "all" ? selectedLevel : undefined}
                  onChange={(val) => updateSearchParams({ level: val || undefined, subject: undefined })}
                  allowClear
                  options={levelOptions}
                />
                <Select
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="选择学校"
                  value={selectedOrg !== "all" ? selectedOrg : undefined}
                  onChange={(val) => updateSearchParams({ org: val || undefined })}
                  allowClear
                  options={organizations
                    .filter(o => o.schemaName)
                    .map(org => ({ label: org.name, value: org.schemaName! }))}
                />
                <Select
                  style={{ flex: 1, minWidth: 0 }}
                  placeholder="选择学科"
                  value={selectedSubject !== "all" ? selectedSubject : undefined}
                  onChange={(val) => updateSearchParams({ subject: val || undefined })}
                  allowClear
                  options={visibleSubjects
                    .map(s => ({ label: `${s.name} (${s.count})`, value: s.code }))}
                />
              </div>
            </section>
          )}

          <div className="cl-layout">
            {/* 桌面端：左侧筛选列表（层级 / 学校 / 学科） */}
            {!isMobile && (
              <aside className="cl-sidebar">
                <div className="cl-side-group">
                  <div className="cl-side-group__title">学历层级</div>
                  <div className="cl-side-list">
                    <button
                      type="button"
                      ref={selectedLevel === "all" ? activeLevelRef : null}
                      className={`cl-side-link${selectedLevel === "all" ? " is-active" : ""}`}
                      onClick={() => updateSearchParams({ level: undefined, subject: undefined })}
                    >
                      全部层级
                    </button>
                    {levelOptions.map((level) => {
                      const levelCount = courses.filter((c) => c.educationLevel === level.value).length;
                      const active = selectedLevel === level.value;
                      return (
                        <button
                          key={level.value}
                          type="button"
                          ref={active ? activeLevelRef : null}
                          className={`cl-side-link${active ? " is-active" : ""}`}
                          onClick={() => updateSearchParams({ level: level.value, subject: undefined })}
                        >
                          {level.label}
                          {levelCount > 0 && <span className="cl-side-link__count">{levelCount}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="cl-side-group">
                  <div className="cl-side-group__title">学校</div>
                  <div className="cl-side-list cl-side-list--scroll">
                    <button
                      type="button"
                      className={`cl-side-link${selectedOrg === "all" ? " is-active" : ""}`}
                      onClick={() => updateSearchParams({ org: undefined })}
                    >
                      全部学校
                    </button>
                    {organizations.map((org) => (
                      <button
                        key={org.schemaName}
                        type="button"
                        className={`cl-side-link${selectedOrg === org.schemaName ? " is-active" : ""}`}
                        onClick={() => updateSearchParams({ org: org.schemaName })}
                      >
                        {org.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="cl-side-group">
                  <div className="cl-side-group__title">学科</div>
                  <div className="cl-side-list cl-side-list--scroll">
                    <button
                      type="button"
                      className={`cl-side-link${selectedSubject === "all" ? " is-active" : ""}`}
                      onClick={() => updateSearchParams({ subject: undefined })}
                    >
                      全部学科
                    </button>
                    {visibleSubjects.map((subject) => (
                      <button
                        key={subject.code}
                        type="button"
                        className={`cl-side-link${selectedSubject === subject.code ? " is-active" : ""}${subject.count === 0 ? " is-empty" : ""}`}
                        onClick={() => updateSearchParams({ subject: subject.code })}
                      >
                        {subject.name}
                        {subject.count > 0 && <span className="cl-side-link__count">{subject.count}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            )}

            <div className="cl-main">
              {/* Search + Tabs + Course List */}
              <section className="cl-list-section">
                <div className="cl-list-section__inner">
                  {/* Search bar + 分类列表 */}
                  <div className="cl-search-bar" style={isMobile ? { padding: "4px 14px" } : undefined}>
                    <div className="cl-search-row">
                      <Input
                        placeholder={isMobile ? "搜索课程" : "搜索课程名、老师名或学校名称"}
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
                      />
                      {!isMobile && (
                        <div className="cl-cat-list" role="tablist" aria-label="课程分类">
                          {categoryTabs.map((tab) => (
                            <button
                              key={tab.key}
                              type="button"
                              role="tab"
                              aria-selected={activeTab === tab.key}
                              className={`cl-cat-item${activeTab === tab.key ? " is-active" : ""}`}
                              onClick={() => updateSearchParams({ tab: tab.key === "all" ? undefined : tab.key, subject: undefined })}
                            >
                              {tab.label}
                              <span className="cl-cat-item__count">{tabCounts[tab.key] ?? 0}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tabs（仅移动端；桌面端分类见左侧列表） */}
                  {isMobile && (
                    <div className="cl-tabs" style={{ padding: "4px 14px 8px", gap: 0, borderBottom: "1px solid #edf3ff", marginBottom: 0 }}>
                      <div style={{ display: "flex", gap: 5, flex: 1, minWidth: 0 }}>
                        {categoryTabs.map((tab) => (
                          <button
                            key={tab.key}
                            type="button"
                            className={`cl-tabs__item ${activeTab === tab.key ? "is-active" : ""}`}
                            onClick={() => updateSearchParams({ tab: tab.key === "all" ? undefined : tab.key, subject: undefined })}
                            style={{ flex: 1, justifyContent: "center", padding: "7px 4px", fontSize: 13, borderRadius: 8, minWidth: 0 }}
                          >
                            <span>{tab.label.replace("课程", "")}</span>
                          </button>
                        ))}
                      </div>
                      <div className="cl-tabs__stat" style={{ fontSize: 12, flexShrink: 0, marginLeft: 8, padding: "7px 0 7px 8px", borderLeft: "1px solid #edf3ff" }}>
                        <strong>{filteredCourses.length}</strong>门
                      </div>
                    </div>
                  )}

                  {isLoading ? (
                    <div className="ed-featured" style={isMobile ? { display: "grid", gridTemplateColumns: "1fr", gap: 12, padding: "0 14px" } : undefined}>
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
                      <div className="ed-featured" style={isMobile ? { display: "grid", gridTemplateColumns: "1fr", gap: 12, padding: "0 14px" } : undefined}>
                        {paginatedCourses.map((course) => (
                          <CourseCard key={`${course.id}_${course.orgSchemaName}`} course={course} onClick={handleCourseClick} />
                        ))}
                      </div>
                      <div className="cl-pagination" style={isMobile ? { padding: "16px 14px 8px" } : undefined}>
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
              </section>
            </div>
          </div>
        </div>
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
