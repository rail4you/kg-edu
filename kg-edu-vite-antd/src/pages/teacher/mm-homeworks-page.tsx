import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Grid, Typography, Empty } from "antd";
import { EditOutlined , ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import MMHomeworkManager from "./mm-homework";

const { Title } = Typography;

export default function MMHomeworksPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <div className="mm-homeworks-page-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-homeworks-page-wrap{padding:12px!important}.mm-homeworks-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <EditOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>作业管理</Title>
      </div>

      <ContextSelector showCourse />

      {mmId && courseId ? (
        <MMHomeworkManager tenant={tenant!} courseId={courseId} headers={headers} user={user} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </div>
  );
}
