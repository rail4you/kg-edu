import { useState, useEffect, useRef } from "react";
import {
  Typography,
  Spin,
  Tag,
  Drawer,
  Button,
  Row,
  Col,
  Empty,
  Grid,
} from "antd";
import {
  BookOutlined,
  AppstoreOutlined,
  BulbOutlined,
  CloseOutlined,
  LinkOutlined,
  FileOutlined,
  PlayCircleOutlined,
  ReadOutlined,
  RightOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import {
  listCourses,
  getFullHierarchy,
  listFiles,
  listVideos,
  listExercises,
} from "@/lib/ash_rpc";
import { extractArrayData, getHeaders } from "@/utils/api-helpers";
import { PageHead, ProtoTag } from "@/components/proto";

const { Text } = Typography;
const { useBreakpoint } = Grid;

interface Topic {
  id?: string;
  title: string;
  content: string;
  type?: "unit" | "knowledge_cell";
  cellCount?: number;
  subtopics?: Subtopic[];
}

interface Subtopic {
  id?: string;
  title: string;
  content: string;
  type: "knowledge_cell";
}

interface Section {
  id: string;
  number: string;
  title: string;
  topics: Topic[];
}

function SubjectSection({
  section,
  isExpanded,
  onToggle,
  isMobile,
}: {
  section: Section;
  isExpanded: boolean;
  onToggle: () => void;
  isMobile: boolean;
}) {
  return (
    <div
      style={{
        marginBottom: 16,
        borderRadius: 14,
        overflow: "hidden",
        background: "#ffffff",
        border: isExpanded ? "1px solid #c6d3f7" : "1px solid var(--pu-line)",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: isMobile ? 12 : 16,
          padding: isMobile ? "14px 16px" : "16px 20px",
          background: isExpanded ? "#eaf0ff" : "#ffffff",
          cursor: "pointer",
          transition: "all 0.2s ease",
        }}
      >
        <div
          style={{
            width: isMobile ? 40 : 44,
            height: isMobile ? 40 : 44,
            background: isExpanded ? "#2573e6" : "#eef1f6",
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.2s ease",
          }}
        >
          <BookOutlined style={{ color: isExpanded ? "#fff" : "#98a6b8", fontSize: 20 }} />
        </div>
        <div style={{ flexGrow: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Text
              strong
              style={{ fontSize: isMobile ? 15 : 16, color: isExpanded ? "#2573e6" : "#202f47", margin: 0 }}
            >
              {section.number}
            </Text>
            <Text
              strong
              style={{ fontSize: isMobile ? 15 : 16, color: isExpanded ? "#2573e6" : "#202f47", margin: 0 }}
            >
              {section.title}
            </Text>
          </div>
          <Text style={{ color: "#64748b", fontSize: 13 }}>
            {section.topics.length} 个单元 · 点击{isExpanded ? "收起" : "展开"}
          </Text>
        </div>
        <div style={{ color: isExpanded ? "#2573e6" : "#98a6b8" }}>
          {isExpanded ? (
            <DownOutlined style={{ fontSize: 14, fontWeight: "bold" }} />
          ) : (
            <RightOutlined style={{ fontSize: 14, fontWeight: "bold" }} />
          )}
        </div>
      </div>

      {isExpanded && (
        <div style={{ padding: isMobile ? 12 : 16 }}>
          {section.topics.length === 0 ? (
            <Text style={{ color: "#666" }}>
              暂无单元数据
            </Text>
          ) : (
            section.topics.map((topic, index) => (
              <div key={topic.id || index}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: isMobile ? 12 : 14,
                    padding: isMobile ? 12 : 14,
                    borderRadius: 6,
                    background: "#f6f8fb",
                    border: "1px solid var(--pu-line)",
                    cursor: "pointer",
                    marginBottom: 12,
                    transition: "all 0.2s ease",
                  }}
                >
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      background: "#2573e6",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <AppstoreOutlined style={{ color: "#fff", fontSize: 16 }} />
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <Text
                      strong
                      style={{
                        fontSize: 14,
                        color: "#202f47",
                        display: "block",
                        marginBottom: 4,
                      }}
                    >
                      {topic.title}
                    </Text>
                    <Text
                      style={{
                        color: "#666",
                        display: "block",
                        marginBottom: 8,
                        fontSize: 13,
                      }}
                    >
                      {topic.content}
                    </Text>
                    <div style={{ display: "flex", gap: 8 }}>
                      <Tag
                        style={{ borderRadius: 5, margin: 0, background: "#edf2ff", border: "1px solid #dce5ff", color: "#2573e6" }}
                      >
                        单元
                      </Tag>
                      {topic.cellCount !== undefined && topic.cellCount > 0 && (
                        <Tag
                          style={{
                            borderRadius: 5,
                            background: "#edf2ff",
                            color: "#2573e6",
                            border: "1px solid #dce5ff",
                            margin: 0,
                          }}
                        >
                          {topic.cellCount} 个知识点
                        </Tag>
                      )}
                    </div>
                  </div>
                </div>

                {topic.subtopics && topic.subtopics.length > 0 && (
                  <div style={{ marginLeft: isMobile ? 12 : 24, marginBottom: 12 }}>
                    {topic.subtopics.map((subtopic, subIndex) => (
                      <div
                        key={subtopic.id || subIndex}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 12,
                          padding: 10,
                          borderRadius: 4,
                          background: "#E6F7FF",
                          border: "1px solid #91D5FF",
                          cursor: "pointer",
                          marginBottom: 8,
                          transition: "all 0.2s ease",
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            background: "#1890FF",
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <BulbOutlined style={{ color: "#fff", fontSize: 14 }} />
                        </div>
                        <div style={{ flexGrow: 1, minWidth: 0 }}>
                          <Text
                            strong
                            style={{
                              fontSize: 13,
                              color: "#0050B3",
                              display: "block",
                              marginBottom: 2,
                            }}
                          >
                            {subtopic.title}
                          </Text>
                          {subtopic.content && subtopic.content !== "知识点详细内容" && (
                            <Text
                              style={{
                                fontSize: 12,
                                color: "#8c8c8c",
                                display: "block",
                              }}
                            >
                              {subtopic.content}
                            </Text>
                          )}
                        </div>
                        <Tag
                          style={{
                            borderRadius: 3,
                            background: "#E6F7FF",
                            color: "#1890FF",
                            border: "1px solid #91D5FF",
                            fontSize: 11,
                            margin: 0,
                          }}
                        >
                          知识点
                        </Tag>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function GraphCategoryPage() {
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    return localStorage.getItem("selectedCourse") || "";
  });
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const isInitialized = useRef(false);
  const [selectedKnowledgeCell, setSelectedKnowledgeCell] = useState<any | null>(
    null
  );
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: coursesData, isLoading: coursesLoading } = useQuery({
    queryKey: ["courses", currentTenant?.id],
    queryFn: () =>
      listCourses({
        tenant: currentTenant?.schemaName || "public",
        fields: ["id", "title", "description"],
        sort: "+title",
        headers: getHeaders(user),
      }),
    enabled: !!currentTenant && !!user,
  });

  const courses = Array.isArray(extractArrayData(coursesData))
    ? extractArrayData(coursesData)
    : [];

  const { data: knowledgeData, isLoading: knowledgeLoading } = useQuery({
    queryKey: ["knowledge-hierarchy", selectedCourseId, currentTenant?.id],
    queryFn: () =>
      selectedCourseId
        ? getFullHierarchy({
            tenant: currentTenant?.schemaName || "public",
            input: { courseId: selectedCourseId },
            fields: [
              "id",
              "name",
              "knowledgeType",
              {
                childUnits: [
                  "id",
                  "name",
                  "knowledgeType",
                  {
                    childCells: ["id", "name", "knowledgeType"],
                  },
                ],
              },
            ],
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedCourseId && !!currentTenant && !!user,
  });

  const hierarchyData = knowledgeData?.success ? knowledgeData.data : [];
  const knowledgeItems = Array.isArray(hierarchyData) ? hierarchyData : [];

  const { data: filesData } = useQuery({
    queryKey: ["knowledge-files", selectedKnowledgeCell?.id, currentTenant?.id],
    queryFn: () =>
      selectedKnowledgeCell
        ? listFiles({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "filename", "path", "fileType", "purpose", "size"],
            filter: { knowledgeResourceId: { eq: selectedKnowledgeCell.id } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedKnowledgeCell && !!currentTenant,
  });

  const { data: videosData } = useQuery({
    queryKey: [
      "knowledge-videos",
      selectedKnowledgeCell?.id,
      currentTenant?.id,
    ],
    queryFn: () =>
      selectedKnowledgeCell
        ? listVideos({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "title", "duration", "thumbnail", "playbackId"],
            filter: { knowledgeResourceId: { eq: selectedKnowledgeCell.id } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedKnowledgeCell && !!currentTenant,
  });

  const { data: exercisesData } = useQuery({
    queryKey: [
      "knowledge-exercises",
      selectedKnowledgeCell?.id,
      currentTenant?.id,
    ],
    queryFn: () =>
      selectedKnowledgeCell
        ? listExercises({
            tenant: currentTenant?.schemaName || "public",
            fields: ["id", "title", "questionContent", "questionType"],
            filter: { knowledgeResourceId: { eq: selectedKnowledgeCell.id } },
            headers: getHeaders(user),
          })
        : null,
    enabled: !!selectedKnowledgeCell && !!currentTenant,
  });

  const files = extractArrayData(filesData);
  const videos = extractArrayData(videosData);
  const exercises = extractArrayData(exercisesData);

  const courseData: Section[] = (() => {
    if (!selectedCourseId || !Array.isArray(knowledgeItems) || knowledgeItems.length === 0) return [];

    return knowledgeItems
      .filter((item: any) => item.knowledgeType === "subject")
      .map((subject: any, index: number) => {
        const topics: Topic[] = [];

        const units = subject.childUnits || [];

        units.forEach((unit: any) => {
          const subtopics: Subtopic[] = [];

          const cells = unit.childCells || [];

          cells.forEach((cell: any) => {
            subtopics.push({
              ...cell,
              title: cell.name,
              content: cell.description || "知识点详细内容",
              type: "knowledge_cell" as const,
            });
          });

          topics.push({
            ...unit,
            title: unit.name,
            content: unit.description || `包含 ${subtopics.length} 个知识点`,
            type: "unit" as const,
            cellCount: subtopics.length,
            subtopics,
          });
        });

        return {
          ...subject,
          number: String(index + 1).padStart(2, "0"),
          title: subject.name,
          topics,
        };
      });
  })();

  const subjectCount = knowledgeItems.filter((item: any) => item.knowledgeType === "subject").length;
  const unitCount = knowledgeItems.reduce((count: number, subject: any) => {
    return count + (subject.childUnits?.length || 0);
  }, 0);
  const cellCount = knowledgeItems.reduce((count: number, subject: any) => {
    return count + (subject.childUnits || []).reduce((unitCount: number, unit: any) => {
      return unitCount + (unit.childCells?.length || 0);
    }, 0);
  }, 0);

  useEffect(() => {
    if (selectedCourseId) {
      localStorage.setItem("selectedCourse", selectedCourseId);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (Array.isArray(courses) && courses.length > 0 && !selectedCourseId) {
      const storedCourseId = localStorage.getItem("selectedCourse");
      const validStoredCourse = courses.find(
        (course: any) => course.id === storedCourseId
      );
      if (validStoredCourse) {
        setSelectedCourseId(storedCourseId || "");
      } else {
        setSelectedCourseId(courses[0].id);
      }
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (
      !isInitialized.current &&
      courseData.length > 0
    ) {
      isInitialized.current = true;
      setExpandedSections(new Set(courseData.map((s: Section) => s.id)));
    }
  }, [courseData]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleKnowledgeCellClick = (knowledgeCell: any) => {
    setSelectedKnowledgeCell(knowledgeCell);
    setDrawerOpen(true);
  };

  const handleSubjectClick = (subject: any) => {
    setSelectedKnowledgeCell({
      ...subject,
      type: "subject",
      title: subject.title || subject.name,
      content: subject.description || "学科详细信息",
    });
    setDrawerOpen(true);
  };

  const handleUnitClick = (unit: any) => {
    setSelectedKnowledgeCell({
      ...unit,
      type: "unit",
      title: unit.title || unit.name,
      content: unit.description || "单元详细信息",
    });
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedKnowledgeCell(null);
  };

  return (
    <div className="pu-page">
      <PageHead
        title="课程知识体系"
        description="展示课程的知识点层级结构"
        actions={
          selectedCourseId && Array.isArray(courses) && courses.length > 0 ? (
            <ProtoTag tone="blue">{courses.find((c: any) => c.id === selectedCourseId)?.title}</ProtoTag>
          ) : undefined
        }
      />

      <Row gutter={isMobile ? [0, 16] : [24, 24]}>
        <Col xs={24} lg={4}>
          <section className="pu-card" style={{ padding: 20 }}>
            <div className="pu-section-title" style={{ marginBottom: 16 }}>
              知识体系导航
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>知识层级</span>
              <span
                style={{
                  fontSize: 14,
                  fontWeight: 650,
                  color: "#2573e6",
                  background: "#eaf0ff",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #dce5ff",
                }}
              >
                知识体系结构
              </span>
            </div>

            <div style={{ marginTop: 24 }}>
              <span style={{ fontSize: 12, color: "#64748b" }}>统计信息</span>
              <div className="pu-metrics" style={{ gridTemplateColumns: "1fr", margin: "12px 0 0" }}>
                <div>
                  <small>主题数量</small>
                  <strong>{subjectCount}</strong>
                </div>
                <div>
                  <small>单元数量</small>
                  <strong>{unitCount}</strong>
                </div>
                <div>
                  <small>知识点数量</small>
                  <strong>{cellCount}</strong>
                </div>
              </div>
            </div>
          </section>
        </Col>

        <Col xs={24} lg={20}>
          {!selectedCourseId ? (
            <section className="pu-card" style={{ padding: 48, textAlign: "center" }}>
              <Empty
                description={
                  <Text style={{ color: "#666" }}>请先选择一个课程</Text>
                }
              />
            </section>
          ) : knowledgeLoading ? (
            <section className="pu-card" style={{ padding: 48, textAlign: "center" }}>
              <Spin size="large" />
              <Text
                style={{
                  color: "#666",
                  display: "block",
                  marginTop: 16,
                }}
              >
                正在加载课程知识体系...
              </Text>
            </section>
          ) : courseData.length === 0 ? (
            <section className="pu-card" style={{ padding: 48, textAlign: "center" }}>
              <Empty
                description={
                  <span style={{ color: "#666" }}>
                    该课程暂无知识体系数据
                  </span>
                }
              />
            </section>
          ) : (
            <div>
              {courseData.map((section) => (
                <SubjectSection
                  key={section.id}
                  section={section}
                  isExpanded={expandedSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  isMobile={isMobile}
                />
              ))}
            </div>
          )}
        </Col>
      </Row>

      <Drawer
        title={
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                background: "colors.primary",
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ReadOutlined style={{ color: "white", fontSize: 20 }} />
            </div>
            <div>
              <Text strong style={{ fontSize: 16 }}>
                {selectedKnowledgeCell?.type === "subject"
                  ? "学科详情"
                  : selectedKnowledgeCell?.type === "unit"
                    ? "单元详情"
                    : "知识点详情"}
              </Text>
              <br />
              <Text type="secondary">{selectedKnowledgeCell?.title}</Text>
            </div>
          </div>
        }
        placement="right"
        width={isMobile ? "100%" : 480}
        onClose={handleDrawerClose}
        open={drawerOpen}
        closeIcon={<CloseOutlined />}
      >
        {selectedKnowledgeCell && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <Text
                type="secondary"
                style={{ marginBottom: 4, display: "block" }}
              >
                名称
              </Text>
              <Text
                strong
                style={{ fontSize: 16, marginBottom: 12, display: "block" }}
              >
                {selectedKnowledgeCell.title}
              </Text>
              {selectedKnowledgeCell.content &&
                selectedKnowledgeCell.content !== "知识点详细内容" && (
                  <>
                    <Text
                      type="secondary"
                      style={{ marginBottom: 4, display: "block" }}
                    >
                      描述
                    </Text>
                    <Text style={{ lineHeight: 1.6 }}>
                      {selectedKnowledgeCell.content}
                    </Text>
                  </>
                )}
            </div>

            {videos.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid #f0f0f0",
                }}
              >
                <Text
                  type="secondary"
                  style={{ marginBottom: 12, display: "block" }}
                >
                  相关视频 ({videos.length})
                </Text>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {videos.map((video: any) => (
                    <div
                      key={video.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      {video.thumbnail && (
                        <img
                          src={video.thumbnail}
                          alt={video.title}
                          style={{
                            width: 80,
                            height: 45,
                            borderRadius: 4,
                            objectFit: "cover",
                          }}
                        />
                      )}
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <Text strong style={{ display: "block" }} ellipsis>
                          {video.title}
                        </Text>
                        {video.duration && (
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {Math.floor(video.duration / 60)}:
                            {String(video.duration % 60).padStart(2, "0")}
                          </Text>
                        )}
                      </div>
                      <Button
                        type="text"
                        icon={<PlayCircleOutlined />}
                        onClick={() => {
                          if (video.playbackId) {
                            window.open(
                              `https://stream.mux.com/${video.playbackId}.m3u8`,
                              "_blank"
                            );
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid #f0f0f0",
                }}
              >
                <Text
                  type="secondary"
                  style={{ marginBottom: 12, display: "block" }}
                >
                  相关文件 ({files.length})
                </Text>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {files.map((file: any) => (
                    <div
                      key={file.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <FileOutlined style={{ color: "colors.primary" }} />
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <Text strong style={{ display: "block" }} ellipsis>
                          {file.filename}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {file.fileType} •{" "}
                          {file.size
                            ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
                            : "Unknown size"}
                        </Text>
                      </div>
                      <Button
                        type="text"
                        icon={<LinkOutlined />}
                        onClick={() => {
                          if (file.path) {
                            window.open(file.path, "_blank");
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {exercises.length > 0 && (
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid #f0f0f0",
                }}
              >
                <Text
                  type="secondary"
                  style={{ marginBottom: 12, display: "block" }}
                >
                  练习题 ({exercises.length})
                </Text>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {exercises.map((exercise: any) => (
                    <div
                      key={exercise.id}
                      style={{
                        padding: 12,
                        background: "#fafafa",
                        borderRadius: 8,
                        border: "1px solid #f0f0f0",
                      }}
                    >
                      <Text strong style={{ display: "block", marginBottom: 4 }}>
                        {exercise.title}
                      </Text>
                      <Text
                        type="secondary"
                        style={{ display: "block", marginBottom: 8 }}
                      >
                        {exercise.questionContent}
                      </Text>
                      {exercise.questionType && (
                        <Tag style={{ borderRadius: 4 }}>
                          {exercise.questionType === "multiple_choice"
                            ? "选择题"
                            : exercise.questionType === "essay"
                              ? "问答题"
                              : "填空题"}
                        </Tag>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
}
