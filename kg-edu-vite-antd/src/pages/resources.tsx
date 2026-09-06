import { DatabaseOutlined } from "@ant-design/icons";
import PlaceholderPage from "./placeholder";
export default function ResourcesPage() {
  return (
    <PlaceholderPage
      title="教学资源库"
      subtitle="汇聚优质教学资源，共建共享教育资源生态。资源库正在建设中，敬请期待。"
      icon={<DatabaseOutlined style={{ color: "#1677ff", fontSize: 72 }} />}
      activeNavKey="/resources"
    />
  );
}
