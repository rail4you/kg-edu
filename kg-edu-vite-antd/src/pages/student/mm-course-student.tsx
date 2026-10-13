import { useSearchParams, useNavigate } from "react-router-dom";
import { Button, Empty } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import StudentMMCourse from "./mm-course";

export default function StudentMMCourseInLayout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, tenant: authTenant } = useAuth();

  const mmCourseId = searchParams.get("mmCourseId") || "";
  const mmId = searchParams.get("mmId") || "";
  const tenant = searchParams.get("tenant") || authTenant || "";
  const headers = getAuthHeaders(user) as Record<string, string>;

  if (!mmCourseId) {
    return (
      <div className="pu-page" style={{ padding: 48, textAlign: "center" }}>
        <Empty description="缺少课程参数" />
      </div>
    );
  }

  return (
    <div className="pu-page">
      <Button
        type="text"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(`/dashboard/micro-majors/${tenant}/${mmId}`)}
        style={{ marginBottom: 12, paddingLeft: 0, color: "var(--pu-blue)", fontWeight: 600 }}
      >
        返回微专业
      </Button>
      <div className="pu-breadcrumb">学生学习空间&nbsp;&nbsp;/&nbsp;&nbsp;我的微专业</div>
      <StudentMMCourse tenant={tenant} mmCourseId={mmCourseId} mmId={mmId} headers={headers} />
    </div>
  );
}
