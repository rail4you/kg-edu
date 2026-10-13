import { useSearchParams , useNavigate } from "react-router-dom";
import { Typography, Empty, Button } from "antd";
import { ArrowLeftOutlined
} from "@ant-design/icons";
import ContextSelector from "@/components/micro-major/context-selector";
import { AppPage } from "@/components/proto";

export default function MMSettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");

  return (
    <AppPage
      className="mm-settings-page-wrap"
      title="基本设置"
      description="配置微专业基础信息"
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
<style>{`@media(max-width:768px){.mm-settings-page-wrap{padding:12px!important}.mm-settings-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>

      {mmId ? (
        <MicroMajorSettingsInner mmId={mmId} />
      ) : (
        <Empty description="请在上方选择一个微专业" />
      )}
    </AppPage>
  );
}

function MicroMajorSettingsInner({ mmId }: { mmId: string }) {
  return (
    <div>
      <Typography.Text>微专业 {mmId} 的设置功能</Typography.Text>
      {/* The existing TeacherMicroMajorEdit component can be integrated here */}
    </div>
  );
}
