import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Typography,
  Card,
  Row,
  Col,
  Tag,
  Button,
  Spin,
  Avatar,
  Tabs,
} from "antd";
import {
  BookOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  ReadOutlined,
  StarOutlined,
  FolderOutlined,
  ExperimentOutlined,
  AuditOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { listCourses, listExercises, listHomeworks, listChapters, listFiles, getBook } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { extractArrayData } from "@/utils/api-helpers";

const { Title, Text, Paragraph } = Typography;

export default function CourseSummaryPage() {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const selectedCourseId = localStorage.getItem("selectedCourse") || "";

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses-summary", currentTenant?.id],
    queryFn: () =>
      listCourses({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "title", "description", "credits", "semesterHours", "major", { subjectCategory: ["id", "name"] }],
        sort: "+title",
        headers: getAuthHeaders(user),
      }),
    enabled: !!currentTenant && !!user,
  });

  const courses = extractArrayData(coursesData);

  const { data: bookData } = useQuery({
    queryKey: ["course-book", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? getBook({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "title", "author", "publisher", "coverImage"],
            filter: { courseId: { eq: selectedCourseId } },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const book = bookData?.success && bookData?.data ? bookData.data[0] : null;

  const { data: chaptersData } = useQuery({
    queryKey: ["chapters-summary", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listChapters({
            tenant: currentTenant?.schemaName || "",
            fields: ["id", "title", "description", "sortOrder", "courseId", "path", "parentChapterId", { videos: ["id"] }],
            filter: { courseId: { eq: selectedCourseId } },
            sort: "+path",
            page: { limit: 100, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const chapters = extractArrayData(chaptersData);

  // 将章节转换为树结构
  const chapterTree = React.useMemo(() => {
    if (!chapters.length) return [];

    const map: Record<string, any> = {};
    const roots: any[] = [];

    // 先创建所有节点的map
    chapters.forEach((chapter: any) => {
      map[chapter.id] = {
        ...chapter,
        key: chapter.id,
        title: chapter.title,
        children: [],
      };
    });

    // 使用 parentChapterId 构建树结构
    chapters.forEach((chapter: any) => {
      if (chapter.parentChapterId && map[chapter.parentChapterId]) {
        // 有父节点，加入父节点的children
        map[chapter.parentChapterId].children.push(map[chapter.id]);
      } else {
        // 没有父节点，是根节点
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
  }, [chapters]);

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

  // 递归渲染嵌套章节卡片
  const renderChapterCards = (nodes: any[], level: number = 0) => {
    const levelColors = [
      "#2573E6", // 一级 - 蓝色
      "#52c41a", // 二级 - 绿色
      "#faad14", // 三级 - 橙色
      "#f5222d", // 四级 - 红色
      "#722ed1", // 五级 - 紫色
    ];
    const levelColor = levelColors[level % levelColors.length];
    const leftPadding = level * 20;

    return nodes.map((node: any, index: number) => {
      const hasChildren = node.children && node.children.length > 0;
      const chapterNumber = level === 0 ? `${index + 1}` : generateChapterNumber(node.path);

    return (
      <div key={node.id} style={{ marginBottom: 6 }}>
        <div style={{ paddingLeft: leftPadding }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              borderRadius: 6,
              backgroundColor: level === 0 ? "#F8F9FA" : "#FAFAFA",
              borderLeft: `3px solid ${levelColor}`,
            }}
          >
            {hasChildren ? (
              <FolderOutlined style={{ color: levelColor, fontSize: 14 }} />
            ) : (
              <BookOutlined style={{ color: levelColor, fontSize: 14 }} />
            )}
            {chapterNumber && (
              <Tag
                color={levelColor}
                style={{ marginRight: 4, fontSize: 11, padding: "0 6px" }}
              >
                {chapterNumber}
              </Tag>
            )}
            <span style={{ color: "#1F1F1F", fontSize: level === 0 ? 14 : 13, fontWeight: level === 0 ? 600 : 400 }}>
              {node.title}
            </span>
            {hasChildren && (
              <Tag
                style={{
                  marginLeft: "auto",
                  background: "#E8F0FE",
                  color: "#2573E6",
                  border: "none",
                  fontSize: 11,
                }}
              >
                {node.children.length} 节
              </Tag>
            )}
          </div>
        </div>
        {hasChildren && (
          <div style={{ marginTop: 4 }}>
            {renderChapterCards(node.children, level + 1)}
          </div>
        )}
      </div>
    );
    });
  };

  const allVideos = chapters.flatMap((c: any) => c.videos || []);

  const { data: exercisesData } = useQuery({
    queryKey: ["exercises-summary", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listExercises({
            tenant: currentTenant?.schemaName || "",
            fields: ["id"],
            filter: { courseId: { eq: selectedCourseId } },
            page: { limit: 10000, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const exercises = extractArrayData(exercisesData);

  const { data: homeworksData } = useQuery({
    queryKey: ["homeworks-summary", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listHomeworks({
            tenant: currentTenant?.schemaName || "",
            fields: ["id"],
            filter: { courseId: { eq: selectedCourseId } },
            page: { limit: 1000, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const homeworks = extractArrayData(homeworksData);

  const { data: filesData } = useQuery({
    queryKey: ["files-summary", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? listFiles({
            tenant: currentTenant?.schemaName || "",
            fields: ["id"],
            filter: { courseId: { eq: selectedCourseId } },
            page: { limit: 10000, offset: 0 },
            headers: getAuthHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const files = extractArrayData(filesData);

  const selectedCourse = courses.find((c: any) => c.id === selectedCourseId);

  const videoCount = allVideos.length;
  const exerciseCount = exercises.length;
  const homeworkCount = homeworks.length;
  const totalResources = files.length; // 总资源是文件资源的数量

  const cardStyle: React.CSSProperties = {
    borderRadius: 8,
    background: "#FFFFFF",
    border: '1px solid #E0E0E0',
  };

  if (!currentTenant || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F8F9FA",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Title level={4} style={{ color: "#1F1F1F", marginBottom: 16 }}>
          未选择组织
        </Title>
        <Text style={{ color: "#5E5E5E" }}>
          请选择一个组织以查看课程统计
        </Text>
      </div>
    );
  }

  if (coursesLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F8F9FA",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!selectedCourseId) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#F8F9FA",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
        }}
      >
        <ReadOutlined
          style={{ fontSize: 64, color: "#2573E6", marginBottom: 24 }}
        />
        <Title level={3} style={{ color: "#1F1F1F", marginBottom: 12 }}>
          未选择课程
        </Title>
        <Text style={{ color: "#5E5E5E", marginBottom: 24 }}>
          请先在首页选择一门课程
        </Text>
        <Button
          type="primary"
          onClick={() => (window.location.href = "/dashboard/front")}
          style={{ background: "#2573E6", border: "none" }}
        >
          前往选择课程
        </Button>
      </div>
    );
  }

  const quickLinks = [
    {
      title: "课程介绍",
      icon: <BookOutlined style={{ fontSize: 20, color: "#2573E6" }} />,
      path: "/dashboard/overview",
    },
    {
      title: "视频课程",
      icon: <VideoCameraOutlined style={{ fontSize: 20, color: "#2573E6" }} />,
      path: "/dashboard/course-video",
    },
    {
      title: "课程资源",
      icon: <FileTextOutlined style={{ fontSize: 20, color: "#2573E6" }} />,
      path: "/dashboard/resource",
    },
    {
      title: "实验课程",
      icon: <ExperimentOutlined style={{ fontSize: 20, color: "#2573E6" }} />,
      path: "/dashboard/experiment-courses",
    },
    {
      title: "在线考试",
      icon: <AuditOutlined style={{ fontSize: 20, color: "#2573E6" }} />,
      path: "/dashboard/exam-courses",
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#F8F9FA",
        padding: 24,
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <Title level={3} style={{ color: "#1F1F1F", margin: 0 }}>
            {selectedCourse?.title || "未知课程"}
          </Title>
          <Tag
            icon={<StarOutlined />}
            style={{ background: "#2573E6", color: "#fff", fontWeight: 600 }}
          >
            智慧课堂
          </Tag>
          {selectedCourse?.subjectCategory?.name && (
            <Tag style={{ background: "#E8F0FE", color: "#2573E6", border: "none" }}>
              {selectedCourse.subjectCategory.name}
            </Tag>
          )}
          <Tag style={{ background: "#E8F0FE", color: "#2573E6", border: "none" }}>
            学分：{selectedCourse?.credits ?? 0}
          </Tag>
          <Tag style={{ background: "#E8F0FE", color: "#2573E6", border: "none" }}>
            学时：{selectedCourse?.semesterHours ?? 0}
          </Tag>
        </div>
      </div>

      <Card style={cardStyle} styles={{ body: { padding: 12 } }}>
        <Row gutter={[8, 8]} align="middle">
          {quickLinks.map((link) => (
            <Col xs={12} md={4} key={link.path}>
              <Card
                style={{
                  cursor: "pointer",
                  textAlign: "center",
                  borderColor: "#2573E6",
                }}
                styles={{ body: { padding: 12 } }}
                hoverable
                onClick={() => (window.location.href = link.path)}
              >
                <div style={{ marginBottom: 2 }}>{link.icon}</div>
                <Text strong style={{ color: "#2573E6", fontSize: 12 }}>
                  {link.title}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={12} md={6}>
          <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: "#E8F0FE",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <VideoCameraOutlined style={{ fontSize: 24, color: "#2573E6" }} />
              </div>
              <div>
                <Title level={3} style={{ color: "#1F1F1F", margin: 0 }}>
                  {videoCount}
                </Title>
                <Text style={{ color: "#5E5E5E" }}>视频数量</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={12} md={6}>
          <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: "#E8F0FE",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileTextOutlined style={{ fontSize: 24, color: "#2573E6" }} />
              </div>
              <div>
                <Title level={3} style={{ color: "#1F1F1F", margin: 0 }}>
                  {exerciseCount}
                </Title>
                <Text style={{ color: "#5E5E5E" }}>练习题数量</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={12} md={6}>
          <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: "#E8F0FE",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <ReadOutlined style={{ fontSize: 24, color: "#2573E6" }} />
              </div>
              <div>
                <Title level={3} style={{ color: "#1F1F1F", margin: 0 }}>
                  {homeworkCount}
                </Title>
                <Text style={{ color: "#5E5E5E" }}>作业数量</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col xs={12} md={6}>
          <Card style={cardStyle} styles={{ body: { padding: 20 } }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  background: "#E8F0FE",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <BookOutlined style={{ fontSize: 24, color: "#2573E6" }} />
              </div>
              <div>
                <Title level={3} style={{ color: "#1F1F1F", margin: 0 }}>
                  {totalResources}
                </Title>
                <Text style={{ color: "#5E5E5E" }}>文件资源数量</Text>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {(selectedCourse || book) && (
        <Card style={{ ...cardStyle, marginTop: 24 }} styles={{ body: { padding: 24 } }}>
          <Tabs
            items={[
              ...(selectedCourse ? [{
                key: "intro",
                label: "课程简介",
                children: (
                  <Paragraph style={{ color: "#5E5E5E", lineHeight: 1.8, margin: 0 }}>
                    {selectedCourse.description || "暂无课程描述"}
                  </Paragraph>
                ),
              }] : []),
              ...(book ? [{
                key: "book",
                label: "教材信息",
                children: (
                  <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                    {book.coverImage ? (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        style={{ width: 120, height: 160, objectFit: "cover", borderRadius: 4 }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 120,
                          height: 160,
                          background: "#F8F9FA",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 4,
                        }}
                      >
                        <BookOutlined style={{ fontSize: 48, color: "#2573E6" }} />
                      </div>
                    )}
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "#5E5E5E", lineHeight: 1.8 }}>
                        <p style={{ margin: "4px 0" }}>
                          <strong>书名：</strong>{book.title || "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          <strong>作者：</strong>{book.author || "-"}
                        </p>
                        <p style={{ margin: "4px 0" }}>
                          <strong>出版社：</strong>{book.publisher || "-"}
                        </p>
                      </div>
                    </div>
                  </div>
                ),
              }] : []),
            ]}
          />
        </Card>
      )}

      {chapterTree && chapterTree.length > 0 && (
        <Card
          style={{ ...cardStyle, marginTop: 24 }}
          styles={{ body: { padding: 0 } }}
        >
          <div
            style={{
              padding: 16,
              borderBottom: "1px solid #E0E0E0",
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Avatar style={{ backgroundColor: "#E8F0FE" }} icon={<BookOutlined />} />
            <div>
              <Title level={5} style={{ color: "#1F1F1F", margin: 0 }}>
                教材章节
              </Title>
              <Text style={{ color: "#5E5E5E", fontSize: 12 }}>
                共 {chapters.length} 个章节
              </Text>
            </div>
          </div>
          <div style={{ padding: 16, maxHeight: 400, overflowY: "auto" }}>
            {renderChapterCards(chapterTree)}
          </div>
        </Card>
      )}
    </div>
  );
}
