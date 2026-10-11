import { useMemo, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
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
import { useAuth } from "@/auth/auth-context";
import GlobalFooter from "@/components/layout/global-footer";
import PortalHeader from "@/components/layout/portal-header";
import { usePageTitle } from "@/hooks/use-page-title";
import { useQuery } from "@tanstack/react-query";
import { setCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { listMicroMajors, myMicroMajorEnrollments, myApplications, listOrganizations } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import "@/styles/home-portal-theme.css";
import "@/styles/portal-editorial.css";

const { Content } = Layout;

const MICRO_MAJORS_PER_PAGE = 12;

interface MicroMajorCourseLite {
  id: string;
  title?: string | null;
  credits?: number | null;
  semesterHours?: number | null;
}

interface MicroMajorItem {
  id: string;
  name: string;
  projectBackground?: string | null;
  abilityObjective?: string | null;
  learningCycle?: string | null;
  assessmentMethod?: string | null;
  tuitionFee?: string | null;
  coverUrl?: string | null;
  intro?: string | null;
  status?: "draft" | "active" | "archived";
  microMajorCourses?: MicroMajorCourseLite[];
}

interface OrganizationItem {
  id: string;
  name?: string | null;
  schemaName?: string | null;
}

/** 依据名称推断方向（与卡片主题一致）：商务数据 / 设计艺术 / 工程技术 / 其他方向 */
function categoryOf(name: string): { label: string; theme: string } {
  if (/数据|商务|分析/.test(name)) return { label: "商务数据", theme: "theme-blue" };
  if (/设计|艺术|表达/.test(name)) return { label: "设计艺术", theme: "theme-purple" };
  if (/制造|材料|工程|智能/.test(name)) return { label: "工程技术", theme: "theme-teal" };
  return { label: "其他方向", theme: "theme-default" };
}

const CATEGORIES = ["全部", "商务数据", "设计艺术", "工程技术"];

function MicroMajorCard({
  major,
  enrollmentStatus,
  onClick,
}: {
  major: MicroMajorItem & { _orgName?: string };
  enrollmentStatus?: string | null;
  onClick: (major: MicroMajorItem) => void;
}) {
  const orgName = major._orgName || "";
  const cat = categoryOf(major.name || "");
  const courses = major.microMajorCourses || [];
  const titles = courses.map((c) => c.title).filter((t): t is string => Boolean(t));
  const desc = major.intro || major.projectBackground || "暂无简介";
  const isEnrolled = enrollmentStatus === "active" || enrollmentStatus === "completed";
  const levelLabel = isEnrolled ? "学习中" : major.status === "active" || !major.status ? "招生中" : "已结束";

  return (
    <article className="major-card">
      <a
        className={`major-card-cover ${cat.theme}`}
        onClick={() => onClick(major)}
        style={
          major.coverUrl
            ? {
                backgroundImage: `linear-gradient(180deg, rgba(6,19,39,.25) 0%, rgba(6,19,39,.72) 100%), url(${major.coverUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        <span className="major-code">{orgName || "MICRO MAJOR"}</span>
        <span className="major-cover-title">{major.name}</span>
        <span className="major-cover-bottom">
          {cat.label}
          <span aria-hidden="true">↗</span>
        </span>
      </a>
      <div className="major-card-content">
        <div className="major-tags">
          <span>{major.learningCycle || "系统学习"}</span>
          <span>{courses.length} 门课程</span>
          <span>{levelLabel}</span>
        </div>
        <h3><a onClick={() => onClick(major)}>{major.name}微专业</a></h3>
        <p className="major-desc" title={desc}>{desc}</p>
        <div className="major-course-preview">
          <div>
            <b>你将学习</b>
            <small>{courses.length > 0 ? `${courses.length} 门系列课程` : "系列课程筹备中"}</small>
          </div>
          <ol>
            {[0, 1, 2].map((i) => {
              const t = titles[i];
              return (
                <li key={i} className={t ? undefined : "is-empty"}>
                  <span>0{i + 1}</span>
                  {t || "——"}
                </li>
              );
            })}
          </ol>
          <a className="major-more-courses" onClick={() => onClick(major)}>
            {courses.length > 0
              ? <>查看全部 {courses.length} 门课程 <span>→</span></>
              : <>了解微专业详情 <span>→</span></>}
          </a>
        </div>
        <div className="major-card-bottom">
          <span>{levelLabel}</span>
          {isEnrolled ? (
            <a className="major-cta is-enrolled" onClick={() => onClick(major)}>继续学习 ↗</a>
          ) : (
            <a onClick={() => onClick(major)}>了解微专业 ↗</a>
          )}
        </div>
      </div>
    </article>
  );
}

export default function MicroMajorListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authenticated, user, tenant } = useAuth();
  usePageTitle();
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("全部");

  const urlTenant = searchParams.get("tenant");
  // 默认 null 表示"全部学校"
  const [selectedTenant, setSelectedTenant] = useState<string | null>(urlTenant || null);

  const { data: allOrganizations = [] } = useQuery<OrganizationItem[]>({
    queryKey: ["all-organizations"],
    queryFn: async () => {
      try {
        const result = await listOrganizations({
          tenant: "public",
          fields: ["id", "name", "schemaName"],
        });
        if (!result.success) return [];
        return extractArrayData(result);
      } catch {
        return [];
      }
    },
  });

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-major-enrollments", tenant, user?.id],
    queryFn: async () => {
      if (!user || !tenant) return [];
      const headers = getAuthHeaders(user) as Record<string, string>;
      const result = await myMicroMajorEnrollments({
        tenant,
        fields: ["id", "microMajorId", "status"],
        headers,
      });
      if (!result.success) return [];
      return extractArrayData(result);
    },
    enabled: !!user && !!tenant && authenticated,
  });

  // 补充查询 myApplications
  const { data: myApps = [] } = useQuery({
    queryKey: ["my-mm-apps", tenant, user?.id],
    queryFn: async () => {
      if (!user || !tenant) return [];
      const headers = getAuthHeaders(user) as Record<string, string>;
      const result = await myApplications({
        tenant,
        fields: ["id", "microMajorId", "status"],
        headers,
      });
      if (!result.success) return [];
      return extractArrayData(result);
    },
    enabled: !!user && !!tenant && authenticated,
  });

  const enrollmentStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    const all = [...myEnrollments, ...myApps];
    const seen = new Set<string>();
    all.forEach((e) => {
      const key = e.microMajorId;
      if (!seen.has(key)) {
        seen.add(key);
        map.set(key, e.status || "active");
      }
    });
    return map;
  }, [myEnrollments, myApps]);

  const majorFields = [
    "id",
    "name",
    "projectBackground",
    "abilityObjective",
    "learningCycle",
    "assessmentMethod",
    "tuitionFee",
    "coverUrl",
    "intro",
    "status",
    { microMajorCourses: ["id", "title", "credits", "semesterHours"] },
  ] as any;

  // 查询微专业列表 - 当 selectedTenant 为 null 时查询所有学校
  const { data: microMajors = [], isLoading } = useQuery({
    queryKey: ["micro-major-list", selectedTenant, allOrganizations],
    queryFn: async () => {
      const headers = user ? getAuthHeaders(user) as Record<string, string> : undefined;

      if (selectedTenant) {
        const result = await listMicroMajors({
          tenant: selectedTenant,
          fields: majorFields,
          sort: "sortOrder",
          page: { limit: 100, offset: 0 },
          headers,
        });
        if (!result.success) {
          throw new Error("获取微专业列表失败");
        }
        return extractArrayData(result);
      }

      const allResults: MicroMajorItem[] = [];
      for (const org of allOrganizations) {
        if (!org.schemaName) continue;
        try {
          const result = await listMicroMajors({
            tenant: org.schemaName,
            fields: majorFields,
            sort: "sortOrder",
            page: { limit: 100, offset: 0 },
            headers,
          });
          if (result.success) {
            const items = extractArrayData(result);
            items.forEach((item: MicroMajorItem) => {
              (item as any)._tenant = org.schemaName;
              (item as any)._orgName = org.name || org.schemaName;
            });
            allResults.push(...items);
          }
        } catch (e) {
          console.warn(`获取 ${org.schemaName} 微专业失败`, e);
        }
      }
      return allResults;
    },
    enabled: true,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });

  const filteredMajors = useMemo(() => {
    let results = microMajors;
    if (categoryFilter !== "全部") {
      results = results.filter((m: MicroMajorItem) => categoryOf(m.name || "").label === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      results = results.filter(
        (m: MicroMajorItem) =>
          m.name?.toLowerCase().includes(q) ||
          m.learningCycle?.toLowerCase().includes(q) ||
          m.assessmentMethod?.toLowerCase().includes(q) ||
          m.tuitionFee?.toLowerCase().includes(q) ||
          m.intro?.toLowerCase().includes(q) ||
          m.projectBackground?.toLowerCase().includes(q) ||
          (m.microMajorCourses || []).some((c) => c.title?.toLowerCase().includes(q))
      );
    }
    // 已通过的微专业排在前面
    return [...results].sort((a, b) => {
      const statusA = enrollmentStatusMap.get(a.id);
      const statusB = enrollmentStatusMap.get(b.id);
      if (statusA === "active" && statusB !== "active") return -1;
      if (statusA !== "active" && statusB === "active") return 1;
      return 0;
    });
  }, [searchQuery, categoryFilter, microMajors, enrollmentStatusMap]);

  const maxPage = Math.max(1, Math.ceil(filteredMajors.length / MICRO_MAJORS_PER_PAGE));
  const currentPage = Math.min(page, maxPage);
  const paginatedMajors = filteredMajors.slice(
    (currentPage - 1) * MICRO_MAJORS_PER_PAGE,
    currentPage * MICRO_MAJORS_PER_PAGE
  );

  const handleTenantChange = (newTenant: string | null | undefined) => {
    setSelectedTenant(newTenant || null);
    setPage(1);
  };

  const handleCardClick = useCallback((major: MicroMajorItem) => {
    const tenantToUse = selectedTenant || (major as any)._tenant;
    if (tenantToUse) {
      const org = allOrganizations.find((o) => o.schemaName === tenantToUse);
      setCurrentTenant({
        id: tenantToUse,
        name: org?.name || tenantToUse,
        schemaName: tenantToUse,
      });
    }
    navigate(`/micro-majors/${tenantToUse}/${major.id}`);
  }, [navigate, selectedTenant, allOrganizations]);

  return (
    <Layout className="home-page cl-page">
      <PortalHeader activeKey="/micro-majors" sectionTitle="导航" />

      <Content>
        <div className="ed-container">
          <div className="majors-page">
            {/* Hero */}
            <section className="major-directory-hero">
              <div className="home-mini">发现你的下一个能力方向</div>
              <h1>用一段系统学习，<br />打开新的专业可能。</h1>
              <p>发现适合你的微专业，从课程体系到实践成果，找到清晰的成长路径。</p>
              <div className="major-hero-foot">
                <span>系统化课程</span>
                <span>项目实践</span>
                <span>能力进阶</span>
              </div>
            </section>

            {/* 工具区：标题 + 搜索 + 分类 + 结果行 */}
            <div className="major-directory-tools">
              <div className="major-section-heading">
                <div>
                  <h2>探索微专业</h2>
                  <p>选择感兴趣的方向，查看具体课程与学习安排。</p>
                </div>
                <div className="major-heading-tools">
                  <Select
                    className="major-school-select"
                    size="large"
                    placeholder="全部学校"
                    value={selectedTenant || undefined}
                    onChange={handleTenantChange}
                    allowClear
                    options={allOrganizations
                      .filter((o) => o.schemaName)
                      .map((org) => ({ label: org.name || org.schemaName!, value: org.schemaName! }))}
                  />
                  <label className="major-search">
                    <Input
                      placeholder="搜索微专业、课程名称"
                      prefix={<SearchOutlined />}
                      allowClear
                      size="large"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setPage(1);
                      }}
                    />
                  </label>
                </div>
              </div>

              <div className="major-category-tabs" role="group" aria-label="微专业方向">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={categoryFilter === c ? "active" : ""}
                    aria-pressed={categoryFilter === c}
                    onClick={() => {
                      setCategoryFilter(c);
                      setPage(1);
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="major-results-line">
                <span>{filteredMajors.length} 个微专业</span>
                <small>课程与项目以平台实际公布为准</small>
              </div>
            </div>

            {/* 卡片网格 */}
            {isLoading ? (
              <div className="major-grid">
                {Array.from({ length: isMobile ? 4 : 9 }).map((_, index) => (
                  <div key={index} className="major-card">
                    <Skeleton.Image active style={{ width: "100%", height: 178 }} />
                    <div style={{ padding: 16 }}>
                      <Skeleton active paragraph={{ rows: 2 }} title={{ width: "80%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginatedMajors.length > 0 ? (
              <>
                <div className="major-grid">
                  {paginatedMajors.map((major: MicroMajorItem) => (
                    <MicroMajorCard
                      key={`${major.id}_${(major as any)._tenant || selectedTenant || ""}`}
                      major={major as MicroMajorItem & { _orgName?: string }}
                      enrollmentStatus={enrollmentStatusMap.get(major.id) || null}
                      onClick={handleCardClick}
                    />
                  ))}
                </div>
                <div className="cl-pagination" style={isMobile ? { padding: "16px 0 8px" } : undefined}>
                  <Pagination
                    current={currentPage}
                    pageSize={MICRO_MAJORS_PER_PAGE}
                    total={filteredMajors.length}
                    onChange={setPage}
                    showSizeChanger={false}
                    showTotal={isMobile ? undefined : (total) => `共 ${total} 个微专业`}
                    size={isMobile ? "small" : "default"}
                  />
                </div>
              </>
            ) : (
              <Empty
                className="home-empty"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={searchQuery || categoryFilter !== "全部" ? "未找到匹配的微专业" : "当前暂无微专业"}
              />
            )}

            {/* 帮助区 */}
            <section className="major-help">
              <h2>还不确定从哪里开始？</h2>
              <p>先看适合人群，再看课程目录；结合自己的基础与可投入时间，选择合适的学习路径。</p>
              <a onClick={() => navigate("/courses")}>先探索单门课程 →</a>
            </section>
          </div>
        </div>
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
