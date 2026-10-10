import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Grid, Empty } from "antd";
import { ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";
import MMResourceManager from "./mm-resource";

export default function MMResourcesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <AppPage
      className="mm-resources-page-wrap"
      title="资源管理"
      description="管理课程资源"
      actions={
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/micro-major/dashboard")}
        />
      }
    >
<style>{`@media(max-width:768px){.mm-resources-page-wrap{padding:12px!important}.mm-resources-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>

      <ContextSelector showCourse />

      {mmId && courseId ? (
        <MMResourceManager tenant={tenant!} courseId={courseId} headers={headers} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </AppPage>
  );
}
