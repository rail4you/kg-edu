import { Button, Spin } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import PracticeScenarioPanel from "@/components/practice/PracticeScenarioPanel";
import TeacherSessionManager from "@/components/practice/TeacherSessionManager";
import { AppPage } from "@/components/proto";

export default function AiPractice() {
  const navigate = useNavigate();
  const { loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <AppPage title="AI 实践" description="六场景实时评估">
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
          <Spin size="large" />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="AI 实践（6 场景实时评估）"
      description="六场景实时评估"
      actions={
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)} style={{ color: "#1890ff" }} />
      }
      fill
    >
      <PracticeScenarioPanel interactiveStory={<TeacherSessionManager />} />
    </AppPage>
  );
}
