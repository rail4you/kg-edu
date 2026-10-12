import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  Typography,
  Spin,
  Alert,
  Button,
  Avatar,
  Empty,
  Space,
} from "antd";
import {
  BookOutlined,
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
  MetricList,
  StatGrid,
} from "@/components/proto";
import FilePreview from "@/components/FilePreview";

const { Text, Paragraph } = Typography;

/** 将一段“编号式”课程结构文本解析为列表项（编号 / 标题 / 说明）。 */
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
    const leftPadding = level * 20;

    return nodes.map((node: any, index: number) => {
      const hasChildren = node.children && node.children.length > 0;
      const chapterNumber = level === 0 ? `${index + 1}` : generateChapterNumber(node.path);

      return (
        <div key={node.id}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: level === 0 ? "8px 0" : "6px 0",
              paddingLeft: leftPadding,
            }}
          >
            {chapterNumber && (
              <span style={{ fontSize: 13, fontWeight: level === 0 ? 600 : 400, minWidth: 30 }}>
                {chapterNumber}
              </span>
            )}
            <Text strong={level === 0} style={{ flex: 1, fontSize: level === 0 ? 14 : 13 }}>
              {node.title}
            </Text>
            {hasChildren && (
              <span style={{ fontSize: 12 }}>{node.children.length} 节</span>
            )}
          </div>
          {hasChildren && renderChapterCards(node.children, level + 1)}
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
            <h2>基本信息</h2>
            {course?.description && (
              <Paragraph style={{ margin: "16px 0 0", fontSize: 15, lineHeight: 1.85, color: "var(--pu-muted)" }}>
                {course.description}
              </Paragraph>
            )}

            <h3 style={{ marginTop: 24 }}>课程安排</h3>
            <MetricList
              items={[
                { label: "课程学时", value: course?.semesterHours ?? "-" },
                { label: "学分", value: course?.credits ?? "-" },
                { label: "章节数量", value: chapters.length },
                { label: "授课教师", value: allTeachers.length },
              ]}
            />
            <div className="pu-note">
              {[
                course?.major && `专业：${course.major}`,
                course?.semester && `学期：${course.semester}`,
                courseCreator?.name && `授课教师：${courseCreator.name}`,
              ]
                .filter(Boolean)
                .join("　·　") || "完善课程基本信息，帮助学生了解课程安排。"}
            </div>

            <h3 style={{ marginTop: 24 }}>教学团队</h3>
            {allTeachers.length > 0 ? (
              allTeachers.map((teacher) => (
                <ListItem
                  key={teacher.id}
                  title={teacher.name}
                  description={[teacher.jobTitle, teacher.colledge, roleLabelMap[teacher.role]].filter(Boolean).join(" · ")}
                  extra={
                    <Avatar size={32} src={teacher.avatarUrl || undefined} style={{ backgroundColor: colors.primary }}>
                      {teacher.name?.charAt(0) || <UserOutlined />}
                    </Avatar>
                  }
                />
              ))
            ) : (
              <Paragraph style={{ margin: 0, color: "var(--pu-muted)" }}>暂无教师信息</Paragraph>
            )}

            {courseInfo?.background && (
              <>
                <h3 style={{ marginTop: 24 }}>课程背景</h3>
                <Paragraph style={{ margin: 0, fontSize: 15, lineHeight: 1.85, color: "var(--pu-muted)" }}>
                  {courseInfo.background}
                </Paragraph>
              </>
            )}
          </div>
        );

      case "objectives":
        return (
          <div>
            <h2>教学目标</h2>
            {courseInfo?.objectives ? (
              <Paragraph style={{ margin: "16px 0 0", whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "var(--pu-muted)" }}>
                {courseInfo.objectives}
              </Paragraph>
            ) : (
              <Empty description="暂无教学目标信息" style={{ marginTop: 16 }} />
            )}
            {courseInfo?.target && (
              <>
                <h3 style={{ marginTop: 24 }}>目标学员</h3>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "var(--pu-muted)" }}>
                  {courseInfo.target}
                </Paragraph>
              </>
            )}
          </div>
        );

      case "structure": {
        const structureItems = parseStructureItems(courseInfo?.courseStructure);
        return (
          <div>
            <h2>课程结构</h2>
            {structureItems.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                {structureItems.map((it, i) => (
                  <ListItem
                    key={i}
                    index={String(i + 1).padStart(2, "0")}
                    title={it.title}
                    description={it.desc || undefined}
                    extra={
                      <Button size="small" onClick={() => setActiveSection("chapters")} style={{ borderRadius: 8 }}>
                        查看章节
                      </Button>
                    }
                  />
                ))}
              </div>
            ) : courseInfo?.courseStructure ? (
              <Paragraph style={{ margin: "16px 0 0", whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "var(--pu-muted)" }}>
                {courseInfo.courseStructure}
              </Paragraph>
            ) : (
              <Empty description="暂无课程结构信息" style={{ marginTop: 16 }} />
            )}
            {courseInfo?.courseHighlights && (
              <>
                <h3 style={{ marginTop: 24 }}>课程亮点</h3>
                <Paragraph style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "var(--pu-muted)" }}>
                  {courseInfo.courseHighlights}
                </Paragraph>
              </>
            )}
          </div>
        );
      }

      case "chapters":
        return (
          <div>
            <div className="pu-card-title" style={{ marginBottom: 18 }}>
              <h2>教材章节</h2>
              <ProtoTag tone="blue">共 {chapters.length} 个章节</ProtoTag>
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
            <h2>课程教材</h2>
            {book ? (
              <ListItem
                title={book.title}
                description={[book.publish, "课程教材"].filter(Boolean).join(" · ")}
                extra={
                  <Space size={4}>
                    {book.attachment && (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => {
                          const filename = book.attachment.split("/").pop() || "attachment";
                          setPreviewFile({ url: book.attachment, name: filename, type: filename.split(".").pop() || "" });
                        }}
                      >
                        预览
                      </Button>
                    )}
                    {book.attachment && (
                      <Button
                        type="link"
                        size="small"
                        onClick={() => handleDownloadAttachment(book.attachment, book.title)}
                      >
                        下载
                      </Button>
                    )}
                  </Space>
                }
              />
            ) : (
              <Empty description="本课程暂未指定教材" style={{ marginTop: 16 }} />
            )}
          </div>
        );

      case "graduation-requirements":
        return (
          <div>
            <h2>毕业要求</h2>
            {courseInfo?.graduationRequirements ? (
              <Paragraph style={{ margin: "16px 0 0", whiteSpace: "pre-wrap", fontSize: 15, lineHeight: 1.85, color: "var(--pu-muted)" }}>
                {courseInfo.graduationRequirements}
              </Paragraph>
            ) : (
              <Empty description="暂未设置毕业要求" style={{ marginTop: 16 }} />
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
          <StatGrid
            items={[
              { icon: <BookOutlined />, label: "章节数量", value: chapters.length, unit: "章", desc: "课程的章节结构" },
              { icon: <TeamOutlined />, label: "授课教师", value: allTeachers.length, unit: "位", desc: "参与本课程教学" },
              { icon: <FileTextOutlined />, label: "教材", value: book ? "已配置" : "未配置", desc: book?.title || "本课程暂未指定教材" },
              { icon: <PayCircleOutlined />, label: "毕业要求", value: courseInfo?.graduationRequirements ? "已设置" : "待完善", desc: "课程的能力达成标准" },
            ]}
          />

          {/* 标签页 + 内容 */}
          <ProtoTabs
            items={tabItems}
            active={activeSection}
            onChange={(id) => setActiveSection(id)}
          />

          <div className="pu-grid pu-grid--two">
            <ProtoCard>{renderContent()}</ProtoCard>

            <ProtoCard title="学习支持">
              {supportItems.map((it) => (
                <ListItem
                  key={it.key}
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
