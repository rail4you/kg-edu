import { GiftOutlined } from "@ant-design/icons";
import PlaceholderPage from "./placeholder";
export default function DemoPackPage() {
  return (
    <PlaceholderPage
      title="示范教学包"
      subtitle="精选示范教学案例与教学包，助力教师快速构建高质量课程。即将上线。"
      icon={<GiftOutlined style={{ color: "#1677ff", fontSize: 72 }} />}
      activeNavKey="/demo"
    />
  );
}
