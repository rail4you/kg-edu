import { useState } from "react";
import {
  ReadOutlined,
  TeamOutlined,
  BookOutlined,
  PartitionOutlined,
  FileTextOutlined,
  ScheduleOutlined,
  UserOutlined,
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
import { PageHead, StatGrid, ProtoCard } from "@/components/proto";
import type { ReactNode } from "react";

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
}

interface FuncGroup {
  key: string;
  titleKey: string;
  icon: ReactNode;
  items: FuncEntry[];
}

/* ────────────────────── config ────────────────────── */

const functionGroups: FuncGroup[] = [
  {
    key: "teaching",
    titleKey: "pages.dashboard.teachingManagement",
    icon: <ReadOutlined />,
    items: [
      { path: "/teacher/dashboard/course", titleKey: "pages.dashboard.courseManagement", icon: <ReadOutlined /> },
      { path: "/teacher/dashboard/student-enrollment", titleKey: "pages.dashboard.studentEnrollment", icon: <TeamOutlined /> },
      { path: "/teacher/dashboard/assign-course", titleKey: "pages.dashboard.assignCourse", icon: <UserOutlined /> },
      { path: "/teacher/dashboard/course-category", titleKey: "pages.dashboard.courseCategory", icon: <FolderOutlined /> },
      { path: "/teacher/dashboard/course-info", titleKey: "pages.dashboard.courseInfo", icon: <FileOutlined /> },
      { path: "/teacher/dashboard/link", titleKey: "pages.dashboard.link", icon: <FileOutlined /> },
      { path: "/teacher/dashboard/book-info", titleKey: "pages.dashboard.bookInfo", icon: <BookOutlined /> },
      { path: "/teacher/dashboard/course-video", titleKey: "pages.dashboard.courseVideo", icon: <VideoCameraOutlined /> },
      { path: "/teacher/dashboard/course-evaluation", titleKey: "pages.dashboard.discussionManagement", icon: <CommentOutlined /> },
    ],
  },
  {
    key: "knowledge",
    titleKey: "pages.dashboard.knowledgeManagement",
    icon: <BookOutlined />,
    items: [
      { path: "/teacher/dashboard/knowledge-resource", titleKey: "pages.dashboard.knowledgeResource", icon: <BookOutlined /> },
      { path: "/teacher/dashboard/knowledge-relation", titleKey: "pages.dashboard.knowledgeRelation", icon: <PartitionOutlined /> },
      { path: "/teacher/dashboard/knowledge-cognitive-goals", titleKey: "pages.dashboard.cognitiveGoals", icon: <TrophyOutlined /> },
      { path: "/teacher/dashboard/knowledge-file", titleKey: "menu.knowledgeFile", icon: <FileOutlined /> },
    ],
  },
  {
    key: "exercise",
    titleKey: "pages.dashboard.exerciseHomework",
    icon: <FileTextOutlined />,
    items: [
      { path: "/teacher/dashboard/exercise", titleKey: "pages.dashboard.exercise", icon: <FileTextOutlined /> },
      { path: "/teacher/dashboard/question", titleKey: "pages.dashboard.question", icon: <EditOutlined /> },
      { path: "/teacher/dashboard/exam-management", titleKey: "pages.dashboard.examManagement", icon: <ScheduleOutlined /> },
      { path: "/teacher/dashboard/exam-grading", titleKey: "pages.dashboard.examGrading", icon: <CheckSquareOutlined /> },
      { path: "/teacher/dashboard/homework", titleKey: "pages.dashboard.homework", icon: <FormOutlined /> },
    ],
  },
  {
    key: "resource",
    titleKey: "pages.dashboard.teachingResource",
    icon: <FolderOutlined />,
    items: [
      { path: "/teacher/dashboard/chapter", titleKey: "pages.dashboard.chapter", icon: <BookOutlined /> },
      { path: "/teacher/dashboard/file", titleKey: "pages.dashboard.file", icon: <FileOutlined /> },
      { path: "/teacher/dashboard/video", titleKey: "pages.dashboard.video", icon: <VideoCameraOutlined /> },
      { path: "/teacher/dashboard/experiment-management", titleKey: "menu.experimentManagement", icon: <ExperimentOutlined /> },
      { path: "/teacher/dashboard/group-management", titleKey: "pages.dashboard.groupManagement", icon: <TeamOutlined /> },
      { path: "/teacher/dashboard/check-in-management", titleKey: "pages.dashboard.checkIn", icon: <CheckSquareOutlined /> },
    ],
  },
  {
    key: "ai",
    titleKey: "pages.dashboard.aiAssistant",
    icon: <RobotOutlined />,
    items: [
      { path: "/teacher/dashboard/ai-assistant", titleKey: "pages.dashboard.aiAssistant", icon: <RobotOutlined /> },
      { path: "/teacher/dashboard/ai-exercise", titleKey: "pages.dashboard.aiExercise", icon: <EditOutlined /> },
      { path: "/teacher/dashboard/ai-file", titleKey: "pages.dashboard.aiFile", icon: <FileOutlined /> },
      { path: "/teacher/dashboard/ai-command", titleKey: "pages.dashboard.aiCommand", icon: <EditOutlined /> },
    ],
  },
  {
    key: "major",
    titleKey: "pages.dashboard.majorManagement",
    icon: <ApartmentOutlined />,
    items: [
      { path: "/teacher/dashboard/major-list", titleKey: "pages.dashboard.major", icon: <ApartmentOutlined /> },
      { path: "/teacher/dashboard/micro-major-list", titleKey: "pages.dashboard.microMajor", icon: <ApartmentOutlined /> },
    ],
  },
  {
    key: "analysis",
    titleKey: "pages.dashboard.dataAnalysis",
    icon: <BarChartOutlined />,
    items: [
      { path: "/teacher/dashboard/course-statistics", titleKey: "pages.dashboard.courseStatistics", icon: <BarChartOutlined /> },
      { path: "/teacher/dashboard/student-profile", titleKey: "pages.dashboard.studentProfile", icon: <UserOutlined /> },
      { path: "/teacher/dashboard/learning-recommendations", titleKey: "pages.dashboard.learningRec", icon: <TrophyOutlined /> },
      { path: "/teacher/dashboard/activity-summary", titleKey: "pages.dashboard.activitySummary", icon: <BarChartOutlined /> },
    ],
  },
  {
    key: "system",
    titleKey: "pages.dashboard.system",
    icon: <SettingOutlined />,
    items: [
      { path: "/teacher/dashboard/settings", titleKey: "pages.dashboard.settings", icon: <SettingOutlined /> },
      { path: "/teacher/dashboard/email-config", titleKey: "pages.dashboard.emailConfig", icon: <MailOutlined /> },
      { path: "/teacher/dashboard/email-messages", titleKey: "pages.dashboard.emailMessages", icon: <MailOutlined /> },
      { path: "/teacher/dashboard/virtual-research-room", titleKey: "pages.dashboard.virtualRoom", icon: <ExperimentOutlined /> },
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
    { titleKey: "pages.dashboard.activeCourses", value: statValues[0], icon: <ReadOutlined /> },
    { titleKey: "pages.dashboard.totalStudents", value: statValues[1], icon: <TeamOutlined /> },
    { titleKey: "pages.dashboard.knowledgePoints", value: statValues[2], icon: <BookOutlined /> },
    { titleKey: "pages.dashboard.totalHomework", value: statValues[3], icon: <FormOutlined /> },
  ];

  // 控制显示的分组
  const visibleGroups = showAllGroups ? functionGroups : functionGroups.slice(0, 5);

  const handleGroupToggle = (key: string) => {
    setExpandedGroups(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  return (
    <div style={{ padding: "20px 24px 40px" }}>
      <PageHead
        title="教师工作台"
        description="集中管理课程、知识体系、教学运行与学情分析"
      />

      <StatGrid
        columns={4}
        items={statCards.map((card) => ({
          label: t(card.titleKey),
          value: card.value,
          icon: card.icon,
        }))}
      />

      <div className="pu-stack">
        {visibleGroups.map((group) => {
          const isExpanded = expandedGroups.includes(group.key);
          const groupTitle = t(group.titleKey);

          return (
            <ProtoCard
              key={group.key}
              title={
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      background: "var(--pu-blue-soft)",
                      color: "var(--pu-blue)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16,
                    }}
                  >
                    {group.icon}
                  </span>
                  {groupTitle}
                </span>
              }
              extra={
                <button
                  type="button"
                  onClick={() => handleGroupToggle(group.key)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    border: 0,
                    background: "transparent",
                    color: "var(--pu-muted)",
                    cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  {group.items.length} 个功能
                  {isExpanded ? <UpOutlined /> : <DownOutlined />}
                </button>
              }
            >
              {isExpanded && (
                <div
                  className="pu-grid"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(168px, 1fr))",
                    gap: 12,
                  }}
                >
                  {group.items.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => navigate(item.path)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "14px 16px",
                        background: "#f9fbff",
                        border: "1px solid var(--pu-line-soft)",
                        borderRadius: 10,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.2s, background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#c7d8fb";
                        e.currentTarget.style.background = "#f3f7ff";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--pu-line-soft)";
                        e.currentTarget.style.background = "#f9fbff";
                      }}
                    >
                      <span
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 10,
                          background: "#edf2ff",
                          color: "var(--pu-blue)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 18,
                          flexShrink: 0,
                        }}
                      >
                        {item.icon}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 500,
                          color: "var(--pu-ink)",
                          lineHeight: 1.35,
                        }}
                      >
                        {t(item.titleKey)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </ProtoCard>
          );
        })}
      </div>

      {/* Show More / Less Button */}
      {functionGroups.length > 5 && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            type="button"
            className="ant-btn ant-btn-default"
            onClick={() => setShowAllGroups(!showAllGroups)}
            style={{ borderRadius: 20, padding: "8px 24px" }}
          >
            {showAllGroups ? "收起更多功能 ↑" : "展开更多功能 ↓"}
          </button>
        </div>
      )}
    </div>
  );
}
