import { useSearchParams , useNavigate } from "react-router-dom";
import { Typography, Empty, Button } from "antd";
import { ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";

export default function MMStudentsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");

  return (
    <AppPage
      className="mm-students-page-wrap"
      title="学生管理"
      description="查看微专业学生与进度"
      actions={
        <>
          <ContextSelector />
          <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
          />
        </>
      }
    >
<style>{`@media(max-width:768px){.mm-students-page-wrap{padding:12px!important}.mm-students-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>

      {mmId ? (
        <MicroMajorStudentsInner mmId={mmId} />
      ) : (
        <Empty description="请在上方选择一个微专业" />
      )}
    </AppPage>
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
