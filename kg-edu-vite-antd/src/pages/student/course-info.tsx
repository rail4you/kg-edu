import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Typography,
  Spin,
  Alert,
  Avatar,
  Row,
  Col,
  Empty,
  Button,
  Grid,
} from "antd";
import {
  BookOutlined,
  InfoCircleOutlined,
  TrophyOutlined,
  AimOutlined,
  BulbOutlined,
  TeamOutlined,
  AppstoreOutlined,
  ArrowLeftOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import { listCourses, listCourseInfos, listBooks } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import FilePreview from "@/components/FilePreview";
import { PageHead, ProtoCard, ProtoTag } from "@/components/proto";

const { Text, Paragraph } = Typography;

interface SidebarSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  description: string;
}

interface Book {
  id: string;
  title: string;
  publish: boolean;
  coverImage: string | null;
  author?: string;
  publisher?: string;
  attachment?: string;
}

export default function CourseInfoPage() {
  const { useBreakpoint } = Grid;
  const { user, loading: authLoading } = useAuth();
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const { courseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const storedCourseId = localStorage.getItem("selectedCourse") || "";
  const searchCourseId = searchParams.get("courseId") || "";
  // 优先级：URL 路径参数 > 查询参数（来自 front 页面链接） > localStorage
  const selectedCourseId = courseId || searchCourseId || storedCourseId;

  const getInitialSection = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("section") || "overview";
  };

  const [activeSection, setActiveSection] = useState<string>(getInitialSection);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);

  const {
    data: courseData,
    isLoading: courseLoading,
    error: courseError,
  } = useQuery({
    queryKey: ["course", selectedCourseId, tenant],
    queryFn: async () => {
      const result = await listCourses({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "imageUrl",
          "major",
          "semester",
          "teacherId",
        ],
        filter: { id: { eq: selectedCourseId } },
        page: { limit: 1, offset: 0 },
        headers: getHeaders(user),
      });

      const data = extractArrayData(result);
      return data?.[0] || null;
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const { data: courseInfoData, isLoading: courseInfoLoading } = useQuery({
    queryKey: ["courseInfo", selectedCourseId, tenant],
    queryFn: async () => {
      const result = await listCourseInfos({
        tenant,
        fields: [
          "id",
          "courseId",
          "background",
          "objectives",
          "target",
          "courseHighlights",
          "courseIntroduction",
          "courseStructure",
        ],
        filter: { courseId: { eq: selectedCourseId } },
        headers: getHeaders(user),
      });

      const data = extractArrayData(result);
      return data?.[0] || null;
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const { data: booksData, isLoading: booksLoading } = useQuery({
    queryKey: ["books", selectedCourseId, tenant],
    queryFn: async () => {
      const result = await listBooks({
        tenant,
        fields: ["id", "title", "publish", "coverImage", "author", "publisher", "attachment"],
        filter: { courseId: { eq: selectedCourseId } },
        sort: "-insertedAt",
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!selectedCourseId && !!tenant && !!user,
  });

  const course = courseData;
  const courseInfo = courseInfoData;
  const books: Book[] = booksData || [];

  const loading = courseLoading || courseInfoLoading || booksLoading;

  const sidebarSections: SidebarSection[] = useMemo(() => [
    {
      id: "overview",
      title: "课程概览",
      icon: <InfoCircleOutlined />,
      description: "课程基本信息",
    },
    {
      id: "background",
      title: "课程背景",
      icon: <TrophyOutlined />,
      description: "课程背景介绍",
    },
    {
      id: "objectives",
      title: "教学目标",
      icon: <AimOutlined />,
      description: "学习目标与要求",
    },
    {
      id: "target",
      title: "面向对象",
      icon: <TeamOutlined />,
      description: "适合的学习人群",
    },
    {
      id: "highlights",
      title: "课程亮点",
      icon: <BulbOutlined />,
      description: "课程特色与亮点",
    },
    {
      id: "introduction",
      title: "课程介绍",
      icon: <AppstoreOutlined />,
      description: "详细课程介绍",
    },
    {
      id: "structure",
      title: "课程结构",
      icon: <AppstoreOutlined />,
      description: "课程内容结构",
    },
    {
      id: "books",
      title: "教材资源",
      icon: <BookOutlined />,
      description: `相关教材 (${books.length}本)`,
    },
  ], [books.length]);

  const availableSections = useMemo(() => {
    return sidebarSections.filter((section) => {
      if (!courseInfo) {
        return section.id === "overview" || section.id === "books";
      }

      switch (section.id) {
        case "background":
          return !!courseInfo.background;
        case "objectives":
          return !!courseInfo.objectives;
        case "target":
          return !!courseInfo.target;
        case "highlights":
          return !!courseInfo.courseHighlights;
        case "introduction":
          return !!courseInfo.courseIntroduction;
        case "structure":
          return !!courseInfo.courseStructure;
        default:
          return true;
      }
    });
  }, [sidebarSections, courseInfo]);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    navigate(`/student/course-info/${selectedCourseId}?section=${sectionId}`, { replace: true });
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 400,
          }}
        >
          <Spin size="large" />
        </div>
      );
    }

    if (!course) {
      return (
        <Alert
          type="error"
          message={`加载课程信息失败: ${(courseError as Error)?.message || "未知错误"}`}
        />
      );
    }

    switch (activeSection) {
      case "overview":
        return (
          <div>
            {course.imageUrl && (
              <img
                src={course.imageUrl}
                alt={course.title}
                style={{
                  width: "100%",
                  maxHeight: 300,
                  objectFit: "cover",
                  borderRadius: 12,
                  marginBottom: 18,
                }}
              />
            )}

            <div className="pu-tags" style={{ marginBottom: 18 }}>
              {course.major && <ProtoTag tone="blue">{course.major}</ProtoTag>}
              {course.semester && <ProtoTag tone="amber">{course.semester}</ProtoTag>}
            </div>

            {course.description && (
              <div style={{ marginBottom: 20 }}>
                <h2 className="pu-section-title">课程简介</h2>
                <Paragraph style={{ lineHeight: 1.9, fontSize: 14 }}>
                  {course.description}
                </Paragraph>
              </div>
            )}

            <div className="pu-metrics" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
              <div>
                <small>教材资源</small>
                <strong>{books.length}</strong>
              </div>
              {courseInfo && (
                <div>
                  <small>课程信息</small>
                  <strong style={{ fontSize: 16 }}>背景 · 目标 · 结构</strong>
                </div>
              )}
            </div>
          </div>
        );

      case "background":
        return (
          <div>
            <h2 className="pu-section-title">课程背景</h2>
            <Paragraph style={{ lineHeight: 1.9, fontSize: 14 }}>
              {courseInfo?.background || "暂无背景信息"}
            </Paragraph>
          </div>
        );

      case "objectives":
        return (
          <div>
            <h2 className="pu-section-title">教学目标</h2>
            <Paragraph style={{ lineHeight: 1.9, fontSize: 14 }}>
              {courseInfo?.objectives || "暂无目标信息"}
            </Paragraph>
          </div>
        );

      case "target":
        return (
          <div>
            <h2 className="pu-section-title">面向对象</h2>
            <Paragraph style={{ lineHeight: 1.9, fontSize: 14 }}>
              {courseInfo?.target || "暂无对象信息"}
            </Paragraph>
          </div>
        );

      case "highlights":
        return (
          <div>
            <h2 className="pu-section-title">课程亮点</h2>
            <Paragraph style={{ lineHeight: 1.9, fontSize: 14 }}>
              {courseInfo?.courseHighlights || "暂无亮点信息"}
            </Paragraph>
          </div>
        );

      case "introduction":
        return (
          <div>
            <h2 className="pu-section-title">课程介绍</h2>
            <Paragraph style={{ lineHeight: 1.9, fontSize: 14 }}>
              {courseInfo?.courseIntroduction || "暂无介绍信息"}
            </Paragraph>
          </div>
        );

      case "structure":
        return (
          <div>
            <h2 className="pu-section-title">课程结构</h2>
            <Paragraph style={{ lineHeight: 1.9, fontSize: 14 }}>
              {courseInfo?.courseStructure || "暂无结构信息"}
            </Paragraph>
          </div>
        );

      case "books":
        return (
          <div>
            <h2 className="pu-section-title">教材资源</h2>

            {books.length === 0 ? (
              <Empty description="该课程暂无相关教材" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {books.map((book) => (
                  <div
                    key={book.id}
                    style={{
                      display: "flex",
                      gap: 16,
                      alignItems: "center",
                      padding: 16,
                      border: "1px solid var(--pu-line)",
                      borderRadius: 12,
                    }}
                  >
                    <Avatar
                      src={book.coverImage}
                      shape="square"
                      size={64}
                      style={{ borderRadius: 8, flexShrink: 0 }}
                      icon={<BookOutlined />}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <Text strong style={{ display: "block", marginBottom: 4 }}>
                        {book.title}
                      </Text>
                      {(book.author || book.publisher) && (
                        <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
                          {book.author}{book.author && book.publisher ? " / " : ""}{book.publisher}
                        </Text>
                      )}
                      <ProtoTag tone={book.publish ? "green" : "gray"}>
                        {book.publish ? "已发布" : "草稿"}
                      </ProtoTag>
                    </div>

                    {book.attachment && (
                      <Button
                        type="primary"
                        size="small"
                        icon={<PaperClipOutlined />}
                        onClick={() => {
                          const fileName = book.attachment.split("/").pop() || book.title;
                          const ext = fileName.split(".").pop()?.toLowerCase() || "";
                          setPreviewFile({
                            url: book.attachment!,
                            name: fileName,
                            type: ext,
                          });
                        }}
                      >
                        预览
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
          gap: 16,
        }}
      >
        <Spin size="large" />
        <Text>正在检查认证状态...</Text>
      </div>
    );
  }

  if (!user) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <h3 style={{ color: "var(--pu-red)" }}>用户未登录</h3>
        <Text>请登录以访问课程信息。</Text>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ padding: 24, maxWidth: 1200, margin: "0 auto" }}>
        <Alert
          message="未选择组织"
          description="请选择一个组织以查看课程信息。"
          type="warning"
          showIcon
        />
      </div>
    );
  }

  if (!selectedCourseId) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <h3 style={{ color: "var(--pu-red)" }}>课程ID缺失</h3>
        <Text>无法确定要查看的课程。</Text>
      </div>
    );
  }

  return (
    <div className="pu-page">
      <PageHead
        title={course?.title || "课程信息"}
        description="课程背景、教学目标、课程结构与教材资源"
        actions={
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            返回
          </Button>
        }
      />

      {isMobile ? (
        <div>
          <div className="pu-tabs">
            {availableSections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`pu-tabs__item${activeSection === section.id ? " is-active" : ""}`}
                onClick={() => handleSectionClick(section.id)}
              >
                {section.title}
              </button>
            ))}
          </div>
          <ProtoCard>{renderContent()}</ProtoCard>
        </div>
      ) : (
        <Row gutter={24}>
          <Col xs={24} md={8} lg={6}>
            <ProtoCard style={{ position: "sticky", top: 16, padding: 14 }}>
              {availableSections.map((section) => {
                const active = activeSection === section.id;
                return (
                  <div
                    key={section.id}
                    onClick={() => handleSectionClick(section.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "11px 12px",
                      borderRadius: 10,
                      cursor: "pointer",
                      marginBottom: 4,
                      background: active ? "var(--pu-blue-soft)" : "transparent",
                      transition: "background 0.15s",
                    }}
                  >
                    <span style={{ color: active ? "var(--pu-blue)" : "var(--pu-muted)", display: "inline-flex" }}>
                      {section.icon}
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: active ? "var(--pu-blue)" : "var(--pu-ink)" }}>
                        {section.title}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--pu-muted)" }}>
                        {section.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </ProtoCard>
          </Col>
          <Col xs={24} md={16} lg={18}>
            <ProtoCard>{renderContent()}</ProtoCard>
          </Col>
        </Row>
      )}

      <FilePreview
        open={!!previewFile}
        onClose={() => setPreviewFile(null)}
        file={previewFile || { url: "", name: "", type: "" }}
        onDownload={() => {
          if (previewFile) {
            const a = document.createElement("a");
            a.href = previewFile.url;
            a.download = previewFile.name;
            a.click();
          }
        }}
      />
    </div>
  );
}
