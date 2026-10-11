import { Space, Spin, Empty, Select } from "antd";
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
import { PageHead } from "@/components/proto";
import { SwitchButton } from "@/components/teacher/switch-button";
import { useCourses } from "@/hooks/use-courses";
import { useGraphCourse, type GraphTabType } from "@/hooks/use-graph-course";

function CourseSelectorWrapper() {
  const { courses, loading } = useCourses({
    fields: ["id", "title", "description"],
  });
  const { selectedCourseId, setSelectedCourseId } = useGraphCourse();

  return (
    <SwitchButton
      title="切换当前课程"
      buttonLabel="切换课程"
      options={courses.map((course) => ({ id: course.id, label: course.title }))}
      value={selectedCourseId}
      onChange={(id) => setSelectedCourseId(id || "")}
      loading={loading}
    />
  );
}

const TAB_CONFIG: { key: GraphTabType; label: string; icon: React.ReactNode }[] = [
  { key: "tree", label: "树形图谱", icon: <ApartmentOutlined /> },
  { key: "circle", label: "环形图谱", icon: <SyncOutlined /> },
  { key: "knowledge", label: "知识关系图谱", icon: <ApiOutlined /> },
  { key: "question", label: "问题图谱", icon: <QuestionCircleOutlined /> },
];

function GraphTabs() {
  const { activeTab, setActiveTab } = useGraphCourse();

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
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "8px 16px",
          background: "#fafafa",
          borderBottom: "1px solid #f0f0f0",
          flexShrink: 0,
        }}
      >
        {TAB_CONFIG.map((tab) => (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              cursor: "pointer",
              borderRadius: 4,
              background: activeTab === tab.key ? "#1890ff" : "transparent",
              color: activeTab === tab.key ? "#fff" : "#666",
              transition: "all 0.2s",
              fontWeight: activeTab === tab.key ? 500 : 400,
              fontSize: 14,
            }}
          >
            <span style={{ fontSize: 14 }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        {renderContent()}
      </div>
    </div>
  );
}

function GraphCourseContent() {
  const { selectedCourseId } = useGraphCourse();

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 100px)" }}>
      <div className="pu-breadcrumb">智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;课程图谱</div>
      <PageHead
        title="知识图谱"
        description="可视化课程知识结构、能力与问题关联"
        actions={<CourseSelectorWrapper />}
      />
      {selectedCourseId ? (
        <GraphTabs />
      ) : (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Empty description="请先选择课程" />
        </div>
      )}
    </div>
  );
}

export default function TeacherGraphCourse() {
  return <GraphCourseContent />;
}
