import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Typography,
  Row,
  Col,
  Spin,
  Alert,
  Button,
  Avatar,
  Empty,
} from "antd";
import {
  DownloadOutlined,
  BookOutlined,
  PaperClipOutlined,
  FolderOutlined,
  UserOutlined,
  FileTextOutlined,
  RightOutlined,
  TeamOutlined,
  FileOutlined,
  AimOutlined,
  PayCircleOutlined,
} from "@ant-design/icons";
import { listCourses, listBooks, listCourseInfos, listChapters, getUser, listCourseAssignments } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { themeColors as colors } from "@/styles/theme";
import {
  PageHead,
  ProtoCard,
  ProtoTag,
  ProtoTabs,
  ListItem,
} from "@/components/proto";
import FilePreview from "@/components/FilePreview";

const { Text, Paragraph } = Typography;

interface CourseOverviewProps {
  params?: {
    courseId?: string;
  };
}

export default function CourseOverview({ params }: CourseOverviewProps) {
  const { courseId: routeCourseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = params?.courseId || routeCourseId || searchParams.get("courseId");

  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const urlTenant = searchParams.get("tenant");
  const tenant = currentTenant?.schemaName || urlTenant || "";

  const storedCourseId = localStorage.getItem("selectedCourse") || "";
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    courseId || storedCourseId || null
  );
  const [activeSection, setActiveSection] = useState(() => {
    const urlSection = searchParams.get("section");
    return urlSection || "basic-info";
  });
  const [previewFile, setPreviewFile] = useState<{ url: string; name: string; type: string } | null>(null);

  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem("selectedCourse", selectedCourseId);
    }
  }, [selectedCourseId]);

  const { data: course, isLoading: courseLoading, error: courseError } = useQuery({
    queryKey: ["course", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      const result = await listCourses({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "imageUrl",
          "teacherId",
          "major",
          "semester",
          "bookId",
        ],
        filter: { id: { eq: selectedCourseId } },
        headers: getHeaders(user),
      });
      const data = extractArrayData(result);
      return data?.[0] || null;
    },
    enabled: !!tenant && !!selectedCourseId && !!user,
  });

  const { data: bookData } = useQuery({
    queryKey: ["book", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      const result = await listBooks({
        tenant,
        fields: ["id", "title", "publish", "coverImage", "attachment"],
        filter: { courseId: { eq: selectedCourseId } },
        headers: getHeaders(user),
      });
      const data = extractArrayData(result);
      return data?.[0] || null;
    },
    enabled: !!tenant && !!selectedCourseId && !!user,
  });

  const { data: courseInfoData } = useQuery({
    queryKey: ["courseInfo", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return null;
      const result = await listCourseInfos({
        tenant,
        fields: [
          "id",
          "courseHighlights",
          "courseIntroduction",
          "courseStructure",
          "background",
          "objectives",
          "target",
          "graduationRequirements",
        ],
        filter: { courseId: { eq: selectedCourseId } },
        headers: getHeaders(user),
      });
      const data = extractArrayData(result);
      return data?.[0] || null;
    },
    enabled: !!tenant && !!selectedCourseId && !!user,
  });

  const { data: chaptersData } = useQuery({
    queryKey: ["chapters-overview", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) return [];
      const result = await listChapters({
        tenant,
        fields: ["id", "title", "description", "sortOrder", "courseId", "path", "parentChapterId"],
        filter: { courseId: { eq: selectedCourseId } },
        sort: "+path",
        page: { limit: 500, offset: 0 },
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!selectedCourseId && !!user,
  });

  const chapters = chaptersData || [];

  // 获取主讲教师信息
  const { data: creatorData } = useQuery({
    queryKey: ["user", course?.teacherId, tenant],
    queryFn: async () => {
      const result = await getUser({
        tenant,
        fields: ["id", "name", "jobTitle", "avatarUrl", "bio", "major", "colledge", "email", "phone"],
        input: { id: course!.teacherId },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!course?.teacherId && !!tenant && !!user,
  });

  const courseCreator = creatorData?.success ? creatorData.data : null;

  // 获取课程关联教师列表
  const { data: assignmentsData } = useQuery({
    queryKey: ["course-assignments-overview", selectedCourseId, tenant],
    queryFn: async () => {
      const result = await listCourseAssignments({
        tenant,
        fields: [
          "id",
          "role",
          {
            teacher: [
              "id",
              "name",
              "jobTitle",
              "avatarUrl",
              "bio",
              "major",
              "colledge",
              "email",
            ],
          },
        ],
        filter: { courseId: { eq: selectedCourseId! } },
        sort: "role",
        page: { limit: 100, offset: 0 },
        headers: getHeaders(user),
      });
      return result;
    },
    enabled: !!tenant && !!selectedCourseId && !!user,
  });

  const roleLabelMap: Record<string, string> = {
    course_creator: "课程创建者",
    primary_teacher: "主讲教师",
    assistant_teacher: "助教",
    guest_teacher: "客座教师",
  };

  /** 原型风格的「字段块」：小标题 + 浅底值 */
  const fieldBoxStyle: CSSProperties = {
    padding: "12px 16px",
    background: "#f6f8fb",
    borderRadius: 10,
    fontSize: 15,
    color: "#202f47",
    lineHeight: 1.7,
    minHeight: 46,
    display: "flex",
    alignItems: "center",
  };

  const fieldLabelStyle: CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: colors.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 8,
    lineHeight: 1.5,
  };

  const allTeachers = useMemo(() => {
    const list: Array<{
      id: string;
      name: string | null;
      jobTitle: string | null;
      avatarUrl: string | null;
      bio: string | null;
      major: string | null;
      colledge: string | null;
      email: string | null;
      role: string;
    }> = [];

    if (courseCreator) {
      list.push({
        id: courseCreator.id,
        name: courseCreator.name || null,
        jobTitle: courseCreator.jobTitle || null,
        avatarUrl: courseCreator.avatarUrl || null,
        bio: courseCreator.bio || null,
        major: courseCreator.major || null,
        colledge: courseCreator.colledge || null,
        email: courseCreator.email || null,
        role: "course_creator",
      });
    }

    const assignments = (assignmentsData as any)?.success ? extractArrayData(assignmentsData as any) : [];
    for (const a of assignments) {
      const t = a.teacher;
      if (t && !list.find((x) => x.id === t.id)) {
        list.push({
          id: t.id,
          name: t.name || null,
          jobTitle: t.jobTitle || null,
          avatarUrl: t.avatarUrl || null,
          bio: t.bio || null,
          major: t.major || null,
          colledge: t.colledge || null,
          email: t.email || null,
          role: a.role,
        });
      }
    }

    return list;
  }, [courseCreator, assignmentsData]);

  // 将章节转换为树结构
  const chapterTree = useMemo(() => {
    if (!chaptersData || chaptersData.length === 0) return [];

    const map: Record<string, any> = {};
    const roots: any[] = [];

    // 先创建所有节点的map
    chaptersData.forEach((chapter: any) => {
      map[chapter.id] = {
        ...chapter,
        key: chapter.id,
        title: chapter.title,
        children: [],
      };
    });

    // 使用 parentChapterId 构建树结构
    chaptersData.forEach((chapter: any) => {
      if (chapter.parentChapterId && map[chapter.parentChapterId]) {
        map[chapter.parentChapterId].children.push(map[chapter.id]);
      } else {
        roots.push(map[chapter.id]);
      }
    });

    // 按path排序
    const sortByPath = (items: any[]): any[] => {
      return items.sort((a, b) => {
        if (a.path && b.path) return a.path.localeCompare(b.path);
        return 0;
      }).map(item => ({
        ...item,
        children: item.children.length ? sortByPath(item.children) : []
      }));
    };

    return sortByPath(roots);
  }, [chaptersData]);

  // 根据 path 生成章节编号
  const generateChapterNumber = (path: string | null): string => {
    if (!path) return "";
    // path格式: 一级章节为 "00{sort}1" (4位), 子章节为 "00{parentSort}00{childSort}" (8位+)
    const parts: string[] = [];
    for (let i = 0; i < path.length; i += 4) {
      const part = path.substring(i, i + 4);
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        parts.push(num.toString());
      }
    }
    if (path.length === 4) {
      // 一级章节，只取第一个数字
      return parts[0] || "";
    }
    return parts.join(".");
  };

  // 递归渲染嵌套章节
  const renderChapterCards = (nodes: any[], level: number = 0) => {
    const levelStyles = [
      { bg: "rgba(40, 89, 223, 0.08)", color: "#1d4fc4", accent: "#2859df" },
      { bg: "rgba(40, 89, 223, 0.055)", color: "#3f74e6", accent: "#4f82e8" },
      { bg: "rgba(40, 89, 223, 0.035)", color: "#5b8bef", accent: "#6f9cf2" },
      { bg: "rgba(40, 89, 223, 0.02)", color: "#7aa4f4", accent: "#8fb2f6" },
    ];
    const style = levelStyles[level % levelStyles.length];
    const leftPadding = level * 20;

    return nodes.map((node: any, index: number) => {
      const hasChildren = node.children && node.children.length > 0;
      const chapterNumber = level === 0 ? `${index + 1}` : generateChapterNumber(node.path);

      return (
        <div key={node.id} style={{ marginBottom: level === 0 ? 6 : 3 }}>
          <div style={{ paddingLeft: leftPadding }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: level === 0 ? "10px 16px" : "7px 14px",
                borderRadius: 10,
                backgroundColor: style.bg,
              }}
            >
              {hasChildren ? (
                <FolderOutlined style={{ color: style.color, fontSize: 15 }} />
              ) : (
                <BookOutlined style={{ color: style.color, fontSize: 15 }} />
              )}
              {chapterNumber && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#fff",
                    background: style.accent,
                    borderRadius: 6,
                    padding: "1px 8px",
                    lineHeight: "20px",
                  }}
                >
                  {chapterNumber}
                </span>
              )}
              <Text strong={level === 0} style={{ flex: 1, fontSize: level === 0 ? 14 : 13, color: "#202f47" }}>
                {node.title}
              </Text>
              {hasChildren && (
                <span style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>
                  {node.children.length} 节
                </span>
              )}
            </div>
          </div>
          {hasChildren && (
            <div style={{ marginTop: 2 }}>
              {renderChapterCards(node.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  };

  const book = bookData;
  const courseInfo = courseInfoData;

  const tabItems = [
    { id: "basic-info", label: "基本信息" },
    { id: "objectives", label: "教学目标" },
    { id: "structure", label: "课程结构" },
    { id: "graduation-requirements", label: "毕业要求" },
    { id: "chapters", label: "章节目录" },
    { id: "book-details", label: "教材信息" },
  ];

  const handleDownloadAttachment = (attachmentUrl: string, bookTitle: string) => {
    const link = document.createElement("a");
    link.href = attachmentUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    const urlParts = attachmentUrl.split("/");
    const filename = urlParts[urlParts.length - 1] || `${bookTitle}_attachment`;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderContent = () => {
    switch (activeSection) {
      case "basic-info":
        return (
          <div>
            <div className="pu-section-title">基本信息</div>

            <Row gutter={[16, 16]}>
              <Col xs={24} md={12}>
                <div>
                  <div style={fieldLabelStyle}>课程标题</div>
                  <div style={fieldBoxStyle}>
                    <Text strong style={{ fontSize: 15, color: "#202f47" }}>{course?.title}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div>
                  <div style={fieldLabelStyle}>专业</div>
                  <div style={fieldBoxStyle}>
                    <Text style={{ fontSize: 15, color: "#202f47" }}>{course?.major || "未指定"}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div>
                  <div style={fieldLabelStyle}>学期</div>
                  <div style={fieldBoxStyle}>
                    <Text style={{ fontSize: 15, color: "#202f47" }}>{course?.semester || "未指定"}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div>
                  <div style={fieldLabelStyle}>授课教师</div>
                  <div style={{ ...fieldBoxStyle, gap: 10 }}>
                    <Avatar
                      size={28}
                      src={courseCreator?.avatarUrl || undefined}
                      style={{ backgroundColor: courseCreator?.avatarUrl ? undefined : colors.primary, flexShrink: 0 }}
                    >
                      {courseCreator?.name?.charAt(0) || <UserOutlined />}
                    </Avatar>
                    <div>
                      <Text strong style={{ fontSize: 15, color: "#202f47" }}>{courseCreator?.name || "未指定"}</Text>
                      {courseCreator?.jobTitle && (
                        <Text style={{ marginLeft: 8, fontSize: 13, color: colors.textSecondary }}>{courseCreator.jobTitle}</Text>
                      )}
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={24}>
                <div>
                  <div style={fieldLabelStyle}>课程描述</div>
                  <div style={{ ...fieldBoxStyle, alignItems: "flex-start", display: "block" }}>
                    <Paragraph style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: "#424754" }}>
                      {course?.description || "暂无描述"}
                    </Paragraph>
                  </div>
                </div>
              </Col>
            </Row>

            {/* 教学团队 */}
            <div style={{ marginTop: 28 }}>
              <div className="pu-section-title" style={{ marginBottom: 12 }}>教学团队</div>
              <div style={{ padding: 16, background: "#f6f8fb", borderRadius: 10 }}>
                {allTeachers.length > 0 ? (
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                    {allTeachers.map((teacher) => (
                      <div key={teacher.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <Avatar size={32} src={teacher.avatarUrl || undefined} style={{ backgroundColor: colors.primary }}>
                          {teacher.name?.charAt(0) || <UserOutlined />}
                        </Avatar>
                        <div>
                          <div style={{ fontSize: 14 }}>
                            <Text strong style={{ color: "#202f47" }}>{teacher.name}</Text>
                            {teacher.jobTitle && <span style={{ fontSize: 12, color: colors.textSecondary }}> · {teacher.jobTitle}</span>}
                          </div>
                          <div style={{ fontSize: 11, color: colors.textSecondary }}>
                            {teacher.colledge || roleLabelMap[teacher.role] || ""}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Text style={{ color: colors.textSecondary }}>暂无教师信息</Text>
                )}
              </div>
            </div>

            {courseInfo?.background && (
              <div style={{ marginTop: 24 }}>
                <div style={fieldLabelStyle}>课程背景</div>
                <div style={{ ...fieldBoxStyle, alignItems: "flex-start", display: "block" }}>
                  <Paragraph style={{ margin: 0, fontSize: 15, lineHeight: 1.8, color: "#424754" }}>
                    {courseInfo.background}
                  </Paragraph>
                </div>
              </div>
            )}
          </div>
        );

      case "objectives":
        return (
          <div>
            <div className="pu-section-title">教学目标</div>
            <div className="pu-divider" style={{ marginTop: 0 }} />
            {courseInfo?.objectives ? (
              <div style={{ padding: 18, background: "#f6f8fb", borderRadius: 10 }}>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "#424754" }}>
                  {courseInfo.objectives}
                </Paragraph>
              </div>
            ) : (
              <Empty description="暂无教学目标信息" />
            )}
            {courseInfo?.target && (
              <>
                <div className="pu-section-title" style={{ marginTop: 24 }}>目标学员</div>
                <div style={{ padding: 18, background: "#f6f8fb", borderRadius: 10 }}>
                  <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "#424754" }}>
                    {courseInfo.target}
                  </Paragraph>
                </div>
              </>
            )}
          </div>
        );

      case "structure":
        return (
          <div>
            <div className="pu-section-title">课程结构</div>
            {courseInfo?.courseStructure ? (
              <div style={{ padding: 18, background: "#f6f8fb", borderRadius: 10, marginBottom: 16 }}>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "#424754" }}>
                  {courseInfo.courseStructure}
                </Paragraph>
              </div>
            ) : (
              <Empty description="暂无课程结构信息" />
            )}
            {courseInfo?.courseHighlights && (
              <>
                <div className="pu-section-title" style={{ marginTop: 24 }}>课程亮点</div>
                <div style={{ padding: 18, background: "#f0f8f4", borderRadius: 10 }}>
                  <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "#2f5a4c" }}>
                    {courseInfo.courseHighlights}
                  </Paragraph>
                </div>
              </>
            )}
          </div>
        );

      case "chapters":
        return (
          <div>
            <div className="pu-card-title" style={{ marginBottom: 18 }}>
              <div>
                <div className="pu-section-title" style={{ marginBottom: 4 }}>教材章节</div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>共 {chapters.length} 个章节</div>
              </div>
              <ProtoTag tone="blue">章节结构</ProtoTag>
            </div>
            {chapterTree && chapterTree.length > 0 ? (
              <div style={{ maxHeight: 620, overflowY: "auto", paddingRight: 8 }}>
                {renderChapterCards(chapterTree)}
              </div>
            ) : (
              <Empty description="暂无章节信息" />
            )}
          </div>
        );

      case "book-details":
        return (
          <div>
            <div className="pu-section-title">教材信息</div>
            <div className="pu-divider" style={{ marginTop: 0, marginBottom: 20 }} />
            {book ? (
              <Row gutter={[24, 16]}>
                <Col xs={24} md={16}>
                  <div style={{ marginBottom: 16 }}>
                    <div style={fieldLabelStyle}>教材名称</div>
                    <div style={fieldBoxStyle}>
                      <Text strong style={{ fontSize: 15, color: "#202f47" }}>{book.title}</Text>
                    </div>
                  </div>
                  <div>
                    <div style={fieldLabelStyle}>出版社</div>
                    <div style={fieldBoxStyle}>
                      <Text style={{ fontSize: 15, color: "#202f47" }}>{book.publish || "未指定"}</Text>
                    </div>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <img
                      src={book.coverImage || "/book-placeholder.svg"}
                      alt={book.title}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 280,
                        objectFit: "cover",
                        borderRadius: 12,
                        border: `1px solid ${colors.border}`,
                      }}
                    />
                    {book?.attachment && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <Button
                          block
                          icon={<PaperClipOutlined />}
                          onClick={() => {
                            const filename = book.attachment.split("/").pop() || "attachment";
                            setPreviewFile({ url: book.attachment, name: filename, type: filename.split(".").pop() || "" });
                          }}
                          style={{ borderRadius: 8, height: 38 }}
                        >
                          预览
                        </Button>
                        <Button
                          block
                          type="primary"
                          icon={<DownloadOutlined />}
                          style={{ borderRadius: 8, height: 38 }}
                          onClick={() => handleDownloadAttachment(book.attachment, book.title)}
                        >
                          下载
                        </Button>
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            ) : (
              <Empty description="本课程暂未指定教材" />
            )}
          </div>
        );

      case "graduation-requirements":
        return (
          <div>
            <div className="pu-section-title">毕业要求</div>
            <div className="pu-divider" style={{ marginTop: 0 }} />
            {courseInfo?.graduationRequirements ? (
              <div style={{ padding: 18, background: "#f6f8fb", borderRadius: 10 }}>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "#424754" }}>
                  {courseInfo.graduationRequirements}
                </Paragraph>
              </div>
            ) : (
              <Empty description="暂未设置毕业要求" />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Alert type="warning" message="未选择组织" description="请选择一个组织以查看课程概览。" />
      </div>
    );
  }

  const courseTagLine = [course?.major, course?.semester, courseCreator?.name]
    .filter(Boolean)
    .join(" · ");

  const supportItems = [
    {
      key: "teacher",
      title: "教师团队",
      desc: allTeachers.length > 0 ? `${allTeachers.length} 位授课教师` : "查看授课教师信息",
      icon: <TeamOutlined />,
      onClick: () => navigate(`/dashboard/teacher${selectedCourseId ? `?courseId=${selectedCourseId}` : ""}`),
    },
    {
      key: "resource",
      title: "教学资源",
      desc: "课程讲义、案例与练习",
      icon: <FileOutlined />,
      onClick: () => navigate(`/dashboard/resource${selectedCourseId ? `?courseId=${selectedCourseId}` : ""}`),
    },
    {
      key: "goal",
      title: "认知目标",
      desc: "从理解到应用与创造",
      icon: <AimOutlined />,
      onClick: () => navigate(`/dashboard/knowledge-cognitive-goals${selectedCourseId ? `?courseId=${selectedCourseId}` : ""}`),
    },
  ];

  return (
    <div className="pu-page">
      <PageHead
        title={course?.title || "课程概述"}
        description={courseTagLine || "查看课程的基本信息、教学目标与章节结构。"}
        actions={
          <Button
            type="primary"
            icon={<RightOutlined />}
            onClick={() =>
              navigate(`/dashboard/course-video${selectedCourseId ? `?courseId=${selectedCourseId}` : ""}`)
            }
          >
            开始学习
          </Button>
        }
      />

      {courseLoading ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          <Spin size="large" />
        </div>
      ) : courseError ? (
        <Alert type="error" message={`加载课程信息失败: ${(courseError as Error).message}`} />
      ) : !course ? (
        <Alert type="warning" message="未找到课程信息" description="请先在课程列表中选择一门课程。" />
      ) : (
        <>
          {/* 课程概述 */}
          <div className="pu-welcome">
            <div style={{ minWidth: 0 }}>
              <h2>{courseInfo?.courseHighlights || "从观察，到表达，再到创造。"}</h2>
              <p>{course.description || "建立扎实的专业基础，在理解与实践中形成自己的知识体系。"}</p>
              <div className="pu-tags">
                <ProtoTag tone="blue">正在开课</ProtoTag>
                {course.major && <ProtoTag tone="gray">{course.major}</ProtoTag>}
                {course.semester && <ProtoTag tone="gray">{course.semester}</ProtoTag>}
                {courseCreator?.name && <ProtoTag tone="gray">主讲教师 · {courseCreator.name}</ProtoTag>}
              </div>
            </div>
          </div>

          {/* 指标概览 */}
          <div className="pu-grid pu-grid--stats">
            <div className="pu-stat">
              <span className="pu-stat__icon"><BookOutlined /></span>
              <div className="pu-stat__label">章节数量</div>
              <div className="pu-stat__num">{chapters.length}<small>章</small></div>
              <div className="pu-stat__desc">课程的章节结构</div>
            </div>
            <div className="pu-stat">
              <span className="pu-stat__icon"><TeamOutlined /></span>
              <div className="pu-stat__label">授课教师</div>
              <div className="pu-stat__num">{allTeachers.length}<small>位</small></div>
              <div className="pu-stat__desc">参与本课程教学</div>
            </div>
            <div className="pu-stat">
              <span className="pu-stat__icon"><FileTextOutlined /></span>
              <div className="pu-stat__label">教材</div>
              <div className="pu-stat__num" style={{ fontSize: 22, lineHeight: "48px" }}>
                {book ? "已配置" : "未配置"}
              </div>
              <div className="pu-stat__desc">{book?.title || "本课程暂未指定教材"}</div>
            </div>
            <div className="pu-stat">
              <span className="pu-stat__icon"><PayCircleOutlined /></span>
              <div className="pu-stat__label">毕业要求</div>
              <div className="pu-stat__num" style={{ fontSize: 22, lineHeight: "48px" }}>
                {courseInfo?.graduationRequirements ? "已设置" : "待完善"}
              </div>
              <div className="pu-stat__desc">课程的能力达成标准</div>
            </div>
          </div>

          {/* 标签页 + 内容 */}
          <ProtoTabs
            items={tabItems}
            active={activeSection}
            onChange={(id) => setActiveSection(id)}
          />

          <div className="pu-grid pu-grid--two">
            <ProtoCard>{renderContent()}</ProtoCard>

            <ProtoCard title="学习支持">
              {supportItems.map((it, i) => (
                <ListItem
                  key={it.key}
                  index={i + 1}
                  title={it.title}
                  description={it.desc}
                  extra={
                    <Button size="small" onClick={it.onClick} style={{ borderRadius: 8 }}>
                      查看
                    </Button>
                  }
                />
              ))}
              <div className="pu-note" style={{ marginTop: 16 }}>
                先完成基础章节，再通过项目练习建立知识之间的联系。
              </div>
            </ProtoCard>
          </div>

          {courseInfo?.courseIntroduction && (
            <div style={{ marginTop: 20 }}>
              <ProtoCard title="课程介绍">
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.95, color: "#62738a" }}>
                  {courseInfo.courseIntroduction}
                </Paragraph>
              </ProtoCard>
            </div>
          )}
        </>
      )}

      {/* File Preview Modal */}
      {previewFile && (
        <FilePreview
          open={!!previewFile}
          onClose={() => setPreviewFile(null)}
          file={previewFile}
          onDownload={() => handleDownloadAttachment(previewFile.url, previewFile.name)}
        />
      )}
    </div>
  );
}
