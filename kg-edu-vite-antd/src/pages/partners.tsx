import { TeamOutlined } from "@ant-design/icons";
import PlaceholderPage from "./placeholder";
export default function PartnersPage() {
  return (
    <PlaceholderPage
      title="合作单位"
      subtitle="携手全国高等院校与教育机构，共建智慧教育新生态。合作洽谈请联系我们。"
      icon={<TeamOutlined style={{ color: "#1677ff", fontSize: 72 }} />}
      activeNavKey="/partners"
    />
  );
}
