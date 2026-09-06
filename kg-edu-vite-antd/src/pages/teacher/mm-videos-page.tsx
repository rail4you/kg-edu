import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Grid, Typography, Empty } from "antd";
import { VideoCameraOutlined , ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import MMVideoManager from "./mm-video";

const { Title } = Typography;

export default function MMVideosPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <div className="mm-videos-page-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-videos-page-wrap{padding:12px!important}.mm-videos-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <VideoCameraOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>视频管理</Title>
      </div>

      <ContextSelector showCourse />

      {mmId && courseId ? (
        <MMVideoManager tenant={tenant!} courseId={courseId} headers={headers} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </div>
  );
}
