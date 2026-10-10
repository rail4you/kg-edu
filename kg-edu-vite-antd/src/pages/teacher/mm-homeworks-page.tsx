import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Empty } from "antd";
import { ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";
import MMHomeworkManager from "./mm-homework";

export default function MMHomeworksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <AppPage
      className="mm-homeworks-page-wrap"
      title="作业管理"
      description="管理微专业课程作业"
      actions={
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/micro-major/dashboard")}
        />
      }
    >
<style>{`@media(max-width:768px){.mm-homeworks-page-wrap{padding:12px!important}.mm-homeworks-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <ContextSelector showCourse />

      {mmId && courseId ? (
        <MMHomeworkManager tenant={tenant!} courseId={courseId} headers={headers} user={user} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </AppPage>
  );
}
