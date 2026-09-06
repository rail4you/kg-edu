import { useSearchParams , useNavigate } from "react-router-dom";
import { Typography, Empty, Button } from "antd";
import { TeamOutlined , ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";

const { Title } = Typography;

export default function MMStudentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");

  return (
    <div className="mm-students-page-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-students-page-wrap{padding:12px!important}.mm-students-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <TeamOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>学生管理</Title>
      </div>

      <ContextSelector />

      {mmId ? (
        <MicroMajorStudentsInner mmId={mmId} />
      ) : (
        <Empty description="请在上方选择一个微专业" />
      )}
    </div>
  );
}

// Inline the student management for the given micro major
function MicroMajorStudentsInner({ mmId }: { mmId: string }) {
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <div>
      <Typography.Text>微专业 {mmId} 的学生管理功能</Typography.Text>
      {/* The existing TeacherMicroMajorStudents component can be integrated here */}
    </div>
  );
}
