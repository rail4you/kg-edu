import { useState } from "react";
import { Row, Col, Typography, Card, Collapse } from "antd";
import {
  ReadOutlined,
  TeamOutlined,
  BookOutlined,
  PartitionOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  UserOutlined,
  BulbOutlined,
  FormOutlined,
  VideoCameraOutlined,
  FolderOutlined,
  RobotOutlined,
  EditOutlined,
  FileOutlined,
  ApartmentOutlined,
  BarChartOutlined,
  TrophyOutlined,
  CheckSquareOutlined,
  CommentOutlined,
  ExperimentOutlined,
  MailOutlined,
  SettingOutlined,
  UpOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { useTranslate } from "@/locales/use-locales";
import { themeColors as colors } from "@/styles/theme";
import type { ReactNode } from "react";

const { Text } = Typography;
const { Panel } = Collapse;

/* ────────────────────── types ────────────────────── */

interface DashboardStats {
  studentCount: number;
  knowledgeCount: number;
  homeworkCount: number;
  calculatedAt: string;
}

interface FuncEntry {
  path: string;
  titleKey: string;
  icon: ReactNode;
  bgColor: string;
  descKey?: string;
}

interface FuncGroup {
  key: string;
  titleKey: string;
  icon: ReactNode;
  color: string;
  items: FuncEntry[];
}

/* ────────────────────── config ────────────────────── */

const functionGroups: FuncGroup[] = [
  {
    key: "teaching",
    titleKey: "pages.dashboard.teachingManagement",
    icon: <ReadOutlined />,
    color: "#2573E6",
    items: [
      { path: "/teacher/dashboard/course", titleKey: "pages.dashboard.courseManagement", icon: <ReadOutlined />, bgColor: "#E8F4FF" },
      { path: "/teacher/dashboard/student-enrollment", titleKey: "pages.dashboard.studentEnrollment", icon: <TeamOutlined />, bgColor: "#E8FFF5" },
      { path: "/teacher/dashboard/assign-course", titleKey: "pages.dashboard.assignCourse", icon: <UserOutlined />, bgColor: "#FFF5E8" },
      { path: "/teacher/dashboard/course-category", titleKey: "pages.dashboard.courseCategory", icon: <FolderOutlined />, bgColor: "#F5E8FF" },
      { path: "/teacher/dashboard/course-info", titleKey: "pages.dashboard.courseInfo", icon: <FileOutlined />, bgColor: "#E8F4FF" },
      { path: "/teacher/dashboard/link", titleKey: "pages.dashboard.link", icon: <FileOutlined />, bgColor: "#FFF0E8" },
      { path: "/teacher/dashboard/book-info", titleKey: "pages.dashboard.bookInfo", icon: <BookOutlined />, bgColor: "#E8F5FF" },
      { path: "/teacher/dashboard/course-video", titleKey: "pages.dashboard.courseVideo", icon: <VideoCameraOutlined />, bgColor: "#FFE8E8" },
      { path: "/teacher/dashboard/course-evaluation", titleKey: "pages.dashboard.discussionManagement", icon: <CommentOutlined />, bgColor: "#E8FFE8" },
    ],
  },
  {
    key: "knowledge",
    titleKey: "pages.dashboard.knowledgeManagement",
    icon: <BookOutlined />,
    color: "#7C3AED",
    items: [
      { path: "/teacher/dashboard/knowledge-resource", titleKey: "pages.dashboard.knowledgeResource", icon: <BookOutlined />, bgColor: "#F5E8FF" },
      { path: "/teacher/dashboard/knowledge-relation", titleKey: "pages.dashboard.knowledgeRelation", icon: <PartitionOutlined />, bgColor: "#E8F4FF" },
      { path: "/teacher/dashboard/knowledge-cognitive-goals", titleKey: "pages.dashboard.cognitiveGoals", icon: <TrophyOutlined />, bgColor: "#FFF5E8" },
      { path: "/teacher/dashboard/knowledge-file", titleKey: "menu.knowledgeFile", icon: <FileOutlined />, bgColor: "#E8FFF5" },
    ],
  },
  {
    key: "exercise",
    titleKey: "pages.dashboard.exerciseHomework",
    icon: <FileTextOutlined />,
    color: "#D16900",
    items: [
      { path: "/teacher/dashboard/exercise", titleKey: "pages.dashboard.exercise", icon: <FileTextOutlined />, bgColor: "#FFF7ED" },
      { path: "/teacher/dashboard/question", titleKey: "pages.dashboard.question", icon: <EditOutlined />, bgColor: "#E8F4FF" },
      { path: "/teacher/dashboard/exam-management", titleKey: "pages.dashboard.examManagement", icon: <ScheduleOutlined />, bgColor: "#FFE8E8" },

      { path: "/teacher/dashboard/exam-grading", titleKey: "pages.dashboard.examGrading", icon: <CheckSquareOutlined />, bgColor: "#F5E8FF" },
      { path: "/teacher/dashboard/homework", titleKey: "pages.dashboard.homework", icon: <FormOutlined />, bgColor: "#FFF5E8" },
    ],
  },
  {
    key: "resource",
    titleKey: "pages.dashboard.teachingResource",
    icon: <FolderOutlined />,
    color: "#10B981",
    items: [
      { path: "/teacher/dashboard/chapter", titleKey: "pages.dashboard.chapter", icon: <BookOutlined />, bgColor: "#E8FFF5" },
      { path: "/teacher/dashboard/file", titleKey: "pages.dashboard.file", icon: <FileOutlined />, bgColor: "#E8F4FF" },
      { path: "/teacher/dashboard/video", titleKey: "pages.dashboard.video", icon: <VideoCameraOutlined />, bgColor: "#E8F5FF" },
      { path: "/teacher/dashboard/experiment-management", titleKey: "menu.experimentManagement", icon: <ExperimentOutlined />, bgColor: "#FFE8E8" },
      { path: "/teacher/dashboard/group-management", titleKey: "pages.dashboard.groupManagement", icon: <TeamOutlined />, bgColor: "#FFF5E8" },
      { path: "/teacher/dashboard/check-in-management", titleKey: "pages.dashboard.checkIn", icon: <CheckSquareOutlined />, bgColor: "#F5E8FF" },
    ],
  },
  {
    key: "ai",
    titleKey: "pages.dashboard.aiAssistant",
    icon: <RobotOutlined />,
    color: "#7C3AED",
    items: [
      { path: "/teacher/dashboard/ai-assistant", titleKey: "pages.dashboard.aiAssistant", icon: <RobotOutlined />, bgColor: "#F5E8FF" },
      { path: "/teacher/dashboard/ai-exercise", titleKey: "pages.dashboard.aiExercise", icon: <EditOutlined />, bgColor: "#FFF7ED" },
      { path: "/teacher/dashboard/ai-file", titleKey: "pages.dashboard.aiFile", icon: <FileOutlined />, bgColor: "#E8F4FF" },
      { path: "/teacher/dashboard/ai-command", titleKey: "pages.dashboard.aiCommand", icon: <EditOutlined />, bgColor: "#E8FFF5" },
    ],
  },
  {
    key: "major",
    titleKey: "pages.dashboard.majorManagement",
    icon: <ApartmentOutlined />,
    color: "#0891B2",
    items: [
      { path: "/teacher/dashboard/major-list", titleKey: "pages.dashboard.major", icon: <ApartmentOutlined />, bgColor: "#E8F5FF" },
      { path: "/teacher/dashboard/micro-major-list", titleKey: "pages.dashboard.microMajor", icon: <ApartmentOutlined />, bgColor: "#E8F4FF" },
    ],
  },
  {
    key: "analysis",
    titleKey: "pages.dashboard.dataAnalysis",
    icon: <BarChartOutlined />,
    color: "#E11D48",
    items: [
      { path: "/teacher/dashboard/course-statistics", titleKey: "pages.dashboard.courseStatistics", icon: <BarChartOutlined />, bgColor: "#FFE8E8" },
      { path: "/teacher/dashboard/student-profile", titleKey: "pages.dashboard.studentProfile", icon: <UserOutlined />, bgColor: "#E8FFF5" },
      { path: "/teacher/dashboard/learning-recommendations", titleKey: "pages.dashboard.learningRec", icon: <TrophyOutlined />, bgColor: "#F5E8FF" },
      { path: "/teacher/dashboard/activity-summary", titleKey: "pages.dashboard.activitySummary", icon: <BarChartOutlined />, bgColor: "#FFF5E8" },
    ],
  },
  {
    key: "system",
    titleKey: "pages.dashboard.system",
    icon: <SettingOutlined />,
    color: "#666666",
    items: [
      { path: "/teacher/dashboard/settings", titleKey: "pages.dashboard.settings", icon: <SettingOutlined />, bgColor: "#F5F5F5" },
      { path: "/teacher/dashboard/email-config", titleKey: "pages.dashboard.emailConfig", icon: <MailOutlined />, bgColor: "#E8F4FF" },
      { path: "/teacher/dashboard/email-messages", titleKey: "pages.dashboard.emailMessages", icon: <MailOutlined />, bgColor: "#E8F5FF" },
      { path: "/teacher/dashboard/virtual-research-room", titleKey: "pages.dashboard.virtualRoom", icon: <ExperimentOutlined />, bgColor: "#F5E8FF" },
    ],
  },
];

/* ────────────────────── component ────────────────────── */

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const { t } = useTranslate("teacher");
  const [expandedGroups, setExpandedGroups] = useState<string[]>(functionGroups.map(g => g.key));
  const [showAllGroups, setShowAllGroups] = useState(false);

  const { courses } = useCourses({ fields: ["id"] });

  const { data: statsData } = useQuery({
    queryKey: ["dashboardStats", tenant],
    queryFn: async () => {
      const result = await getDashboardStats({
        tenant: tenant || "",
        headers: getAuthHeaders(user) as Record<string, string>,
      });
      if (result.success) return result.data as DashboardStats;
      return null;
    },
    enabled: !!tenant && !!user,
  });

  const statValues = [
    courses.length,
    statsData?.studentCount ?? 0,
    statsData?.knowledgeCount ?? 0,
    statsData?.homeworkCount ?? 0,
  ];

  const statCards = [
    { titleKey: "pages.dashboard.activeCourses", value: statValues[0], color: "#2573E6", bg: "#EEF2FF" },
    { titleKey: "pages.dashboard.totalStudents", value: statValues[1], color: "#10B981", bg: "#ECFDF5" },
    { titleKey: "pages.dashboard.knowledgePoints", value: statValues[2], color: "#D16900", bg: "#FFF7ED" },
    { titleKey: "pages.dashboard.totalHomework", value: statValues[3], color: "#7C3AED", bg: "#F5F3FF" },
  ];

  // 控制显示的分组
  const visibleGroups = showAllGroups ? functionGroups : functionGroups.slice(0, 5);

  const handleGroupToggle = (key: string) => {
    setExpandedGroups(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div style={{ padding: "24px 28px 32px", background: colors.pageBg, minHeight: "100%" }}>
      {/* ── Stats Row ── */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <Col xs={12} sm={12} md={6} key={card.titleKey}>
            <div
              style={{
                background: card.bg,
                borderRadius: 12,
                padding: "18px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid rgba(0,0,0,0.04)",
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4, fontWeight: 500 }}>
                  {t(card.titleKey)}
                </div>
                <div style={{ fontSize: 28, fontWeight: 700, color: card.color, lineHeight: 1.1 }}>
                  {card.value}
                </div>
              </div>
              <div style={{
                width: 48, height: 48, borderRadius: 12,
                background: card.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "#fff",
              }}>
                {statCards[i]?.color && <ReadOutlined />}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* ── Function Groups with Cards ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {visibleGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.key);
          const groupTitle = t(group.titleKey);

          return (
            <div key={group.key}>
              {/* Group Header */}
              <div
                onClick={() => handleGroupToggle(group.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  background: colors.cardBg,
                  borderRadius: 10,
                  marginBottom: 12,
                  cursor: "pointer",
                  border: "1px solid #F0F0F0",
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: group.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    color: "#fff",
                  }}
                >
                  {group.icon}
                </div>
                <span style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary, flex: 1 }}>
                  {groupTitle}
                </span>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>
                  {group.items.length} 个功能
                </span>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: isExpanded ? `${group.color}15` : "#F5F5F5",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: isExpanded ? group.color : "#999",
                  transition: "all 0.2s",
                }}>
                  {isExpanded ? <UpOutlined /> : <DownOutlined />}
                </div>
              </div>

              {/* Group Cards */}
              {isExpanded && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                    gap: 12,
                  }}
                >
                  {group.items.map((item) => (
                    <div
                      key={item.path}
                      onClick={() => navigate(item.path)}
                      style={{
                        background: colors.cardBg,
                        borderRadius: 10,
                        padding: "16px",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 10,
                        cursor: "pointer",
                        border: "1px solid #F0F0F0",
                        transition: "all 0.2s",
                        minHeight: 100,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = group.color;
                        e.currentTarget.style.boxShadow = `0 4px 12px ${group.color}20`;
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "#F0F0F0";
                        e.currentTarget.style.boxShadow = "none";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 12,
                          background: item.bgColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                          color: group.color,
                        }}
                      >
                        {item.icon}
                      </div>
                      <span style={{
                        fontSize: 13,
                        fontWeight: 500,
                        color: colors.textPrimary,
                        textAlign: "center",
                        lineHeight: 1.3,
                      }}>
                        {t(item.titleKey)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {/* Show More / Less Button */}
        {functionGroups.length > 5 && (
          <div style={{ textAlign: "center", marginTop: 8 }}>
            <span
              onClick={() => setShowAllGroups(!showAllGroups)}
              style={{
                fontSize: 13,
                color: "#2573E6",
                cursor: "pointer",
                padding: "8px 24px",
                background: colors.cardBg,
                borderRadius: 20,
                border: "1px solid #E8F4FF",
                display: "inline-block",
              }}
            >
              {showAllGroups ? "收起更多功能 ↑" : "展开更多功能 ↓"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}