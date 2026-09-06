import { useSearchParams , useNavigate } from "react-router-dom";
import { Typography, Empty, Button } from "antd";
import { SettingOutlined , ArrowLeftOutlined
} from "@ant-design/icons";
import ContextSelector from "@/components/micro-major/context-selector";

const { Title } = Typography;

export default function MMSettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");

  return (
    <div className="mm-settings-page-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-settings-page-wrap{padding:12px!important}.mm-settings-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <SettingOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>基本设置</Title>
      </div>

      <ContextSelector />

      {mmId ? (
        <MicroMajorSettingsInner mmId={mmId} />
      ) : (
        <Empty description="请在上方选择一个微专业" />
      )}
    </div>
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
