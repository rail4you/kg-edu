import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Grid, Typography, Empty } from "antd";
import { FileOutlined , ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import MMResourceManager from "./mm-resource";

const { Title } = Typography;

export default function MMResourcesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <div className="mm-resources-page-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-resources-page-wrap{padding:12px!important}.mm-resources-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <FileOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>资源管理</Title>
      </div>

      <ContextSelector showCourse />

      {mmId && courseId ? (
        <MMResourceManager tenant={tenant!} courseId={courseId} headers={headers} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </div>
  );
}
