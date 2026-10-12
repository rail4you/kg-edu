import { useEffect } from "react";
import { Empty, Select, Grid } from "antd";
import {
  ApartmentOutlined,
  SyncOutlined,
  ApiOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import TeacherGraphKnowledge from "./graph-knowledge";
import TeacherGraphTree from "./graph-tree";
import TeacherGraphCircle from "./graph-circle";
import TeacherGraphQuestion from "./graph-question";
import { AppPage } from "@/components/proto";
import { SwitchButton } from "@/components/teacher/switch-button";
import { useCourses } from "@/hooks/use-courses";
import { useGraphCourse, type GraphTabType } from "@/hooks/use-graph-course";
import { themeColors as colors } from "@/styles/theme";

const { useBreakpoint } = Grid;

const TAB_CONFIG: { key: GraphTabType; label: string; icon: React.ReactNode }[] = [
  { key: "tree", label: "树形图谱", icon: <ApartmentOutlined /> },
  { key: "circle", label: "环形图谱", icon: <SyncOutlined /> },
  { key: "knowledge", label: "知识关系图谱", icon: <ApiOutlined /> },
  { key: "question", label: "问题图谱", icon: <QuestionCircleOutlined /> },
];

function GraphTabs() {
  const { activeTab, setActiveTab } = useGraphCourse();
  const screens = useBreakpoint();
  const isMobile = !screens.md;

  const renderContent = () => {
    switch (activeTab) {
      case "tree":
        return <TeacherGraphTree />;
      case "circle":
        return <TeacherGraphCircle />;
      case "knowledge":
        return <TeacherGraphKnowledge />;
      case "question":
        return <TeacherGraphQuestion />;
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        gap: isMobile ? 8 : 10,
      }}
    >
      {isMobile ? (
        <div
          style={{
            background: "#fff",
            borderRadius: 10,
            border: "1px solid var(--pu-line)",
            padding: 8,
            flexShrink: 0,
          }}
        >
          <Select
            value={activeTab}
            onChange={(v) => setActiveTab(v as GraphTabType)}
            style={{ width: "100%" }}
            options={TAB_CONFIG.map((t) => ({ value: t.key, label: t.label }))}
          />
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
            width: 168,
            background: "#fff",
            borderRadius: 14,
            border: "1px solid var(--pu-line)",
            padding: 8,
            gap: 3,
            height: "fit-content",
          }}
        >
          {TAB_CONFIG.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 9,
                  padding: "9px 11px",
                  borderRadius: 8,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: isActive ? 650 : 400,
                  color: isActive ? colors.primary : "#596b84",
                  background: isActive ? "#eaf0ff" : "transparent",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                  textAlign: "left",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "#f2f5fb";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <span style={{ fontSize: 14 }}>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          borderRadius: isMobile ? 10 : 14,
          background: "#fff",
          border: "1px solid var(--pu-line)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
          <div key={activeTab} style={{ position: "absolute", inset: 0 }}>
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphCourseContent() {
  const { selectedCourseId, setSelectedCourseId } = useGraphCourse();
  const { courses, loading } = useCourses({
    fields: ["id", "title", "description"],
  });

  // 默认选中第一个课程，直接展示其图谱
  useEffect(() => {
    if (!loading && courses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, loading, selectedCourseId, setSelectedCourseId]);

  return (
    <AppPage
      fill
      className="graph-course-page"
      title="知识图谱"
      description="可视化课程知识结构、能力与问题关联"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;课程图谱</>}
      actions={
        <SwitchButton
          title="切换当前课程"
          buttonLabel="切换课程"
          options={courses.map((course) => ({ id: course.id, label: course.title }))}
          value={selectedCourseId}
          onChange={(id) => setSelectedCourseId(id || "")}
          loading={loading}
        />
      }
    >
      <style>{`.graph-course-page { height: calc(100vh - 60px); }`}</style>
      {selectedCourseId ? (
        <GraphTabs />
      ) : (
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#fff",
            borderRadius: 14,
            border: "1px solid var(--pu-line)",
          }}
        >
          <Empty description={loading ? "加载课程中..." : "请先选择课程"} />
        </div>
      )}
    </AppPage>
  );
}

export default function TeacherGraphCourse() {
  return <GraphCourseContent />;
}
