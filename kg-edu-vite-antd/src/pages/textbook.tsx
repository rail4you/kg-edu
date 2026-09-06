import { BookOutlined } from "@ant-design/icons";
import PlaceholderPage from "./placeholder";
export default function TextbookPage() {
  return (
    <PlaceholderPage
      title="数字教材"
      subtitle="数字化教材资源中心，提供交互式、多媒体融合的现代教材体验。功能开发中。"
      icon={<BookOutlined style={{ color: "#1677ff", fontSize: 72 }} />}
      activeNavKey="/textbook"
    />
  );
}
