import * as React from "react";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Typography,
  Spin,
  Alert,
  Button,
  Space,
  Drawer,
  Empty,
  Row,
  Col,
  Grid,
} from "antd";
import {
  BulbOutlined,
  BookOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  RightOutlined,
  StarOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import {
  myCourses,
  listKnowledges,
  getCourseByGuest,
} from "@/lib/ash_rpc";
import { themeColors as colors } from "@/styles/theme";
import { PageHead, ProtoTag, StatGrid } from "@/components/proto";

const { Text, Paragraph } = Typography;

/** A knowledge point shown in the list */
interface KnowledgeItem {
  id: string;
  name: string;
  description: string | null;
  importanceLevel: string;
  knowledgeType: string;
}

/** A course with its randomly selected knowledge items */
interface CourseSection {
  courseId: string;
  courseTitle: string;
  totalKnowledgeCount: number;
  items: KnowledgeItem[];
}

// ──────────── helpers ────────────

/** Simple string hash → deterministic seed */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

/** Seeded pseudo-random [0,1) — mulberry32 */
function seededRand(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates shuffle + take, using a seeded RNG for deterministic results */
function shuffleTakeSeeded<T>(arr: T[], n: number, seed: string): T[] {
  const a = [...arr];
  const rand = seededRand(hashStr(seed));
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

// ──────────── component ────────────

export default function LearningRecommendations() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { courseId: urlCourseId } = useParams();
  const currentTenant = getCurrentTenant();

  // detail drawer
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // 当前课程上下文：URL 路径参数 > 查询参数 > localStorage
  const storedCourseId = localStorage.getItem("selectedCourse");
  const searchCourseId = searchParams.get("courseId");
  const courseId = urlCourseId || searchCourseId || storedCourseId || null;
  const placeholderTitle = courseId ? `课程 ${courseId.slice(0, 8)}` : "学习推荐";

  // ── 1. 自动绑定「当前课程」：
  //    - URL 未带 courseId，且 localStorage 中没有 selectedCourse
  //    - 用户只有一门已选课程时，写入 localStorage 并跳转到带 courseId 的 URL
  //    - 多门课程时（无 courseId）显示提示，避免出现“未选课”误判
  //    这样登录后首次访问也能看到当前课程的学习推荐。
  const {
    data: enrollmentsResult,
    isLoading: loadingEnrollments,
  } = useQuery({
    queryKey: ["student-enrollments", user?.id, !!courseId],
    queryFn: async () => {
      if (!user?.id || !currentTenant?.schemaName || courseId) return { success: true, data: [] };
      const result = await myCourses({
        tenant: currentTenant.schemaName,
        fields: ["id", "title"],
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!user?.id && !!currentTenant?.schemaName && !courseId,
  });

  useEffect(() => {
    // 已有 courseId 上下文，无需自动绑定
    if (courseId) return;
    // 未登录或没有当前租户
    if (!user?.id || !currentTenant?.schemaName) return;
    // 还在加载选课列表
    if (loadingEnrollments) return;
    // 加载失败时不跳转
    if (!enrollmentsResult?.success || !enrollmentsResult.data) return;

    const enrollments = Array.isArray(enrollmentsResult.data)
      ? (enrollmentsResult.data as any[])
      : ((enrollmentsResult.data as any).results || (enrollmentsResult.data as any).data || []);

    // 仅取带 id 的有效课程记录（myCourses 直接返回 Course 列表）
    const enrolledCourses = (enrollments as any[]).filter((c: any) => c && c.id);

    // 只有一门课时，自动绑定为当前课程并跳转
    if (enrolledCourses.length === 1) {
      const onlyCourse = enrolledCourses[0];
      localStorage.setItem("selectedCourse", onlyCourse.id);
      navigate(`/dashboard/learning-recommendations/${onlyCourse.id}`, { replace: true });
    }
  }, [
    courseId,
    user?.id,
    currentTenant?.schemaName,
    loadingEnrollments,
    enrollmentsResult,
    navigate,
  ]);

  // ── 2. fetch course meta (标题）以在顶部显示课程名 ──
  const { data: courseMetaData } = useQuery({
    queryKey: ["learning-recommendations-course-meta", courseId, currentTenant?.schemaName],
    queryFn: async () => {
      if (!courseId || !currentTenant?.schemaName) return null;
      // 使用 getCourseByGuest（与 front.tsx 一致）：按 courseId 直接查课程信息，
      // 不依赖学生是否选修该课程
      const result = await getCourseByGuest({
        tenant: currentTenant.schemaName,
        fields: ["id", "title"],
        input: { courseId },
        headers: user ? getHeaders(user) : undefined,
      });
      if (result.success && result.data) {
        const c = Array.isArray(result.data) ? (result.data as any[])[0] : (result.data as any);
        if (c?.id && c.title) {
          return { id: c.id, title: c.title } as { id: string; title: string };
        }
      }
      // 未拿到课程标题时用 ID 占位
      return { id: courseId, title: `课程 ${courseId.slice(0, 8)}` };
    },
    enabled: !!courseId && !!currentTenant?.schemaName,
  });

  // 删除无用中转 effect（改为直接使用 courseMetaData）

  // ── 3. fetch knowledge resources for current course only ──
  const {
    data: knowledgeSection,
    isLoading: loadingKnowledge,
  } = useQuery({
    queryKey: ["learning-recommendations-knowledge", user?.id, courseId],
    queryFn: async (): Promise<CourseSection | null> => {
      if (!currentTenant?.schemaName || !courseId) return null;

      const res = await listKnowledges({
        tenant: currentTenant.schemaName,
        fields: ["id", "name", "description", "importanceLevel", "knowledgeType"],
        filter: {
          courseId: { eq: courseId },
          knowledgeType: { eq: "knowledge_cell" },
        },
        headers: getHeaders(user),
      });

      const raw = extractArrayData(res);
      const items: KnowledgeItem[] = (raw as any[]).map((r: any) => ({
        id: r.id,
        name: r.name || r.Name || "",
        description: r.description || r.Description || null,
        importanceLevel: r.importanceLevel || r.ImportanceLevel || "medium",
        knowledgeType: r.knowledgeType || r.KnowledgeType || "knowledge_cell",
      }));

      const totalCount = items.length;
      const seed = `${user?.id}-${courseId}`;
      const selected = shuffleTakeSeeded(items, 10, seed);

      return {
        courseId: courseId,
        courseTitle: courseMetaData?.title || placeholderTitle,
        totalKnowledgeCount: totalCount,
        items: selected,
      };
    },
    enabled: !!courseId && !!currentTenant?.schemaName,
  });

  // 从图谱返回时恢复知识卡片抽屉
  const focusKnowledgeId = searchParams.get("focusKnowledgeId");
  useEffect(() => {
    if (focusKnowledgeId && knowledgeSection) {
      const found = knowledgeSection.items.find((item) => item.id === focusKnowledgeId);
      if (found) {
        setSelectedItem(found);
        setDetailOpen(true);
      }
    }
  }, [focusKnowledgeId, knowledgeSection]);

  // ── stats（单课程）──
  const stats = useMemo(() => {
    if (!knowledgeSection) return { totalRecs: 0, totalKnowledge: 0 };
    return {
      totalRecs: knowledgeSection.items.length,
      totalKnowledge: knowledgeSection.totalKnowledgeCount,
    };
  }, [knowledgeSection]);

  // ── detail drawer ──
  const handleOpenDetail = useCallback((item: KnowledgeItem) => {
    setSelectedItem(item);
    setDetailOpen(true);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedItem(null);
  }, []);

  // ── loading / error ──
  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <Spin size="large" tip="加载中…" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Alert message="请先登录" type="warning" showIcon />
      </div>
    );
  }

  // 未选定当前课程：等待选课列表加载（以便只有一门课的时候自动绑定）
  if (!courseId && loadingEnrollments) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <Spin size="large" tip="加载中…" />
      </div>
    );
  }

  // 未选定当前课程且未在自动绑定中：提示用户从其他地方进入
  if (!courseId) {
    return (
      <div style={{ padding: 48, textAlign: "center" }}>
        <Alert
          message="未选择当前课程"
          description="请从课程门面页或侧边栏选择一个课程后查看其学习推荐。"
          type="info"
          showIcon
        />
      </div>
    );
  }

  if (loadingKnowledge) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <Spin size="large" tip="正在加载知识点…" />
      </div>
    );
  }

  // ── render ──
  return (
    <div className="pu-page">
      <PageHead
        title="学习推荐"
        description="根据当前知识掌握情况，为下一步学习找到方向。"
      />

      <div>
        {/* ========== 本次学习建议 ========== */}
        {knowledgeSection && knowledgeSection.items.length > 0 && (
          <div className="pu-welcome">
            <div style={{ minWidth: 0 }}>
              <div className="pu-eyebrow">下一步学习</div>
              <h2>从《{knowledgeSection.items[0].name}》开始下一步</h2>
              <p>先回顾基础概念，再通过案例与练习检验理解。</p>
              <Button
                type="primary"
                onClick={() => handleOpenDetail(knowledgeSection.items[0])}
                style={{ height: 40, fontWeight: 600 }}
              >
                开始推荐学习 →
              </Button>
            </div>
            <ProtoTag tone="blue">个性化学习路径</ProtoTag>
          </div>
        )}

        {/* ========== 顶部统计数据 ========== */}
        <StatGrid
          columns={isMobile ? 2 : 3}
          items={[
            { label: "学习推荐", value: stats.totalRecs, unit: "条", desc: courseMetaData?.title ? `课程 · ${courseMetaData.title}` : "当前课程推荐", icon: <BulbOutlined /> },
            { label: "推荐知识点", value: stats.totalRecs, unit: "个", desc: "建议优先学习", icon: <StarOutlined /> },
            { label: "知识点总数", value: stats.totalKnowledge, unit: "个", desc: "课程知识体系规模", icon: <BookOutlined /> },
          ]}
        />

        {/* ========== 当前课程推荐列表 ========== */}
        <div className="pu-card">
          <div className="pu-card-title">
            <div>
              <h2 style={{ fontSize: 20 }}>{courseMetaData?.title || placeholderTitle}</h2>
              {knowledgeSection && (
                <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
                  推荐 {knowledgeSection.items.length} / 共 {knowledgeSection.totalKnowledgeCount} 个知识点
                </div>
              )}
            </div>
            <span style={{ fontSize: 12, color: "#64748b" }}>按推荐优先级排序</span>
          </div>

          {!knowledgeSection || knowledgeSection.items.length === 0 ? (
            <Empty description={loadingKnowledge ? "正在加载…" : "该课程暂无学习推荐"} />
          ) : (
            <Row gutter={isMobile ? [12, 12] : [20, 20]}>
              {knowledgeSection.items.map((item, idx) => (
                <Col xs={24} sm={12} lg={8} key={item.id} style={{ width: isMobile ? "100%" : undefined }}>
                  <div
                    onClick={() => handleOpenDetail(item)}
                    style={{
                      padding: isMobile ? "16px" : "20px 22px",
                      borderRadius: 14,
                      background: "#fff",
                      border: "1px solid var(--pu-line)",
                      cursor: "pointer",
                      transition: "transform 0.2s ease, box-shadow 0.2s ease",
                      height: "100%",
                      display: "flex",
                      flexDirection: "column",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-3px)";
                      e.currentTarget.style.boxShadow = "0 12px 30px rgba(21,50,84,0.08)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  >
                    <div className="pu-eyebrow" style={{ marginBottom: 10 }}>
                      第 {idx + 1} 步
                    </div>
                    <h3 style={{ fontSize: 17, fontWeight: 650, lineHeight: 1.5, color: "#202f47", marginBottom: 8 }}>
                      {item.name}
                    </h3>
                    <Paragraph
                      ellipsis={{ rows: 2 }}
                      style={{ fontSize: 13, marginBottom: 14, lineHeight: 1.8, color: "#64748b", minHeight: 46 }}
                    >
                      {item.description || "结合课程知识体系与该知识点的关联强度推荐。"}
                    </Paragraph>
                    <div style={{ marginTop: "auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <ProtoTag tone={item.importanceLevel === "high" ? "red" : "blue"}>
                        {item.importanceLevel === "high" ? "重要" : "中优先级"}
                      </ProtoTag>
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        查看详情 <RightOutlined style={{ fontSize: 10 }} />
                      </span>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          )}
        </div>
      </div>

      {/* ========== 知识点详情抽屉 ========== */}
      <Drawer
        title={selectedItem?.name || "知识点详情"}
        placement="right"
        width={520}
        open={detailOpen}
        onClose={handleCloseDetail}
      >
        {selectedItem && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <Space direction="vertical" size={8} style={{ width: "100%" }}>


                {selectedItem.description && (
                  <>
                    <Text strong style={{ fontSize: 14 }}>知识点描述</Text>
                    <Paragraph style={{ fontSize: 14, color: colors.textSecondary, marginBottom: 0 }}>
                      {selectedItem.description}
                    </Paragraph>
                  </>
                )}
              </Space>
            </div>

            <Alert
              message="点击下方按钮开始学习该知识点"
              type="info"
              showIcon
              style={{ marginBottom: 20 }}
            />

            <Space direction="vertical" style={{ width: "100%" }} size={12}>
              <Button
                block
                size="large"
                icon={<ApartmentOutlined />}
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set("knowledgeId", selectedItem.id);
                  if (courseId) params.set("courseId", courseId);
                  if (currentTenant?.id) params.set("tenant", currentTenant.id);
                  params.set("returnUrl", `/dashboard/learning-recommendations/${courseId || ""}?focusKnowledgeId=${selectedItem.id}`);
                  navigate(`/dashboard/graph?${params.toString()}`);
                }}
                style={{ borderRadius: 8, height: 44 }}
              >
                查看知识图谱
              </Button>
              <Button
                block
                size="large"
                icon={<FileTextOutlined />}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (courseId) params.set("courseId", courseId);
                  if (currentTenant?.id) params.set("tenant", currentTenant.id);
                  navigate(`/dashboard/overview${params.toString() ? `?${params.toString()}` : ""}`);
                }}
                style={{ borderRadius: 8, height: 44 }}
              >
                课程概览
              </Button>
              <Button
                block
                size="large"
                icon={<VideoCameraOutlined />}
                onClick={() => {
                  const params = new URLSearchParams();
                  if (courseId) params.set("courseId", courseId);
                  if (currentTenant?.id) params.set("tenant", currentTenant.id);
                  navigate(`/dashboard/course-video${params.toString() ? `?${params.toString()}` : ""}`);
                }}
                style={{ borderRadius: 8, height: 44 }}
              >
                课程视频
              </Button>
            </Space>
          </div>
        )}
      </Drawer>
    </div>
  );
}
