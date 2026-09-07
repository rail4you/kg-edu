import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Empty,
  Grid,
  Input,
  Layout,
  Pagination,
  Select,
  Skeleton,
  Switch,
  Tag,
  Typography,
} from "antd";
import {
  AppstoreOutlined,
  BankOutlined,
  BarChartOutlined,
  EyeOutlined,
  FireOutlined,
  MenuOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import MobileFullMenu from "@/components/layout/mobile-full-menu";
import { buildSubjectStats, useCourseCatalog, type CatalogCourse } from "@/hooks/use-course-catalog";
import { useBranding } from "@/hooks/use-branding";
import { usePortalNavItems, useLevelTitleMap } from "@/hooks/use-portal-config";
import { useCourseCategories } from "@/hooks/use-course-categories";
import { themeColors } from "@/styles/theme";
import { setCurrentTenant } from "@/lib/tenant";
import CourseCoverArt from "@/components/course-cover-art";
import "@/styles/home-portal-theme.css";

const { Header, Content } = Layout;
const { Paragraph, Text, Title } = Typography;

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
  const isPlaceholder = !course.imageUrl;
  const studyCount = course.enrolledCount ?? course.browseCount ?? 0;

  return (
    <button
      type="button"
      className={`portal-course-card ${course.isEnrolled ? "is-enrolled" : "is-open"}`}
      onClick={() => onClick(course)}
    >
      {/* Cover — 内嵌圆角封面，有图用图片，无图用生成式学术插画封面 */}
      <div
        className={`portal-course-card__cover ${isPlaceholder ? "is-art" : ""}`}
        style={
          !isPlaceholder
            ? { backgroundImage: `url(${course.imageUrl})` }
            : undefined
        }
      >
        {isPlaceholder && (
          <CourseCoverArt
            seed={course.id}
            title={course.title}
            subtitle={course.orgName}
          />
        )}

        <div className="portal-course-card__cover-badges">
          <span className="portal-course-card__cover-badge portal-course-card__cover-badge--subject">
            {course.standardSubject.name}
          </span>
        </div>

        {!isPlaceholder && (
          <div className="portal-course-card__cover-overlay">
            <div className="portal-course-card__cover-overlay-title">
              {course.title}
            </div>
          </div>
        )}
      </div>

      {/* Body — 参考智慧慕课：标题 / 学校|教师 / 简介 / 进行中|人数 */}
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

        <Paragraph className="portal-course-card__description" ellipsis={{ rows: 2 }}>
          {course.description && course.description !== course.title
            ? course.description
            : "课程简介正在完善中，点击进入可查看课程详情与学习内容。"}
        </Paragraph>

        <div className="portal-course-card__footer">
          <span
            className={`portal-course-card__progress ${course.isEnrolled ? "portal-course-card__progress--enrolled" : ""}`}
          >
            <BarChartOutlined />
            {course.isEnrolled ? "学习中" : "进行中"}
          </span>
          <span className="portal-course-card__learners">
            <EyeOutlined />
            {studyCount}人学习
          </span>
        </div>
      </div>
    </button>
  );
}

export default function CourseListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { authenticated, user } = useAuth();
  const branding = useBranding();
  const screens = Grid.useBreakpoint();
  const { courses, subjectStats: allSubjectStats, organizations, isLoading } = useCourseCatalog();
  // 动态门户导航（固定 2 项（课程/微专业）+ 模板页（上限 6））
  const navItems = usePortalNavItems();
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 动态课程类别（Tab：全部课程 + 管理端配置的类别）
  const { categories: categorySections } = useCourseCategories();
  const categoryTabs = useMemo(
    () => [
      ALL_COURSES_TAB,
      ...categorySections.map((s) => ({ key: s.category.id, label: s.category.name })),
    ],
    [categorySections]
  );

  const activeTab = searchParams.get("tab") || "all";
  const selectedSubject = searchParams.get("subject") || "all";
  const selectedOrg = searchParams.get("org") || "all";
  const searchQuery = searchParams.get("q") || "";
  const [page, setPage] = useState(1);

  // "仅显示有课学科" 默认勾选
  const onlyWithCourses = searchParams.get("hasCourses") !== "0";

  // Local search state to avoid URL-sync issues during typing
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

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

  const visibleSubjects = useMemo(() => {
    // 移动端强制只显示有课学科，非移动端使用开关状态（默认勾选）
    const useFilter = isMobile || onlyWithCourses;
    return useFilter
      ? subjectStats.filter((s) => s.count > 0)
      : subjectStats;
  }, [subjectStats, isMobile, onlyWithCourses]);

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
    navigate(`/dashboard/front?courseId=${course.id}&tenant=${course.orgSchemaName}`);
  };

  return (
    <Layout className="home-page cl-page">
      <Header className="home-header">
        <div className="home-header__inner">
          <div className="home-header__left">
            <div className="home-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              <img src={branding.logo_light} alt={branding.app_name} className="home-brand__logo" />
              <div className="home-brand__title">{branding.app_title}</div>
            </div>
            {!isMobile && (
              <div className="home-nav">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    type="text"
                    className={`home-nav__button ${item.key === "/courses" ? "is-active" : ""}`}
                    onClick={() => navigate(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
          <div className="home-header__actions">
            {isMobile ? (
              <>
                {authenticated && user && (
                  <UserMenu role="student" variant="header" />
                )}
                <Button
                  type="text"
                  icon={<MenuOutlined style={{ fontSize: 18, color: themeColors.textPrimary }} />}
                  onClick={() => setMobileMenuOpen(true)}
                  aria-label="打开菜单"
                />
              </>
            ) : authenticated && user ? (
              <UserMenu role="student" variant="header" />
            ) : (
              <>
                <Button className="home-login-button" onClick={() => navigate("/login")}>登录</Button>
                <Button className="home-register-button" onClick={() => navigate("/login")}>进入平台</Button>
              </>
            )}
          </div>
        </div>
      </Header>

      {/* 移动端全屏菜单 */}
      <MobileFullMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        items={navItems}
        activeKey="/courses"
        authActions={
          !authenticated
            ? [{ label: "登录" }, { label: "进入平台", primary: true }]
            : undefined
        }
      />

      <Content>
        {/* 移动端：紧凑筛选条 - 下拉框选择器 */}
        {isMobile ? (
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
        ) : (
          /* 桌面端：完整筛选区 */
          <section className="cl-filter-bar">
            <div className="cl-filter-bar__inner">
              <div className="cl-filter-bar__row">
                <span className="cl-filter-bar__label">层级</span>
                <div className="cl-filter-bar__content">
                  <button
                    type="button"
                    className={`cl-filter-tag ${selectedLevel === "all" ? "is-active" : ""}`}
                    onClick={() => updateSearchParams({ level: undefined, subject: undefined })}
                  >
                    全部层级
                  </button>
                  {levelOptions.map((level) => {
                    const levelCount = courses.filter((c) => c.educationLevel === level.value).length;
                    return (
                      <button
                        key={level.value}
                        type="button"
                        className={`cl-filter-tag ${selectedLevel === level.value ? "is-active" : ""}`}
                        onClick={() => updateSearchParams({ level: level.value, subject: undefined })}
                      >
                        {level.label}
                        {levelCount > 0 && <span className="cl-filter-tag__count">{levelCount}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="cl-filter-bar__row">
                <span className="cl-filter-bar__label">学校</span>
                <div className="cl-filter-bar__content">
                  <button
                    type="button"
                    className={`cl-filter-tag ${selectedOrg === "all" ? "is-active" : ""}`}
                    onClick={() => updateSearchParams({ org: undefined })}
                  >
                    全部学校
                  </button>
                  {organizations.map((org) => (
                    <button
                      key={org.schemaName}
                      type="button"
                      className={`cl-filter-tag ${selectedOrg === org.schemaName ? "is-active" : ""}`}
                      onClick={() => updateSearchParams({ org: org.schemaName })}
                    >
                      {org.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="cl-filter-bar__row">
                <span className="cl-filter-bar__label">学科</span>
                <div className="cl-filter-bar__content cl-filter-bar__content--wrap">
                  <button
                    type="button"
                    className={`cl-filter-tag ${selectedSubject === "all" ? "is-active" : ""}`}
                    onClick={() => updateSearchParams({ subject: undefined })}
                  >
                    全部学科
                  </button>
                  {visibleSubjects.map((subject) => (
                    <button
                      key={subject.code}
                      type="button"
                      className={`cl-filter-tag ${selectedSubject === subject.code ? "is-active" : ""} ${subject.count === 0 ? "is-empty" : ""}`}
                      onClick={() => updateSearchParams({ subject: subject.code })}
                    >
                      {subject.name}
                      {subject.count > 0 && <span className="cl-filter-tag__count">{subject.count}</span>}
                    </button>
                  ))}
                </div>
                <div className="cl-filter-bar__toggle">
                  <Switch
                    size="small"
                    checked={onlyWithCourses}
                    onChange={(checked) => updateSearchParams({ hasCourses: checked ? undefined : "0" })}
                  />
                  <Text className="cl-filter-bar__toggle-text">仅显示有课学科</Text>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Search + Tabs + Course List */}
        <section className="cl-list-section">
          <div className="cl-list-section__inner">
            {/* Search bar */}
            <div className="cl-search-bar" style={isMobile ? { padding: "4px 14px" } : undefined}>
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
            </div>

            {/* Tabs */}
            <div className="cl-tabs" style={isMobile ? { padding: "4px 14px 8px", gap: 0, borderBottom: "1px solid #edf3ff", marginBottom: 0 } : undefined}>
              <div style={isMobile ? { display: "flex", gap: 5, flex: 1, minWidth: 0 } : undefined}>
                {categoryTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    className={`cl-tabs__item ${activeTab === tab.key ? "is-active" : ""}`}
                    onClick={() => updateSearchParams({ tab: tab.key === "all" ? undefined : tab.key, subject: undefined })}
                    style={isMobile ? { flex: 1, justifyContent: "center", padding: "7px 4px", fontSize: 13, borderRadius: 8, minWidth: 0 } : undefined}
                  >
                    <span>{isMobile ? tab.label.replace("课程", "") : tab.label}</span>
                  </button>
                ))}
              </div>
              <div className="cl-tabs__stat" style={isMobile ? { fontSize: 12, flexShrink: 0, marginLeft: 8, padding: "7px 0 7px 8px", borderLeft: "1px solid #edf3ff" } : undefined}>
                <strong>{filteredCourses.length}</strong>{isMobile ? "门" : ` 共 ${filteredCourses.length} 门课程`}
              </div>
            </div>

            {isLoading ? (
              <div className={`portal-course-grid ${!isMobile ? "portal-course-grid--wide" : ""}`} style={isMobile ? { display: "grid", gridTemplateColumns: "1fr", gap: 12, padding: "0 14px" } : undefined}>
                {Array.from({ length: isMobile ? 6 : 12 }).map((_, index) => (
                  <div key={index} className="portal-course-card portal-course-card--loading">
                    <Skeleton.Image active className="portal-course-card__skeleton-cover" />
                    <div style={{ padding: 16 }}>
                      <Skeleton active paragraph={{ rows: 3 }} title={{ width: "80%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginatedCourses.length > 0 ? (
              <>
                <div className={`portal-course-grid ${!isMobile ? "portal-course-grid--wide" : ""}`} style={isMobile ? { display: "grid", gridTemplateColumns: "1fr", gap: 12, padding: "0 14px" } : undefined}>
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
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
