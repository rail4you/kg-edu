import { Button, Typography, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import PracticeScenarioPanel from "@/components/practice/PracticeScenarioPanel";
import TeacherSessionManager from "@/components/practice/TeacherSessionManager";

const { Title } = Typography;

export default function AiPractice() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", paddingBottom: 24 }}>
      <div style={{ padding: 24, background: "white", borderBottom: "1px solid #e0e0e0", display: "flex", alignItems: "center", gap: 8 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: "#1890ff" }} />
        <Title level={4} style={{ margin: 0 }}>AI 实践（6 场景实时评估）</Title>
      </div>

      <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
        <PracticeScenarioPanel interactiveStory={<TeacherSessionManager />} />
      </div>
    </div>
  );
}
