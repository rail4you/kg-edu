import { useSearchParams , useNavigate } from "react-router-dom";
import { Button, Empty } from "antd";
import { ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";
import MMChapterContentManager from "./mm-chapter-content";

export default function MMChapterContentPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");
  const courseId = searchParams.get("courseId");
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  return (
    <AppPage
      className="mm-chapter-content-page-wrap"
      title="章节内容关联"
      description="关联章节与课程内容"
      actions={
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/micro-major/dashboard")}
        />
      }
    >
<style>{`@media(max-width:768px){.mm-chapter-content-page-wrap{padding:12px!important}.mm-chapter-content-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <ContextSelector showCourse />

      {mmId && courseId ? (
        <MMChapterContentManager tenant={tenant!} courseId={courseId} headers={headers} />
      ) : (
        <Empty description="请在上方选择微专业和课程" />
      )}
    </AppPage>
  );
}
