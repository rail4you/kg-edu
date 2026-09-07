import { useMemo } from "react";
import { Button, Empty, Grid, Layout, Skeleton, Typography } from "antd";
import { useQuery } from "@tanstack/react-query";
import {
  BankOutlined,
  BarChartOutlined,
  EyeOutlined,
  RightOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import PortalHero from "@/components/home/portal-hero";
import MobilePromoBanner from "@/components/home/mobile-promo-banner";
import MobileCourseSections from "@/components/home/national-quality-section";
import QuickEntryGrid from "@/components/home/quick-entry-grid";
import SubjectCategoryPanels from "@/components/home/subject-category-panels";
import CourseCoverArt from "@/components/course-cover-art";
import { useCourseCatalog, type CatalogCourse } from "@/hooks/use-course-catalog";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { usePortalNavItems, useLevelTitleMap } from "@/hooks/use-portal-config";
import { useCourseCategories } from "@/hooks/use-course-categories";
import { setCurrentTenant } from "@/lib/tenant";
import "@/styles/home-portal-theme.css";

const { Header, Content } = Layout;
const { Paragraph, Text, Title } = Typography;

/** 品牌 Logo + 标题（使用动态配置） */
function HomeBrandSection() {
  const branding = useBranding();
  return (
    <>
      <img src={branding.logo_light} alt={branding.app_name} className="home-brand__logo" />
      <div className="home-brand__title">{branding.app_title}</div>
    </>
  );
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

        {/* 右上金色学科标签（参考智慧慕课「国家一流课程」） */}
        <div className="portal-course-card__cover-badges">
          <span className="portal-course-card__cover-badge portal-course-card__cover-badge--subject">
            {course.standardSubject.name}
          </span>
        </div>

        {/* Bottom overlay: 仅真实图片时显示标题（插画封面自带标题） */}
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

function CourseSection({
  title,
  courses,
  isLoading,
  onMore,
  onCourseClick,
}: {
  title: string;
  courses: CatalogCourse[];
  isLoading: boolean;
  onMore: () => void;
  onCourseClick: (course: CatalogCourse) => void;
}) {
  return (
    <section className="home-course-panel">
      <div className="home-course-panel__header">
        <div className="home-course-panel__title-wrap">
          <Title level={4} className="home-course-panel__title">
            {title}
          </Title>
        </div>

        <button type="button" className="home-course-panel__more" onClick={onMore}>
          查看更多
          <RightOutlined />
        </button>
      </div>

      {isLoading ? (
        <div className="portal-course-grid">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="portal-course-card portal-course-card--loading">
              <Skeleton.Image active className="portal-course-card__skeleton-cover" />
              <div style={{ padding: 16 }}>
                <Skeleton active paragraph={{ rows: 3 }} title={{ width: "80%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length > 0 ? (
        <div className="portal-course-grid">
          {courses.map((course) => (
            <CourseCard
              key={`${course.id}-${course.orgSchemaName}`}
              course={course}
              onClick={onCourseClick}
            />
          ))}
        </div>
      ) : (
        <Empty className="home-empty" image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无课程数据" />
      )}
    </section>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, authenticated } = useAuth();
  usePageTitle();
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;

  const { courses, recommendedCourses, isLoading } = useCourseCatalog();
  // 课程类别模块（推荐课程/新开课程等，管理端动态配置）
  const { categories: categorySections } = useCourseCategories();

  // Hero 轮播取「新开课程」类别的前 3 个（未配置时回退到推荐课程前 3 个）
  const heroCourses = useMemo(() => {
    const newestSection = categorySections.find((section) => section.category.slug === "newest");
    const newest = newestSection?.courses ?? [];
    if (newest.length > 0) {
      return newest.slice(0, 3);
    }
    return recommendedCourses.slice(0, 3);
  }, [categorySections, recommendedCourses]);

  // 动态导航：固定 2 项（课程/微专业）+ 模板页（按顺序，启用项，总数上限 6）
  const navItems = usePortalNavItems();
  // 动态学历层级名称（研究生/本科/高职/中职，可被超级管理员修改）
  const levelTitleMap = useLevelTitleMap();

  const handleNav = (path: string) => {
    navigate(path);
  };

  const handleCourseClick = (course: CatalogCourse) => {
    setCurrentTenant({
      id: course.orgSchemaName,
      name: course.orgName,
      schemaName: course.orgSchemaName,
    });

    navigate(`/dashboard/front?courseId=${course.id}&tenant=${course.orgSchemaName}`);
  };

  return (
    <Layout className="home-page home-immersive">
      <Header className="home-header">
        <div className="home-header__inner">
          <div className="home-header__left">
            <div className="home-brand">
              <HomeBrandSection />
            </div>

            {!isMobile && (
              <div className="home-nav">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    type="text"
                    className={`home-nav__button ${item.key === "/" ? "is-active" : ""}`}
                    onClick={() => handleNav(item.key)}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
            )}


          </div>

          <div className="home-header__actions">
            {authenticated && user ? (
              <UserMenu role="student" variant="header" />
            ) : isMobile ? (
              <>
                <Button
                  type="text"
                  className="home-header__search-btn"
                  aria-label="搜索课程"
                  onClick={() => navigate("/courses")}
                  icon={<SearchOutlined />}
                />
                <Button
                  type="text"
                  className="home-header__login-text"
                  onClick={() => navigate("/login")}
                >
                  登录
                </Button>
              </>
            ) : (
              <>
                <Button className="home-login-button" onClick={() => navigate("/login")}>
                  登录
                </Button>
                <Button className="home-register-button" onClick={() => navigate("/login")}>
                  进入平台
                </Button>
              </>
            )}
          </div>
        </div>
      </Header>

      <Content>
        {isMobile ? (
          <>
            {/* 移动端推广 Banner */}
            <MobilePromoBanner />

            {/* 移动端微专业入口卡片 - 与资源库风格统一 */}
            <div
              style={{
                margin: "8px 14px 0",
                padding: "18px 18px 22px",
                borderRadius: 18,
                background:
                  "radial-gradient(circle at 100% 0%, rgba(255, 255, 255, 0.18) 0%, transparent 55%), linear-gradient(135deg, #2155d9 0%, #3a6fe0 50%, #5b8bf3 100%)",
                boxShadow: "0 14px 32px rgba(33, 85, 217, 0.28)",
              }}
            >
              <div className="mobile-promo-banner__pills" style={{ marginBottom: 12 }}>
                <span className="mobile-promo-banner__pill">急需紧缺型</span>
                <span className="mobile-promo-banner__pill">应用技能型</span>
                <span className="mobile-promo-banner__pill">交叉复合型</span>
              </div>

              <h2 className="mobile-promo-banner__title" style={{ fontSize: 20 }}>微专业</h2>
              <p className="mobile-promo-banner__subtitle">跨学科特色培养 · 即学即用</p>

              <button
                type="button"
                className="mobile-promo-banner__cta"
                onClick={() => navigate("/micro-majors")}
              >
                进入微专业 →
              </button>
            </div>

            {/* 移动端课程列表：动态类别 */}
            <MobileCourseSections
              sections={categorySections}
              isLoading={isLoading}
              onCourseClick={handleCourseClick}
            />
          </>
        ) : (
          <>
            {/* 学银在线风格的 Hero 区 */}
            <PortalHero heroCourses={heroCourses} />

            {/* 左右两栏：左侧快捷导航，右侧学历模块（学科分类面板） */}
            <section className="xyedu-portal-main">
              <div className="xyedu-portal-main__shell">
                <div className="xyedu-portal-main__left">
                  <QuickEntryGrid />
                </div>
                <div className="xyedu-portal-main__right">
                  <SubjectCategoryPanels courses={courses} titleOverrides={levelTitleMap} />
                </div>
              </div>
            </section>

            {/* 推荐/新开课程区块 — 管理端动态类别 */}
            <section className="home-showcase">
              <div className="home-showcase__shell">
                {categorySections.map((section) => (
                  <CourseSection
                    key={section.category.id}
                    title={section.category.name}
                    courses={section.courses.slice(0, 4)}
                    isLoading={isLoading}
                    onMore={() => navigate(`/courses?tab=${section.category.id}`)}
                    onCourseClick={handleCourseClick}
                  />
                ))}
              </div>
            </section>

          </>
        )}
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
