import { Space, Spin, Empty, Select, Typography } from "antd";
import {
  ApartmentOutlined,
  SyncOutlined,
  ApiOutlined,
  QuestionCircleOutlined,
  ApiTwoTone,
} from "@ant-design/icons";
import TeacherGraphKnowledge from "./graph-knowledge";
import TeacherGraphTree from "./graph-tree";
import TeacherGraphCircle from "./graph-circle";
import TeacherGraphQuestion from "./graph-question";
import { useCourses } from "@/hooks/use-courses";
import { useGraphCourse, type GraphTabType } from "@/hooks/use-graph-course";

const { Title } = Typography;

function CourseSelectorWrapper() {
  const { courses, loading, retryCount, maxRetry } = useCourses({
    fields: ["id", "title", "description"],
  });
  const { selectedCourseId, setSelectedCourseId } = useGraphCourse();

  if (loading) {
    return (
      <Space>
        <Spin size="small" />
        <span style={{ color: "#888" }}>
          {retryCount > 0
            ? `加载课程中 (重试 ${retryCount}/${maxRetry})...`
            : "加载课程中..."}
        </span>
      </Space>
    );
  }

  if (courses.length === 0) {
    return (
      <Space>
        <span style={{ color: "#888" }}>暂无课程数据</span>
      </Space>
    );
  }

  return (
    <Select
      placeholder="请选择课程"
      value={selectedCourseId}
      onChange={setSelectedCourseId}
      style={{ width: 280 }}
      options={courses.map((course) => ({
        label: course.title,
        value: course.id,
      }))}
      allowClear
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
      <div
        style={{
          padding: "12px 16px",
          flexShrink: 0,
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <Space size="middle" align="center">
          <ApiTwoTone style={{ fontSize: 24 }} />
          <Title level={4} style={{ margin: 0 }}>
            知识图谱
          </Title>
          <div style={{ width: 1, height: 20, background: "#d9d9d9" }} />
          <CourseSelectorWrapper />
        </Space>
      </div>
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
