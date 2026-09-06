import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Button,
  Empty,
  Grid,
  Input,
  Layout,
  Pagination,
  Skeleton,
  Select,
  Tag,
  Typography,
  message,
} from "antd";
import {
  ApartmentOutlined,
  BookOutlined,
  CheckCircleFilled,
  MenuOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import { MobileFullMenu } from "@/components/layout/mobile-full-menu";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import GlobalFooter from "@/components/layout/global-footer";
import { UserMenu } from "@/components/layout/user-menu";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import { themeColors } from "@/styles/theme";
import { useQuery } from "@tanstack/react-query";
import { usePortalNavItems } from "@/hooks/use-portal-config";
import { setCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { listMicroMajors, myMicroMajorEnrollments, myApplications, listOrganizations } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import "@/styles/home-portal-theme.css";

const { Header, Content } = Layout;
const { Paragraph, Text } = Typography;

const MICRO_MAJORS_PER_PAGE = 12;

interface MicroMajorItem {
  id: string;
  name: string;
  projectBackground?: string | null;
  knowledgeObjective?: string | null;
  abilityObjective?: string | null;
  qualityObjective?: string | null;
  projectFeatures?: string | null;
  learningCycle?: string | null;
  assessmentMethod?: string | null;
  tuitionFee?: string | null;
  coverUrl?: string | null;
  intro?: string | null;
  status?: "draft" | "active" | "archived";
  responsibleTeacher?: { id: string; name?: string | null; jobTitle?: string | null } | null;
  consultantTeacher?: { id: string; name?: string | null; jobTitle?: string | null } | null;
  microMajorCourses?: Array<{ id: string; credits?: number | null; semesterHours?: number | null }>;
}

interface OrganizationItem {
  id: string;
  name?: string | null;
  schemaName?: string | null;
}

interface MicroMajorEnrollmentItem {
  id: string;
  microMajorId: string;
  status?: string;
}

function extractResults<T>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === "object" && "results" in data) {
    const results = (data as { results?: unknown }).results;
    return Array.isArray(results) ? results as T[] : [];
  }
  return [];
}

function MicroMajorCard({
  major,
  enrollmentStatus,
  isLoggedIn,
  onClick,
}: {
  major: MicroMajorItem;
  enrollmentStatus: string | null;
  isLoggedIn: boolean;
  onClick: (major: MicroMajorItem) => void;
}) {
  const statusConfig: Record<string, { color: string; label: string; icon: string }> = {
    active: { color: "#52c41a", label: "已通过", icon: "✅" },
    pending: { color: "#faad14", label: "审核中", icon: "⏳" },
    rejected: { color: "#ff4d4f", label: "已拒绝", icon: "❌" },
  };
  const cfg = enrollmentStatus ? statusConfig[enrollmentStatus] : null;
  const isPlaceholder = !major.coverUrl;
  const orgName = (major as any)._orgName || "";

  return (
    <button
      type="button"
      className={`portal-course-card ${enrollmentStatus === "active" ? "is-enrolled" : "is-open"}`}
      onClick={() => onClick(major)}
    >
      {/* Cover — image with gradient overlay, badges overlaid */}
      <div
        className={`portal-course-card__cover ${isPlaceholder ? "is-placeholder" : "has-cover"}`}
        style={
          !isPlaceholder
            ? { backgroundImage: `url(${major.coverUrl})` }
            : undefined
        }
      >
        {isPlaceholder && (
          <div className="portal-course-card__cover-fallback">
            <ApartmentOutlined />
          </div>
        )}

        {/* Top badge row */}
        <div className="portal-course-card__cover-badges">
          {cfg ? (
            <span className="portal-course-card__cover-badge" style={{ background: cfg.color }}>
              {cfg.icon} {cfg.label}
            </span>
          ) : isLoggedIn ? (
            <span className="portal-course-card__cover-badge" style={{ background: "#1890ff" }}>
              + 报名
            </span>
          ) : null}
        </div>

        {/* Bottom overlay: major name on image */}
        <div className="portal-course-card__cover-overlay">
          <div className="portal-course-card__cover-overlay-title">
            {major.name}
          </div>
        </div>
      </div>

      {/* Body — compact meta info */}
      <div className="portal-course-card__body">
        <div className="portal-course-card__meta-top">
          <Text className="portal-course-card__org" ellipsis>
            {orgName || (major.responsibleTeacher?.name ? `负责人: ${major.responsibleTeacher.name}` : "微专业")}
          </Text>
          {major.learningCycle && (
            <Tag className="portal-course-card__status portal-course-card__status--open" style={{ fontSize: 12, padding: "0 8px", borderRadius: 4, lineHeight: "20px" }}>
              {major.learningCycle}
            </Tag>
          )}
        </div>

        <Paragraph className="portal-course-card__description" ellipsis={{ rows: 2 }}>
          {major.intro || major.projectBackground || "暂无简介"}
        </Paragraph>

        <div className="portal-course-card__footer">
          <div className="portal-course-card__teacher">
            <BookOutlined style={{ fontSize: 14 }} />
            <Text ellipsis style={{ fontSize: 12 }}>
              {major.microMajorCourses?.length || 0} 门课程
            </Text>
          </div>
          <div className="portal-course-card__footer-right">
            {major.tuitionFee && (
              <span className="portal-course-card__study-badge">{major.tuitionFee}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

export default function MicroMajorListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authenticated, user, tenant } = useAuth();
  const branding = useBranding();
  usePageTitle();
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 动态门户导航（固定 2 项（课程/微专业）+ 模板页（上限 6））
  const navItems = usePortalNavItems();
  
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
    // 合并两个数据源，去重
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

  // 查询微专业列表 - 当 selectedTenant 为 null 时查询所有学校
  const { data: microMajors = [], isLoading } = useQuery({
    queryKey: ["micro-major-list", selectedTenant, allOrganizations],
    queryFn: async () => {
      const headers = user ? getAuthHeaders(user) as Record<string, string> : undefined;
      
      // 如果选择了特定租户，直接查询该租户
      if (selectedTenant) {
        const result = await listMicroMajors({
          tenant: selectedTenant,
          fields: [
            "id",
            "name",
            "projectBackground",
            "knowledgeObjective",
            "abilityObjective",
            "qualityObjective",
            "projectFeatures",
            "learningCycle",
            "assessmentMethod",
            "tuitionFee",
            "coverUrl",
            "intro",
            "status",
            { responsibleTeacher: ["id", "name", "jobTitle"] },
            { consultantTeacher: ["id", "name", "jobTitle"] },
            { microMajorCourses: ["id", "credits", "semesterHours"] },
          ],
          sort: "sortOrder",
          page: { limit: 100, offset: 0 },
          headers,
        });

        if (!result.success) {
          throw new Error("获取微专业列表失败");
        }
        return extractArrayData(result);
      }
      
      // selectedTenant 为 null 时，查询所有学校的微专业
      const allResults: MicroMajorItem[] = [];
      for (const org of allOrganizations) {
        if (!org.schemaName) continue;
        try {
          const result = await listMicroMajors({
            tenant: org.schemaName,
            fields: [
              "id",
              "name",
              "projectBackground",
              "knowledgeObjective",
              "abilityObjective",
              "qualityObjective",
              "projectFeatures",
              "learningCycle",
              "assessmentMethod",
              "tuitionFee",
              "coverUrl",
              "intro",
              "status",
              { responsibleTeacher: ["id", "name", "jobTitle"] },
              { consultantTeacher: ["id", "name", "jobTitle"] },
              { microMajorCourses: ["id", "credits", "semesterHours"] },
            ],
            sort: "sortOrder",
            page: { limit: 100, offset: 0 },
            headers,
          });
          if (result.success) {
            const items = extractArrayData(result);
            // 标记每个微专业来自哪个学校
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
          m.responsibleTeacher?.name?.toLowerCase().includes(q) ||
          m.consultantTeacher?.name?.toLowerCase().includes(q)
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
  }, [searchQuery, microMajors, enrollmentStatusMap]);

  const maxPage = Math.max(1, Math.ceil(filteredMajors.length / MICRO_MAJORS_PER_PAGE));
  const currentPage = Math.min(page, maxPage);
  const paginatedMajors = filteredMajors.slice(
    (currentPage - 1) * MICRO_MAJORS_PER_PAGE,
    currentPage * MICRO_MAJORS_PER_PAGE
  );

  const getEnrollmentStatus = (majorId: string): string | null => {
    return enrollmentStatusMap.get(majorId) || null;
  };

  const handleTenantChange = (newTenant: string | null | undefined) => {
    const t = newTenant || null;
    setSelectedTenant(t);
    if (t) {
      const org = allOrganizations.find((o) => o.schemaName === t);
      const orgName = org?.name || t;
      setCurrentTenant({
        id: t,
        name: orgName,
        schemaName: t,
      });
      message.success(`已切换到 ${orgName}`);
    } else {
      message.success('已显示全部学校微专业');
    }
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
      <Header className="home-header">
        <div className="home-header__inner">
          <div className="home-header__left">
            <div className="home-brand" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
              <img src={branding.logo_light} alt={branding.app_name} className="home-brand__logo" />
              <div className="home-brand__title">{branding.app_title}</div>
            </div>
            {!isMobile && (
              <div className="cl-nav">
                {navItems.map((item) => (
                  <Button
                    key={item.key}
                    type="text"
                    className={`home-nav__button ${item.key === "/micro-majors" ? "is-active" : ""}`}
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

      <MobileFullMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        items={navItems}
        activeKey="/micro-majors"
        sectionTitle="导航"
      />

      <Content>
        {/* Hero Banner */}
        <section
          className="home-hero-section"
          style={{
            background: "linear-gradient(135deg, rgba(8,27,62,0.45) 0%, rgba(8,27,62,0.28) 100%), url('/assets/micro-major-hero.jpg') center/cover no-repeat",
            minHeight: isMobile ? 220 : undefined,
            padding: isMobile ? "32px 0" : undefined,
          }}
        >
          <div className="home-hero-section__inner">
            <div className="home-hero-section__content">
              <div className="home-hero-section__headline">
                <h1 className="home-hero-section__title" style={isMobile ? { fontSize: 24 } : undefined}>
                  微专业
                </h1>
              </div>
              <p className="home-hero-section__subtitle" style={isMobile ? { fontSize: 13 } : undefined}>
                微专业是面向产业人才需求，整合多学科知识与技能，
                打造「即学即用」的复合型人才培养方案
              </p>
              {!isMobile && (
                <div className="home-hero-section__cta">
                  <span className="home-hero-section__cta-item">🚀 急需紧缺型</span>
                  <span className="home-hero-section__cta-item">💼 应用技能型</span>
                  <span className="home-hero-section__cta-item">🔮 交叉复合型</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Talent Direction Cards */}
        {!isMobile && (
          <section className="micro-major-hero-panel">
            <div className="micro-major-hero-panel__inner">
              <div className="micro-major-hero-panel__grid">
                <div className="micro-major-hero-panel__item">
                  <div className="micro-major-hero-panel__item-header">
                    <div className="micro-major-hero-panel__item-icon" style={{ background: "linear-gradient(135deg, #FF6B6B 0%, #FF8E8E 100%)" }}>
                      🚀
                    </div>
                    <div className="micro-major-hero-panel__item-title">急需紧缺型</div>
                  </div>
                  <div className="micro-major-hero-panel__item-desc">
                    聚焦国家战略和产业急需领域，快速培养适应新兴产业需求的专门人才
                  </div>
                  <img 
                    src="/assets/urgent-needed_001.jpg"
                    alt="急需紧缺型"
                    className="micro-major-hero-panel__item-img"
                  />
                </div>
                <div className="micro-major-hero-panel__item">
                  <div className="micro-major-hero-panel__item-header">
                    <div className="micro-major-hero-panel__item-icon" style={{ background: "linear-gradient(135deg, #4ECDC4 0%, #7EDDD6 100%)" }}>
                      💼
                    </div>
                    <div className="micro-major-hero-panel__item-title">应用技能型</div>
                  </div>
                  <div className="micro-major-hero-panel__item-desc">
                    强化实践操作与职业素养，掌握「即学即用」的技能，缩短职场适应周期
                  </div>
                  <img 
                    src="/assets/applied-skill_001.jpg"
                    alt="应用技能型"
                    className="micro-major-hero-panel__item-img"
                  />
                </div>
                <div className="micro-major-hero-panel__item">
                  <div className="micro-major-hero-panel__item-header">
                    <div className="micro-major-hero-panel__item-icon" style={{ background: "linear-gradient(135deg, #9B59B6 0%, #BB8FCE 100%)" }}>
                      🔮
                    </div>
                    <div className="micro-major-hero-panel__item-title">交叉复合型</div>
                  </div>
                  <div className="micro-major-hero-panel__item-desc">
                    融合多学科知识，培养跨领域复合型人才，满足高端岗位需求
                  </div>
                  <img 
                    src="/assets/interdisciplinary_001.jpg"
                    alt="交叉复合型"
                    className="micro-major-hero-panel__item-img"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Tenant Filter + Search */}
        <section className="micro-major-filter">
          <div className="micro-major-filter__inner" style={isMobile ? { flexDirection: "column", gap: 10, padding: "12px 14px" } : undefined}>
            <div className="micro-major-filter__left" style={isMobile ? { width: "100%" } : undefined}>
              {isMobile ? (
                <Select
                  style={{ width: "100%" }}
                  placeholder="选择学校"
                  value={selectedTenant || undefined}
                  onChange={handleTenantChange}
                  allowClear
                  options={[
                    ...allOrganizations
                      .filter(o => o.schemaName)
                      .map(org => ({ label: org.name || org.schemaName!, value: org.schemaName! })),
                  ]}
                />
              ) : (
                <>
                  <span className="micro-major-filter__label">选择学校</span>
                  <div className="micro-major-filter__schools">
                    <button
                      type="button"
                      className={`micro-major-filter__school ${selectedTenant === null ? 'is-active' : ''}`}
                      onClick={() => handleTenantChange(null)}
                    >
                      全部学校
                    </button>
                    {allOrganizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        className={`micro-major-filter__school ${selectedTenant === org.schemaName ? 'is-active' : ''}`}
                        onClick={() => org.schemaName && handleTenantChange(org.schemaName)}
                      >
                        {org.name || org.schemaName || '未命名'}
                      </button>
                    ))}
                    {allOrganizations.length === 0 && (
                      <span style={{ color: 'var(--home-text-muted)' }}>暂无可用学校</span>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="micro-major-filter__stat" style={isMobile ? { width: "100%" } : undefined}>
              共 <strong>{filteredMajors.length}</strong> 个微专业
              {enrollmentStatusMap.size > 0 && (
                <Tag color="green" style={{ marginLeft: 8 }}>
                  <CheckCircleFilled /> 已关联 {enrollmentStatusMap.size} 个
                </Tag>
              )}
            </div>
            <div className="micro-major-filter__right" style={isMobile ? { width: "100%" } : undefined}>
              <Input
                placeholder={isMobile ? "搜索微专业" : "搜索微专业名称、教师或简介"}
                prefix={<SearchOutlined />}
                allowClear
                size={isMobile ? "middle" : "large"}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="micro-major-filter__search"
              />
            </div>
          </div>
        </section>

        {/* Course List */}
        <section className="cl-list-section">
          <div className="cl-list-section__inner" style={isMobile ? { padding: "0 14px 24px" } : undefined}>
            {isLoading ? (
              <div className={`portal-course-grid ${!isMobile ? "portal-course-grid--wide" : ""}`} style={isMobile ? { display: "grid", gridTemplateColumns: "1fr", gap: 12 } : undefined}>
                {Array.from({ length: isMobile ? 4 : 12 }).map((_, index) => (
                  <div key={index} className="portal-course-card portal-course-card--loading">
                    <Skeleton.Image active className="portal-course-card__skeleton-cover" />
                    <div style={{ padding: 16 }}>
                      <Skeleton active paragraph={{ rows: 2 }} title={{ width: "80%" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : paginatedMajors.length > 0 ? (
              <>
                <div className={`portal-course-grid ${!isMobile ? "portal-course-grid--wide" : ""}`} style={isMobile ? { display: "grid", gridTemplateColumns: "1fr", gap: 12 } : undefined}>
                  {paginatedMajors.map((major: MicroMajorItem) => (
                    <MicroMajorCard
                      key={`${major.id}_${(major as any)._tenant || selectedTenant || ""}`}
                      major={major}
                      enrollmentStatus={getEnrollmentStatus(major.id)}
                      isLoggedIn={!!user}
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
                description={searchQuery ? "未找到匹配的微专业" : "当前学校暂无微专业"}
              />
            )}
          </div>
        </section>
      </Content>

      <GlobalFooter />
    </Layout>
  );
}
