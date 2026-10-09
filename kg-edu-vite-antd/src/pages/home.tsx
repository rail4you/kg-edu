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
import PortalHero from "@/components/home/editorial-hero";
import MobilePromoBanner from "@/components/home/mobile-promo-banner";
import "@/styles/portal-editorial.css";
import MobileCourseSections from "@/components/home/national-quality-section";
import CourseCoverArt from "@/components/course-cover-art";
import { buildSubjectCategoryPanels, CATEGORY_EDUCATION_LEVEL } from "@/lib/subject-category-grouping";
import { useCourseCatalog, type CatalogCourse } from "@/hooks/use-course-catalog";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { usePortalNavItems, useLevelTitleMap } from "@/hooks/use-portal-config";
import { useCourseCategories } from "@/hooks/use-course-categories";
import { setCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { listMicroMajors, listOrganizations, listCoursesByMicroMajor } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import "@/styles/home-portal-theme.css";

const { Header, Content } = Layout;
const { Text, Title } = Typography;

/** 学历层级入口（key 与课程页 level 参数一致） */
const LEVELS = [
  { key: "graduate", sub: "深入研究 · 拓展前沿" },
  { key: "undergraduate", sub: "夯实基础 · 探索专业" },
  { key: "higher_vocational", sub: "技能进阶 · 实践应用" },
  { key: "secondary_vocational", sub: "兴趣启蒙 · 职业起步" },
];

/** 品牌 Logo + 标题（使用动态配置） */
function HomeBrandSection() {
  const branding = useBranding();
  return (
    <>
      <img src={branding.logo_dark} alt={branding.app_name} className="home-brand__logo" />
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

      {/* Body — 参考智慧慕课：标题 / 学校|教师 / 简介 / 进行中|人数
          纯 CSS 截断（home-portal-theme.css），不使用 antd ellipsis JS 测量，
          避免 JS 与 -webkit-line-clamp 打架导致第三行漏出 */}
      <div className="portal-course-card__body">
        <Text className="portal-course-card__title">{course.title}</Text>

        <div className="portal-course-card__school">
          <BankOutlined />
          <span className="portal-course-card__school-name">{course.orgName}</span>
          <span className="portal-course-card__school-divider">|</span>
          <span className="portal-course-card__school-teacher">教师：{course.teacherName}</span>
        </div>

        <div className="portal-course-card__description">
          <span className="portal-course-card__description-inner">
            {course.description && course.description !== course.title
              ? course.description
              : "课程简介正在完善中，点击进入可查看课程详情与学习内容。"}
          </span>
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
  // 学科面板（真实课程数据，供层级悬浮菜单使用）
  const subjectPanels = useMemo(
    () => buildSubjectCategoryPanels(courses, levelTitleMap),
    [courses, levelTitleMap]
  );

  // 首页微专业区：取真实微专业前 3 个（跨学校，复用列表页查询逻辑）
  const { data: homeMajors = [] } = useQuery({
    queryKey: ["home-micro-majors"],
    queryFn: async () => {
      const headers = user ? getAuthHeaders(user) as Record<string, string> : undefined;
      const orgResult = await listOrganizations({ tenant: "public", fields: ["id", "name", "schemaName"] });
      if (!orgResult.success) return [];
      const orgs = extractArrayData<{ id: string; name?: string | null; schemaName?: string | null }>(orgResult);
      const collected: unknown[] = [];
      for (const org of orgs) {
        if (!org.schemaName || collected.length >= 3) break;
        try {
          const r = await listMicroMajors({
            tenant: org.schemaName,
            fields: ["id", "name", "intro", "projectBackground", "learningCycle", "tuitionFee", "coverUrl", "status", { microMajorCourses: ["id"] }],
            sort: "sortOrder",
            page: { limit: 10, offset: 0 },
            headers,
          });
          if (r.success) {
            for (const m of extractArrayData<Record<string, unknown>>(r)) {
              if (m.status === "active" || !m.status) {
                // 取该微专业课程标题（供卡片“你将学习”预览）
                let courseTitles: string[] = [];
                try {
                  const cr = await listCoursesByMicroMajor({
                    tenant: org.schemaName,
                    input: { microMajorId: m.id as string },
                    fields: ["id", "title", "sortOrder"],
                    sort: "sortOrder",
                    headers,
                  });
                  if (cr.success) {
                    courseTitles = extractArrayData<{ title?: string | null }>(cr)
                      .map((c) => c.title || "")
                      .filter(Boolean);
                  }
                } catch { /* 忽略课程标题失败 */ }
                collected.push({ ...m, courseTitles, _tenant: org.schemaName, _orgName: org.name || org.schemaName });
                if (collected.length >= 3) break;
              }
            }
          }
        } catch { /* 忽略单个学校失败 */ }
      }
      return collected as Array<{
        id: string; name: string; intro?: string | null; projectBackground?: string | null;
        learningCycle?: string | null; tuitionFee?: string | null; coverUrl?: string | null;
        microMajorCourses?: Array<{ id: string }>; courseTitles: string[]; _tenant: string; _orgName: string;
      }>;
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const handleMajorClick = (m: { id: string; _tenant: string; _orgName: string }) => {
    setCurrentTenant({ id: m._tenant, name: m._orgName, schemaName: m._tenant });
    navigate(`/micro-majors/${m._tenant}/${m.id}`);
  };

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
      <Header className="home-header ed-top">
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
            <div className="ed-page">
            <PortalHero heroCourses={heroCourses} />

            {/* 快捷入口：学历层级（悬停浮现学科菜单，直达带参课程页） */}
            <section className="ed-discover ed-container" aria-label="课程快捷入口">
              <div><h2 style={{fontSize:26,margin:0}}>开启你的学习旅程</h2></div>
              <div className="ed-levels">
                {LEVELS.map((l) => {
                  const panel = subjectPanels.find((p) => CATEGORY_EDUCATION_LEVEL[p.config.key] === l.key);
                  return (
                    <div key={l.key} className="ed-level-item">
                      <a onClick={() => navigate(`/courses?level=${l.key}`)}>
                        <span className="ed-level-top">{levelTitleMap[l.key]?.title || panel?.config.title || l.key} ↗</span>
                        <small>{l.sub}</small>
                      </a>
                      {panel && panel.subjects.length > 0 && (
                        <div className="ed-level-menu" role="menu">
                          <div className="ed-level-menu__title">{panel.config.title} · 选择学科</div>
                          <div className="ed-level-menu__grid">
                            {panel.subjects.map((s) => (
                              <button
                                key={s.code}
                                type="button"
                                disabled={s.count === 0}
                                onClick={() => navigate(`/courses?level=${l.key}&subject=${s.code}`)}
                              >
                                {s.name}
                                {s.count > 0 && <em>{s.count}</em>}
                              </button>
                            ))}
                          </div>
                          <a className="ed-level-menu__more" onClick={() => navigate(`/courses?level=${l.key}`)}>
                            查看{panel.config.title}全部课程 →
                          </a>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* 精选课程：取推荐课程前3，保持真实数据 */}
            <section className="ed-section ed-container">
              <div className="ed-section__title">
                <div><h2>好课程，陪伴每一步成长。</h2></div>
                <a className="ed-text-link" onClick={() => navigate("/courses")}>探索全部课程 →</a>
              </div>
              <div className="ed-section__intro"><p>从基础原理到真实实践，选择一门课程，打开一个新的世界。</p></div>
              <div className="ed-featured">
                {recommendedCourses.slice(0, 3).map((c, i) => (
                  <article key={c.id} className="ed-course">
                    <a
                      className={`ed-course__art v${i + 1}`}
                      onClick={() => handleCourseClick(c)}
                      style={
                        c.imageUrl
                          ? {
                              backgroundImage: `linear-gradient(180deg, rgba(6,19,39,.25) 0%, rgba(6,19,39,.72) 100%), url(${c.imageUrl})`,
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }
                          : undefined
                      }
                    >
                      <span className="ed-course__index">{c.standardSubject.name || "课程"} · 0{i + 1}</span>
                      <strong>{c.title}</strong>
                      <span className="ed-course__sub">{c.orgName}</span>
                    </a>
                    <div className="ed-course__body">
                      <div className="ed-course__meta"><span>{c.standardSubject.name}</span><small>智慧课程</small></div>
                      <h3><a onClick={() => handleCourseClick(c)}>{c.title}</a></h3>
                      <p title={c.description || c.title}>{c.description && c.description !== c.title ? c.description : "课程简介正在完善中，点击进入可查看课程详情与学习内容。"}</p>
                      <div className="ed-course__footer"><span>{c.teacherName || "教学团队"}</span><a onClick={() => handleCourseClick(c)}>了解课程 →</a></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {/* 微专业：真实数据，对齐原型 homepageMajors 结构 */}
            <section className="ed-section ed-container">
              <div className="ed-section__title">
                <div><h2>围绕一个方向，学成一项能力。</h2></div>
                <a className="ed-text-link" onClick={() => navigate("/micro-majors")}>探索全部微专业 →</a>
              </div>
              <div className="ed-section__intro"><p>把相关课程连成路径，让每一门课都朝着同一个目标前进。</p></div>
              <div className="major-grid">
                {homeMajors.map((m) => {
                  const theme = /数据|商务|分析/.test(m.name) ? "theme-blue" : /设计|艺术|表达/.test(m.name) ? "theme-purple" : /制造|材料|工程|智能/.test(m.name) ? "theme-teal" : "theme-default";
                  const desc = m.intro || m.projectBackground || "暂无简介";
                  return (
                    <article key={m.id} className="major-card">
                      <a
                        className={`major-card-cover ${theme}`}
                        onClick={() => handleMajorClick(m)}
                        style={
                          m.coverUrl
                            ? {
                                backgroundImage: `linear-gradient(180deg, rgba(6,19,39,.25) 0%, rgba(6,19,39,.72) 100%), url(${m.coverUrl})`,
                                backgroundSize: "cover",
                                backgroundPosition: "center",
                              }
                            : undefined
                        }
                      >
                        <span className="major-code">{m._orgName || "微专业"}</span>
                        <span className="major-cover-title">{m.name}</span>
                        <span className="major-cover-bottom">{m.learningCycle || "系统学习"}<span aria-hidden="true">↗</span></span>
                      </a>
                      <div className="major-card-content">
                        <div className="major-tags">
                          {m.learningCycle && <span>{m.learningCycle}</span>}
                          <span>{m.microMajorCourses?.length || 0} 门课程</span>
                        </div>
                        <h3><a onClick={() => handleMajorClick(m)}>{m.name}微专业</a></h3>
                        <p className="major-desc" title={desc}>{desc}</p>
                        {(m.courseTitles.length > 0 || (m.microMajorCourses?.length || 0) > 0) ? (
                          <div className="major-course-preview">
                            <div><b>你将学习</b><small>{m.microMajorCourses?.length || m.courseTitles.length} 门系列课程</small></div>
                            {m.courseTitles.length > 0 && (
                              <ol>
                                {m.courseTitles.slice(0, 3).map((t, ti) => (
                                  <li key={ti}><span>0{ti + 1}</span>{t}</li>
                                ))}
                              </ol>
                            )}
                            <a className="major-more-courses" onClick={() => handleMajorClick(m)}>查看全部 {m.microMajorCourses?.length || m.courseTitles.length} 门课程 <span>→</span></a>
                          </div>
                        ) : (
                          <div className="major-course-preview">
                            <div><b>你将学习</b><small>系列课程筹备中</small></div>
                            <ol>
                              <li><span>--</span>课程体系即将公布，敬请期待</li>
                            </ol>
                            <a className="major-more-courses" onClick={() => handleMajorClick(m)}>了解微专业详情 <span>→</span></a>
                          </div>
                        )}
                        <div className="major-card-bottom"><span>{m.tuitionFee || m._orgName || "微专业"}</span><a onClick={() => handleMajorClick(m)}>了解微专业 ↗</a></div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
            </div>

          </>
        )}
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
