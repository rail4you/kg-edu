import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Grid, Empty } from "antd";
import { ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";
import MMVideoManager from "./mm-video";

export default function MMVideosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <AppPage
      className="mm-videos-page-wrap"
      title="视频管理"
      description="管理课程视频资源"
      actions={
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/micro-major/dashboard")}
        />
      }
    >
<style>{`@media(max-width:768px){.mm-videos-page-wrap{padding:12px!important}.mm-videos-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>

      <ContextSelector showCourse />

      {mmId && courseId ? (
        <MMVideoManager tenant={tenant!} courseId={courseId} headers={headers} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </AppPage>
  );
}
