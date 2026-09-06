import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  Typography,
  Card,
  List,
  Divider,
  Spin,
  Alert,
  Breadcrumb,
  Avatar,
  Tag,
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
  RightOutlined,
  PaperClipOutlined,
} from "@ant-design/icons";
import { listCourses, listCourseInfos, listBooks } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { themeColors as colors } from "@/styles/theme";
import FilePreview from "@/components/FilePreview";

const { Title, Text, Paragraph } = Typography;

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
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              {course.title}
            </Title>

            {course.imageUrl && (
              <img
                src={course.imageUrl}
                alt={course.title}
                style={{
                  width: "100%",
                  maxHeight: 300,
                  objectFit: "cover",
                  borderRadius: 8,
                  marginBottom: 16,
                }}
              />
            )}

            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {course.major && <Tag color="blue">{course.major}</Tag>}
              {course.semester && <Tag color="purple">{course.semester}</Tag>}
            </div>

            {course.description && (
              <div style={{ marginBottom: 16 }}>
                <Title level={5}>课程简介</Title>
                <Paragraph style={{ lineHeight: 1.8 }}>{course.description}</Paragraph>
              </div>
            )}

            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Title level={5}>
                  <BookOutlined style={{ marginRight: 8 }} />
                  教材资源
                </Title>
                <div>
                  <Text strong style={{ fontSize: 24, color: colors.primary }}>
                    {books.length}
                  </Text>
                  <br />
                  <Text type="secondary">本相关教材</Text>
                </div>
              </Col>
              {courseInfo && (
                <Col xs={24} md={12}>
                  <Title level={5}>
                    <InfoCircleOutlined style={{ marginRight: 8 }} />
                    课程信息
                  </Title>
                  <Text type="secondary">完整的背景、目标、结构等信息</Text>
                </Col>
              )}
            </Row>
          </div>
        );

      case "background":
        return (
          <div>
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              课程背景
            </Title>
            <Paragraph style={{ lineHeight: 1.8, fontSize: 16 }}>
              {courseInfo?.background || "暂无背景信息"}
            </Paragraph>
          </div>
        );

      case "objectives":
        return (
          <div>
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              教学目标
            </Title>
            <Paragraph style={{ lineHeight: 1.8, fontSize: 16 }}>
              {courseInfo?.objectives || "暂无目标信息"}
            </Paragraph>
          </div>
        );

      case "target":
        return (
          <div>
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              面向对象
            </Title>
            <Paragraph style={{ lineHeight: 1.8, fontSize: 16 }}>
              {courseInfo?.target || "暂无对象信息"}
            </Paragraph>
          </div>
        );

      case "highlights":
        return (
          <div>
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              课程亮点
            </Title>
            <Paragraph style={{ lineHeight: 1.8, fontSize: 16 }}>
              {courseInfo?.courseHighlights || "暂无亮点信息"}
            </Paragraph>
          </div>
        );

      case "introduction":
        return (
          <div>
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              课程介绍
            </Title>
            <Paragraph style={{ lineHeight: 1.8, fontSize: 16 }}>
              {courseInfo?.courseIntroduction || "暂无介绍信息"}
            </Paragraph>
          </div>
        );

      case "structure":
        return (
          <div>
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              课程结构
            </Title>
            <Paragraph style={{ lineHeight: 1.8, fontSize: 16 }}>
              {courseInfo?.courseStructure || "暂无结构信息"}
            </Paragraph>
          </div>
        );

      case "books":
        return (
          <div>
            <Title level={3} style={{ color: colors.primary, marginBottom: 16 }}>
              教材资源
            </Title>

            {books.length === 0 ? (
              <Empty description="该课程暂无相关教材" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {books.map((book) => (
                  <Card
                    key={book.id}
                    size="small"
                    hoverable
                    style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}
                  >
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <Avatar
                        src={book.coverImage}
                        shape="square"
                        size={64}
                        style={{ borderRadius: 4 }}
                        icon={<BookOutlined />}
                      />

                      <div style={{ flex: 1 }}>
                        <Text strong style={{ display: "block", marginBottom: 4 }}>
                          {book.title}
                        </Text>
                        {(book.author || book.publisher) && (
                          <Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 4 }}>
                            {book.author}{book.author && book.publisher ? " / " : ""}{book.publisher}
                          </Text>
                        )}
                        <Tag color={book.publish ? "success" : "default"}>
                          {book.publish ? "已发布" : "草稿"}
                        </Tag>
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
                  </Card>
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
        <Title level={3} type="danger">
          用户未登录
        </Title>
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
        <Title level={3} type="danger">
          课程ID缺失
        </Title>
        <Text>无法确定要查看的课程。</Text>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "12px 0 0" : 16 }}>
      {!isMobile && (
        <Breadcrumb
          separator={<RightOutlined />}
          items={[
            { title: <a href="/student/dashboard">仪表板</a> },
            { title: <a href="/student/dashboard">我的课程</a> },
            { title: <Text>{course?.title || "课程信息"}</Text> },
          ]}
          style={{ marginBottom: 16 }}
        />
      )}

      <div
        style={{
          background: "#fff",
          borderRadius: isMobile ? 16 : 12,
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          padding: isMobile ? 16 : 24,
        }}
      >
        {isMobile ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 12, color: "#757780", fontWeight: 700 }}>课程导航</Text>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                WebkitOverflowScrolling: "touch",
              }}
            >
              {availableSections.map((section) => {
                const active = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionClick(section.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "10px 14px",
                      borderRadius: 9999,
                      border: active ? "none" : "1px solid #E8EAED",
                      background: active ? colors.primary : "#F8F9FA",
                      color: active ? "#fff" : "#1f2937",
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                      boxShadow: active ? "0 10px 24px rgba(37, 115, 230, 0.18)" : "none",
                    }}
                  >
                    <span>{section.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{section.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <Row gutter={24}>
            <Col xs={24} md={6}>
              <div
                style={{
                  borderRight: "1px solid #f0f0f0",
                  paddingRight: 20,
                }}
              >
                <Title level={5} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid #f0f0f0" }}>
                  课程导航
                </Title>

                <List
                  dataSource={availableSections}
                  renderItem={(section, index) => (
                    <div key={section.id}>
                      <List.Item
                        style={{
                          padding: "8px 12px",
                          cursor: "pointer",
                          borderRadius: 6,
                          marginBottom: 4,
                          backgroundColor: activeSection === section.id ? colors.primary : "transparent",
                          color: activeSection === section.id ? "#fff" : "inherit",
                          transition: "all 0.2s",
                        }}
                        onClick={() => handleSectionClick(section.id)}
                      >
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%" }}>
                          <span style={{ marginTop: 2 }}>{section.icon}</span>
                          <div>
                            <Text
                              strong
                              style={{
                                display: "block",
                                color: activeSection === section.id ? "#fff" : "inherit",
                              }}
                            >
                              {section.title}
                            </Text>
                            <Text
                              type={activeSection === section.id ? undefined : "secondary"}
                              style={{
                                fontSize: 12,
                                color: activeSection === section.id ? "rgba(255,255,255,0.8)" : undefined,
                              }}
                            >
                              {section.description}
                            </Text>
                          </div>
                        </div>
                      </List.Item>
                      {index < availableSections.length - 1 && <Divider style={{ margin: "8px 0" }} />}
                    </div>
                  )}
                />
              </div>
            </Col>

            <Col xs={24} md={18}>{renderContent()}</Col>
          </Row>
        )}

        {isMobile && (
          <div>{renderContent()}</div>
        )}
      </div>

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
