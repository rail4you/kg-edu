import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Grid, Empty } from "antd";
import { ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";
import MMExerciseManager from "./mm-exercise";

export default function MMExercisesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <AppPage
      className="mm-exercises-page-wrap"
      title="习题管理"
      description="管理课程习题"
      breadcrumb={<>微专业&nbsp;&nbsp;/&nbsp;&nbsp;习题管理</>}
      actions={<ContextSelector showCourse />}
    >
<style>{`@media(max-width:768px){.mm-exercises-page-wrap{padding:12px!important}.mm-exercises-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>

      {mmId && courseId ? (
        <MMExerciseManager tenant={tenant!} courseId={courseId} headers={headers} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </AppPage>
  );
}
