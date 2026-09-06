import { useState, useEffect, useMemo, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import {
  Typography,
  Row,
  Col,
  Spin,
  Alert,
  Button,
  Avatar,
  Empty,
  Space,
  Modal,
  Tag,
} from "antd";
import {
  DownloadOutlined,
  BookOutlined,
  PaperClipOutlined,
  FolderOutlined,
  UserOutlined,
  ApartmentOutlined,
  TrophyOutlined,
  FileTextOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { listCourses, listBooks, listCourseInfos, listChapters, getUser, listCourseAssignments } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { themeColors as colors } from "@/styles/theme";
import "@/styles/student-overview.css";
import FilePreview from "@/components/FilePreview";

const { Title, Text, Paragraph } = Typography;

interface CourseOverviewProps {
  params?: {
    courseId?: string;
  };
}

export default function CourseOverview({ params }: CourseOverviewProps) {
  const { courseId: routeCourseId } = useParams();
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

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses", tenant],
    queryFn: async () => {
      const result = await listCourses({
        tenant,
        fields: ["id", "title", "description", "major", "semester"],
        sort: "title",
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

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

  const infoLabelStyle: CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: colors.primary,
    letterSpacing: 0.4,
    marginBottom: 6,
    lineHeight: 1.5,
  };

  const infoValueBoxStyle: CSSProperties = {
    padding: "10px 14px",
    background: "rgba(37, 115, 230, 0.04)",
    borderRadius: 8,
  };

  const infoValueTextStyle: CSSProperties = {
    fontSize: 15,
    color: "#191c1d",
    lineHeight: 1.6,
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
      { bg: "rgba(37, 115, 230, 0.06)", color: colors.primary, borderBg: colors.primary },
      { bg: "rgba(82, 196, 26, 0.06)", color: "#389e0d", borderBg: "#52c41a" },
      { bg: "rgba(250, 173, 20, 0.06)", color: "#d48806", borderBg: "#faad14" },
      { bg: "rgba(245, 34, 45, 0.06)", color: "#cf1322", borderBg: "#f5222d" },
      { bg: "rgba(114, 46, 209, 0.06)", color: "#531dab", borderBg: "#722ed1" },
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
                borderLeft: `3px solid ${style.borderBg}`,
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
                    background: style.borderBg,
                    borderRadius: 6,
                    padding: "1px 8px",
                    lineHeight: "20px",
                  }}
                >
                  {chapterNumber}
                </span>
              )}
              <Text strong={level === 0} style={{ flex: 1, fontSize: level === 0 ? 14 : 13, color: "#191c1d" }}>
                {node.title}
              </Text>
              {hasChildren && (
                <span style={{ fontSize: 11, color: "#757780", fontWeight: 500 }}>
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
    if (courseLoading) {
      return (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
          <Spin size="large" />
        </div>
      );
    }

    if (courseError) {
      return <Alert type="error" message={`加载课程信息失败: ${(courseError as Error).message}`} />;
    }

    if (!course) {
      return <Alert type="warning" message="未找到课程信息" />;
    }

    switch (activeSection) {
      case "basic-info":
        return (
          <div style={{ borderRadius: 12, background: "#fff", padding: 28, boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d" }}>基本信息</div>
            </div>

            <Row gutter={[16, 12]}>
              <Col xs={24} md={12}>
                <div>
                  <div style={infoLabelStyle}>
                    课程标题
                  </div>
                  <div style={infoValueBoxStyle}>
                    <Text strong style={infoValueTextStyle}>{course.title}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div>
                  <div style={infoLabelStyle}>
                    专业
                  </div>
                  <div style={infoValueBoxStyle}>
                    <Text style={infoValueTextStyle}>{course.major || "未指定"}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div>
                  <div style={infoLabelStyle}>
                    学期
                  </div>
                  <div style={{ ...infoValueBoxStyle, minHeight: 48, display: "flex", alignItems: "center" }}>
                    <Text style={infoValueTextStyle}>{course.semester || "未指定"}</Text>
                  </div>
                </div>
              </Col>
              <Col xs={24} md={12}>
                <div>
                  <div style={infoLabelStyle}>
                    授课教师
                  </div>
                  <div style={{ ...infoValueBoxStyle, minHeight: 48, display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar
                      size={28}
                      src={courseCreator?.avatarUrl || undefined}
                      style={{ backgroundColor: courseCreator?.avatarUrl ? undefined : colors.primary, flexShrink: 0 }}
                    >
                      {courseCreator?.name?.charAt(0) || <UserOutlined />}
                    </Avatar>
                    <div>
                      <Text strong style={infoValueTextStyle}>{courseCreator?.name || "未指定"}</Text>
                      {courseCreator?.jobTitle && (
                        <Text style={{ marginLeft: 8, fontSize: 13, color: "#757780" }}>{courseCreator.jobTitle}</Text>
                      )}
                    </div>
                  </div>
                </div>
              </Col>
              <Col xs={24}>
                <div>
                  <div style={infoLabelStyle}>
                    课程描述
                  </div>
                  <div style={infoValueBoxStyle}>
                    <Paragraph style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: "#424754" }}>{course.description || "暂无描述"}</Paragraph>
                  </div>
                </div>
              </Col>
            </Row>

            {/* 教学团队 */}
            <div style={{ marginTop: 28 }}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#191c1d" }}>教学团队</div>
              </div>
              {allTeachers.length > 0 ? (
                <div style={{ padding: 14, background: "rgba(37, 115, 230, 0.04)", borderRadius: 10 }}>
                  <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                    {allTeachers.map((teacher) => (
                      <div key={teacher.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar size={28} src={teacher.avatarUrl || undefined} style={{ backgroundColor: colors.primary }}>
                          {teacher.name?.charAt(0) || <UserOutlined />}
                        </Avatar>
                        <div>
                          <div style={{ fontSize: 13 }}><Text strong style={{ color: "#191c1d" }}>{teacher.name}</Text> {teacher.jobTitle && <span style={{ fontSize: 12, color: "#757780" }}>· {teacher.jobTitle}</span>}</div>
                          {teacher.colledge && <div style={{ fontSize: 11, color: "#999" }}>{teacher.colledge}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ padding: 14, background: "rgba(37, 115, 230, 0.04)", borderRadius: 10 }}>
                  <Text style={{ color: "#757780" }}>暂无教师信息</Text>
                </div>
              )}
            </div>

            {courseInfo?.background && (
              <div style={{ marginTop: 20 }}>
                <div style={infoLabelStyle}>
                  课程背景
                </div>
                <div style={infoValueBoxStyle}>
                  <Paragraph style={{ margin: 0, fontSize: 15, lineHeight: 1.75, color: "#424754" }}>{courseInfo.background}</Paragraph>
                </div>
              </div>
            )}
          </div>
        );

      case "objectives":
        return (
          <div style={{ borderRadius: 12, background: "#fff", padding: 28, boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "#f5f5f5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <FileTextOutlined style={{ fontSize: 18, color: "#595959" }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d" }}>
                教学目标
              </div>
            </div>
            <div style={{ height: 1, background: "#f0f0f0", marginBottom: 20 }} />
            {courseInfo?.objectives ? (
              <div style={infoValueBoxStyle}>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.75, color: "#424754" }}>
                  {courseInfo.objectives}
                </Paragraph>
              </div>
            ) : (
              <Empty description="暂无教学目标信息" />
            )}
            {courseInfo?.target && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#191c1d", marginTop: 24, marginBottom: 10 }}>
                  目标学员
                </div>
                <div style={infoValueBoxStyle}>
                  <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.75, color: "#424754" }}>
                    {courseInfo.target}
                  </Paragraph>
                </div>
              </>
            )}
          </div>
        );

      case "structure":
        return (
          <div style={{ borderRadius: 12, background: "#fff", padding: 28, boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d", marginBottom: 16 }}>
              课程结构
            </div>
            {courseInfo?.courseStructure ? (
              <div
                style={{
                  padding: 16,
                  background: "rgba(37, 115, 230, 0.04)",
                  borderRadius: 10,
                  marginBottom: 16,
                }}
              >
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", color: "#424754" }}>
                  {courseInfo.courseStructure}
                </Paragraph>
              </div>
            ) : (
              <Empty description="暂无课程结构信息" />
            )}
            {courseInfo?.courseHighlights && (
              <>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#191c1d", marginTop: 24, marginBottom: 10 }}>
                  课程亮点
                </div>
                <div
                  style={{
                    padding: 16,
                    background: "rgba(82, 196, 26, 0.06)",
                    borderRadius: 10,
                  }}
                >
                  <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", color: "#424754" }}>
                    {courseInfo.courseHighlights}
                  </Paragraph>
                </div>
              </>
            )}
          </div>
        );

      case "chapters":
        return (
          <div style={{ borderRadius: 12, background: "#fff", padding: 28, boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${colors.primary}12`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <BookOutlined style={{ fontSize: 18, color: colors.primary }} />
              </div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d" }}>
                  教材章节
                </div>
                <div style={{ fontSize: 12, color: "#757780", marginTop: 1 }}>共 {chapters.length} 个章节</div>
              </div>
            </div>
            {chapterTree && chapterTree.length > 0 ? (
              <div style={{ maxHeight: 600, overflowY: "auto", paddingRight: 8 }}>
                {renderChapterCards(chapterTree)}
              </div>
            ) : (
              <Empty description="暂无章节信息" />
            )}
          </div>
        );

      case "book-details":
        return (
          <div style={{ borderRadius: 12, background: "#fff", padding: 28, boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(82, 196, 26, 0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <BookOutlined style={{ fontSize: 18, color: "#389e0d" }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d" }}>
                教材信息
              </div>
            </div>
            <div style={{ height: 1, background: "#f0f0f0", marginBottom: 20 }} />
            {book ? (
              <>
              <Row gutter={[24, 16]}>
                <Col xs={24} md={16}>
                  <div style={{ marginBottom: 14 }}>
                    <div style={infoLabelStyle}>
                      教材名称
                    </div>
                    <div style={infoValueBoxStyle}>
                      <Text strong style={infoValueTextStyle}>{book.title}</Text>
                    </div>
                  </div>
                  <div>
                    <div style={infoLabelStyle}>
                      出版社
                    </div>
                    <div style={infoValueBoxStyle}>
                      <Text style={infoValueTextStyle}>{book.publish || "未指定"}</Text>
                    </div>
                  </div>
                </Col>
                <Col xs={24} md={8}>
                  <div style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    gap: 12,
                  }}>
                    <img
                      src={book.coverImage || "/book-placeholder.svg"}
                      alt={book.title}
                      style={{
                        maxWidth: "100%",
                        maxHeight: 280,
                        objectFit: "cover",
                        borderRadius: 12,
                        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
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
              </>
            ) : (
              <Empty description="本课程暂未指定教材" />
            )}
          </div>
        );

      case "graduation-requirements":
        return (
          <div style={{ borderRadius: 12, background: "#fff", padding: 28, boxShadow: "0 4px 16px rgba(0, 88, 190, 0.04)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "#f5f5f5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <TrophyOutlined style={{ fontSize: 18, color: "#595959" }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#191c1d" }}>
                毕业要求
              </div>
            </div>
            <div style={{ height: 1, background: "#f0f0f0", marginBottom: 20 }} />
            {courseInfo?.graduationRequirements ? (
              <div style={infoValueBoxStyle}>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.75, color: "#424754" }}>
                  {courseInfo.graduationRequirements}
                </Paragraph>
              </div>
            ) : (
              <Empty description="暂未设置毕业要求" />
            )}
          </div>
        );

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

  return (
    <div className="ovw-page" style={{ minHeight: "100%", padding: "0 20px" }}>
      {/* Course Hero Card */}
      {course && (
        <div
          className="ovw-hero"
          style={{
            borderRadius: 14,
            overflow: "hidden",
            marginBottom: 20,
            position: "relative",
            minHeight: 160,
            background: course.imageUrl
              ? `linear-gradient(rgba(0,0,0,0.3), rgba(0,0,0,0.3)), url(${course.imageUrl}) center/cover no-repeat`
              : `linear-gradient(135deg, ${colors.primary} 0%, #1E3A8A 100%)`,
          }}
        >
          <div className="ovw-hero__inner" style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            padding: "28px 32px",
            minHeight: 160,
          }}>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 22, marginBottom: 10, lineHeight: 1.3, textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
              {course.title}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              {course.major && (
                <span style={{ background: "rgba(255,255,255,0.2)", color: "#fff", padding: "3px 12px", borderRadius: 20, fontSize: 12, fontWeight: 500 }}>
                  {course.major}
                </span>
              )}
              {course.semester && (
                <span style={{ background: "rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.9)", padding: "3px 12px", borderRadius: 20, fontSize: 12 }}>
                  {course.semester}
                </span>
              )}
              {courseCreator && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
                  <Avatar size={20} src={courseCreator.avatarUrl || undefined} style={{ backgroundColor: "rgba(255,255,255,0.3)", flexShrink: 0 }}>
                    {courseCreator.name?.charAt(0)}
                  </Avatar>
                  {courseCreator.name}
                  {courseCreator.jobTitle && <span style={{ color: "rgba(255,255,255,0.65)" }}>· {courseCreator.jobTitle}</span>}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="ovw-tabs-wrapper">
        <div className="ovw-tabs">
          {tabItems.map((tab) => {
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id)}
                className={`ovw-tabs__item ${isActive ? "is-active" : ""}`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      {renderContent()}

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
