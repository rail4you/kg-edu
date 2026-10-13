import { useMemo, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Spin, Layout } from "antd";
import {
  TeamOutlined,
  FileTextOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import {
  getCourseByGuest,
  listCourses,
  listCourseInfos,
  listCourseAssignments,
  getUser,
  listChapters,
  listBooks,
  myCourses,
} from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { usePageTitle } from "@/hooks/use-page-title";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import PortalHeader from "@/components/layout/portal-header";
import GlobalFooter from "@/components/layout/global-footer";
import FilePreview from "@/components/FilePreview";
import "@/styles/home-portal-theme.css";
import "@/styles/portal-editorial.css";
import "@/styles/course-detail.css";

const { Content } = Layout;

const TABS = ["基本信息", "教学目标", "课程结构", "毕业要求", "章节目录", "教材信息"] as const;
type TabKey = (typeof TABS)[number];

const FALLBACK_INTRO =
  "系统讲授本课程的核心知识与实践方法，帮助学习者建立完整的知识体系与应用能力。";

// 解析课程结构文本为「标题 + 说明」条目（与 /dashboard/overview 一致）
function parseStructureItems(text?: string | null): { title: string; desc: string }[] {
  const raw = (text || "").trim();
  if (!raw) return [];

  const matches = [...raw.matchAll(/(\d+)\s*[.、)．)]\s*(.*?)(?=(?:\d+\s*[.、)．)])|$)/gs)];
  let segments = matches.map((m) => m[2]).filter((s) => s && s.trim());
  if (segments.length === 0) {
    segments = raw.split(/[\n；;]/).map((s) => s.trim()).filter(Boolean);
  }

  return segments
    .map((seg) => {
      const body = seg.replace(/[；;，,。\s]+$/, "").trim();
      if (!body) return null;
      const paren = body.match(/^(.*?)[（(](.*?)[)）]\s*$/s);
      if (paren) return { title: paren[1].trim(), desc: paren[2].trim() };
      return { title: body, desc: "" };
    })
    .filter((it): it is { title: string; desc: string } => !!it && !!it.title);
}

export default function CourseDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  usePageTitle();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();

  const urlCourseId = searchParams.get("courseId") || localStorage.getItem("selectedCourse") || "";
  const urlTenant = searchParams.get("tenant");
  // 与 /dashboard/overview 保持一致的组织解析顺序：先当前机构，再 URL 参数
  const tenantToUse = currentTenant?.schemaName || urlTenant || "";
  const [activeTab, setActiveTab] = useState<TabKey>("基本信息");
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const { data: courseData, isLoading: courseLoading } = useQuery({
    queryKey: ["cd-course", urlCourseId, tenantToUse, !!user],
    queryFn: async () => {
      // 已登录：与课程概览页一致，走 list_courses
      if (user) {
        const result = await listCourses({
          tenant: tenantToUse,
          fields: ["id", "title", "description", "imageUrl", "teacherId", "major", "semester", "bookId", "semesterHours", "credits"],
          filter: { id: { eq: urlCourseId! } },
          headers: getHeaders(user),
        });
        return extractArrayData(result)[0] ?? null;
      }
      // 游客预览：走 get_course_by_guest
      const result = await getCourseByGuest({
        tenant: tenantToUse,
        fields: ["id", "title", "description", "imageUrl", "major", "semester", "semesterHours", "credits", "teacherId"],
        input: { courseId: urlCourseId! },
      });
      return result.success ? result.data : null;
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });

  const { data: courseInfoData } = useQuery({
    queryKey: ["cd-course-info", urlCourseId, tenantToUse],
    queryFn: async () => {
      // 与课程概览页一致，走 list_course_infos
      const result = await listCourseInfos({
        tenant: tenantToUse,
        fields: ["id", "courseId", "background", "objectives", "target", "courseHighlights", "courseIntroduction", "courseStructure", "graduationRequirements"],
        filter: { courseId: { eq: urlCourseId! } },
        headers: user ? getHeaders(user) : undefined,
      });
      return extractArrayData(result)[0] ?? null;
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });

  const { data: chapters = [] } = useQuery({
    queryKey: ["cd-chapters", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await listChapters({
        tenant: tenantToUse,
        fields: ["id", "title", "description", "sortOrder", "courseId", "path", "parentChapterId"],
        filter: { courseId: { eq: urlCourseId! } },
        sort: "+path",
        page: { limit: 500, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });

  const { data: books = [] } = useQuery({
    queryKey: ["cd-books", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await listBooks({
        tenant: tenantToUse,
        fields: ["id", "title", "publish", "coverImage", "attachment", "author", "publisher", "courseId"],
        filter: { courseId: { eq: urlCourseId! } },
        sort: "-insertedAt",
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["cd-assignments", urlCourseId, tenantToUse],
    queryFn: async () => {
      const result = await listCourseAssignments({
        tenant: tenantToUse,
        fields: ["id", "role", { teacher: ["id", "name", "jobTitle", "avatarUrl", "bio", "major", "colledge", "email"] }],
        filter: { courseId: { eq: urlCourseId! } },
        page: { limit: 100, offset: 0 },
        headers: user ? getHeaders(user) : undefined,
      });
      return result.success ? extractArrayData(result) : [];
    },
    enabled: !!urlCourseId && !!tenantToUse,
  });

  const { data: primaryTeacher } = useQuery({
    queryKey: ["cd-primary-teacher", (courseData as any)?.teacherId, tenantToUse],
    queryFn: async () => {
      const teacherId = (courseData as any)?.teacherId;
      if (!teacherId) return null;
      const result = await getUser({
        tenant: tenantToUse,
        input: { id: teacherId },
        fields: ["id", "name", "jobTitle", "avatarUrl", "bio", "major", "colledge", "email"],
      });
      return result.success ? result.data : null;
    },
    enabled: !!(courseData as any)?.teacherId && !!tenantToUse,
  });

  // 是否已选课：教师端分配课程后，学生 myCourses 中会出现该课程
  const { data: enrollment, isLoading: enrollmentLoading } = useQuery({
    queryKey: ["cd-enrollment", tenantToUse, urlCourseId, user?.id],
    queryFn: async () => {
      if (!urlCourseId || !user) return { enrolled: false };
      const result = await myCourses({
        tenant: tenantToUse,
        fields: ["id"],
        headers: getHeaders(user),
      });
      if (result.success) {
        const list = extractArrayData(result) as { id?: string }[];
        return { enrolled: list.some((c) => c?.id === urlCourseId) };
      }
      return { enrolled: false };
    },
    enabled: !!tenantToUse && !!urlCourseId && !!user,
  });

  const isEnrolled = enrollment?.enrolled === true;
  const enrollmentChecking = !!user && enrollmentLoading;

  const courseTitle = (courseData as any)?.title || "课程详情";
  const intro = (courseInfoData as any)?.courseIntroduction || (courseData as any)?.description || FALLBACK_INTRO;
  const semester = (courseData as any)?.semester;
  const semesterHours = (courseData as any)?.semesterHours;
  const credits = (courseData as any)?.credits;
  const major = (courseData as any)?.major;
  const school = (primaryTeacher as any)?.colledge || currentTenant?.name || "平台开课单位";

  const teacherNames = useMemo(() => {
    const names = ((assignments as any[]) || [])
      .map((a) => a?.teacher?.name)
      .filter(Boolean) as string[];
    if (primaryTeacher && (primaryTeacher as any).name && !names.includes((primaryTeacher as any).name)) {
      names.unshift((primaryTeacher as any).name);
    }
    return Array.from(new Set(names));
  }, [assignments, primaryTeacher]);

  // 章节树：按 parentChapterId 构建嵌套结构，并按 path 排序（与课程概览页一致）
  const chapterTree = useMemo(() => {
    const list = (chapters as any[]) || [];
    if (list.length === 0) return [];
    const map: Record<string, any> = {};
    const roots: any[] = [];
    list.forEach((c) => {
      map[c.id] = { ...c, children: [] };
    });
    list.forEach((c) => {
      if (c.parentChapterId && map[c.parentChapterId]) {
        map[c.parentChapterId].children.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    });
    const sortByPath = (items: any[]): any[] =>
      items
        .sort((a, b) => (a.path && b.path ? a.path.localeCompare(b.path) : 0))
        .map((item) => ({ ...item, children: item.children.length ? sortByPath(item.children) : [] }));
    return sortByPath(roots);
  }, [chapters]);

  // 根据 path 生成章节编号（一级/子级）
  const chapterNumber = (path: string | null): string => {
    if (!path) return "";
    const parts: string[] = [];
    for (let i = 0; i < path.length; i += 4) {
      const num = parseInt(path.substring(i, i + 4), 10);
      if (!isNaN(num)) parts.push(num.toString());
    }
    return path.length === 4 ? parts[0] || "" : parts.join(".");
  };

  const renderChapterNodes = (nodes: any[], level = 0): ReactNode =>
    nodes.map((node, index) => {
      const hasChildren = node.children && node.children.length > 0;
      const number = level === 0 ? `${index + 1}` : chapterNumber(node.path);
      if (level === 0) {
        return (
          <div key={node.id}>
            <div className="item">
              <span className="item-number">{number}</span>
              <div style={{ flex: 1 }}>
                <h3>{node.title}</h3>
                <p>
                  {node.description ||
                    (hasChildren ? `${node.children.length} 个学习单元` : "视频 / 讲义 / 练习")}
                </p>
              </div>
            </div>
            {hasChildren ? (
              <div style={{ paddingLeft: 46, paddingBottom: 4 }}>{renderChapterNodes(node.children, level + 1)}</div>
            ) : null}
          </div>
        );
      }
      return (
        <div key={node.id} className="item" style={{ padding: "9px 0", borderBottom: "1px dashed #eef2f7" }}>
          <span className="item-number" style={{ width: 28, height: 28, fontSize: 12, background: "#f6f8fb", color: "#62738a" }}>
            {number}
          </span>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 14 }}>{node.title}</h3>
            {node.description ? <p>{node.description}</p> : null}
          </div>
        </div>
      );
    });

  const linkedQuery = new URLSearchParams({
    courseId: urlCourseId || "",
    tenant: tenantToUse,
  }).toString();

  const goLearning = () => navigate(`/dashboard/overview?${linkedQuery}`);
  const goLogin = () => {
    const redirect = `${window.location.pathname}${window.location.search}`;
    navigate(`/login?redirect=${encodeURIComponent(redirect)}`);
  };
  const scrollToInfo = () => {
    document.getElementById("course-information")?.scrollIntoView({ behavior: "smooth" });
  };

  const tags = [
    semester && { key: "semester", label: semester },
    semesterHours && { key: "hours", label: `${semesterHours} 学时` },
    credits && { key: "credits", label: `${credits} 学分` },
    { key: "level", label: "本科" },
  ].filter(Boolean) as { key: string; label: string }[];

  const textBlock = (value: unknown, fallback: string) => {
    const content = typeof value === "string" ? value.trim() : "";
    return content || fallback;
  };

  const renderStartButton = () => {
    if (enrollmentChecking) {
      return (
        <button className="primary" disabled>
          加载中…
        </button>
      );
    }
    if (!user) {
      return (
        <button className="primary" onClick={goLogin}>
          登录后学习 →
        </button>
      );
    }
    if (isEnrolled) {
      return (
        <button className="primary" onClick={goLearning}>
          开始学习 →
        </button>
      );
    }
    return (
      <button className="primary" disabled title="该课程尚未选课，仅可查看课程信息">
        暂未选课 · 仅可查看课程信息
      </button>
    );
  };

  const mainTabContent = () => {
    switch (activeTab) {
      case "章节目录":
        return chapterTree.length > 0 ? (
          renderChapterNodes(chapterTree)
        ) : (
          <p className="course-long-copy">暂无章节内容。</p>
        );
      case "课程结构": {
        const structure = (courseInfoData as any)?.courseStructure;
        const highlights = (courseInfoData as any)?.courseHighlights;
        const structureItems = parseStructureItems(structure);
        return (
          <>
            <h2>{activeTab}</h2>
            {structureItems.length > 0 ? (
              structureItems.map((it, i) => (
                <div className="item" key={i}>
                  <span className="item-number">{String(i + 1).padStart(2, "0")}</span>
                  <div style={{ flex: 1 }}>
                    <h3>{it.title}</h3>
                    {it.desc ? <p>{it.desc}</p> : null}
                  </div>
                  <button type="button" onClick={() => setActiveTab("章节目录")}>
                    查看章节
                  </button>
                </div>
              ))
            ) : structure ? (
              <p className="course-long-copy">{structure}</p>
            ) : (
              <p className="course-long-copy">暂无课程结构信息。</p>
            )}
            {highlights ? (
              <>
                <h3 style={{ marginTop: 24 }}>课程亮点</h3>
                <p className="course-long-copy">{highlights}</p>
              </>
            ) : null}
          </>
        );
      }
      case "教材信息": {
        const list = (books as any[]) || [];
        return (
          <>
            <h2>{activeTab}</h2>
            {list.length === 0 ? (
              <p className="course-long-copy">暂无对应教材信息。</p>
            ) : (
              list.map((b) => (
                <div className="item" key={b.id}>
                  {b.coverImage ? (
                    <img
                      src={b.coverImage}
                      alt={b.title}
                      style={{ width: 56, height: 76, objectFit: "cover", borderRadius: 6, flexShrink: 0 }}
                    />
                  ) : null}
                  <div style={{ flex: 1 }}>
                    <h3>{b.title}</h3>
                    <p>{[b.author, b.publisher].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  {b.attachment ? (
                    <a
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        setPreviewFile({
                          url: b.attachment,
                          name: b.attachment.split("/").pop()?.split("?")[0] || `${b.title}.pdf`,
                          type: "",
                        })
                      }
                    >
                      预览教材
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </>
        );
      }
      case "教学目标": {
        const objectives = (courseInfoData as any)?.objectives;
        const target = (courseInfoData as any)?.target;
        return (
          <>
            <h2>{activeTab}</h2>
            {objectives ? (
              <p className="course-long-copy">{objectives}</p>
            ) : (
              <p className="course-long-copy">暂无教学目标信息。</p>
            )}
            {target ? (
              <>
                <h3 style={{ marginTop: 24 }}>目标学员</h3>
                <p className="course-long-copy">{target}</p>
              </>
            ) : null}
          </>
        );
      }
      case "毕业要求": {
        const graduation = (courseInfoData as any)?.graduationRequirements;
        return (
          <>
            <h2>{activeTab}</h2>
            {graduation ? (
              <p className="course-long-copy">{graduation}</p>
            ) : (
              <p className="course-long-copy">暂未设置毕业要求。</p>
            )}
          </>
        );
      }
      case "基本信息":
      default: {
        const background = (courseInfoData as any)?.background;
        return (
          <>
            <h2>{activeTab}</h2>
            <p className="course-long-copy">
              {textBlock(background || (courseInfoData as any)?.courseIntroduction, FALLBACK_INTRO)}
            </p>
            <h3 style={{ marginTop: 24 }}>课程安排</h3>
            <div className="metric-list">
              <div>
                <small>课程学时</small>
                <strong>{semesterHours ?? "-"}</strong>
              </div>
              <div>
                <small>章节目录</small>
                <strong>{(chapters as any[]).length || "-"}</strong>
              </div>
              <div>
                <small>课程学分</small>
                <strong>{credits ?? "-"}</strong>
              </div>
            </div>
            <div className="note">
              先完成基础章节，再通过项目练习建立知识之间的联系。
            </div>
          </>
        );
      }
    }
  };

  const supports = [
    {
      title: "教师团队",
      desc: teacherNames.length ? teacherNames.join(" · ") : "教学团队",
      icon: <TeamOutlined />,
    },
    { title: "教学资源", desc: "课程讲义、案例与练习", icon: <FileTextOutlined /> },
    { title: "认知目标", desc: "从理解到应用与创造", icon: <TrophyOutlined /> },
  ];

  if (courseLoading) {
    return (
      <Layout className="home-page cl-page" style={{ overflowX: "hidden" }}>
        <PortalHeader activeKey="/courses" sectionTitle="导航" />
        <Content>
          <div className="course-detail-page">
            <div className="cd-container" style={{ textAlign: "center", paddingTop: 120 }}>
              <Spin />
            </div>
          </div>
        </Content>
        <GlobalFooter />
      </Layout>
    );
  }

  return (
    <Layout className="home-page cl-page" style={{ overflowX: "hidden", background: "#fff" }}>
      <PortalHeader activeKey="/courses" sectionTitle="导航" />
      <Content style={{ background: "#fff" }}>
        <div className="course-detail-page">
          <div className="cd-container">
            <div className="course-classic">
          <nav className="major-breadcrumb" aria-label="面包屑">
            <a onClick={() => navigate("/")} style={{ cursor: "pointer" }}>首页</a>
            <span>/</span>
            <a onClick={() => navigate("/courses")} style={{ cursor: "pointer" }}>全部课程</a>
            <span>/</span>
            <span>课程详情</span>
          </nav>

          <section className="course-public-hero course-reference-hero">
            <div>
              <div className="home-mini">探索 · 学习 · 创造</div>
              <h1>{courseTitle}</h1>
              <p>{intro}</p>
              <div className="course-provider">
                <div>
                  <small>开课学校 / 单位</small>
                  <strong>
                    {school}
                    {major ? <span>{major}</span> : null}
                  </strong>
                </div>
              </div>
              <div className="course-public-tags">
                {tags.map((t) => (
                  <span key={t.key}>{t.label}</span>
                ))}
              </div>
            </div>

            <div className="course-start-card">
              <small>循序渐进，学以致用</small>
              <h2>开启这门课程</h2>
              <p>课程讲解 · 配套资料 · 实践练习</p>
              {renderStartButton()}
              <a onClick={scrollToInfo}>先看课程目录 ↓</a>
              {!user ? <div className="course-start-hint">登录并选课后即可开始学习</div> : null}
              {user && !isEnrolled && !enrollmentChecking ? (
                <div className="course-start-hint">该课程未选课，仅可浏览课程信息</div>
              ) : null}
            </div>
          </section>

          <section id="course-information">
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={t === activeTab ? "active" : ""}
                  onClick={() => setActiveTab(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="grid two">
              <div className="card">{mainTabContent()}</div>
              <div className="card">
                <h2>学习支持</h2>
                {supports.map((s) => (
                  <div className="item" key={s.title}>
                    <div style={{ flex: 1 }}>
                      <h3>{s.title}</h3>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <p className="course-demo">
            开课单位及课程内容以平台公布为准。
          </p>
            </div>
          </div>
        </div>
      </Content>
      <GlobalFooter />

      <FilePreview
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile || { url: "", name: "", type: "" }}
        onDownload={() => {
          if (!previewFile) return;
          const a = document.createElement("a");
          a.href = previewFile.url;
          a.download = previewFile.name;
          a.click();
        }}
      />
    </Layout>
  );
}
