import { useSearchParams , useNavigate } from "react-router-dom";
import { Typography, Empty, Button } from "antd";
import { ReadOutlined , ArrowLeftOutlined
} from "@ant-design/icons";
import ContextSelector from "@/components/micro-major/context-selector";
import MicroMajorCourseList from "./mm-course-list";

const { Title } = Typography;

export default function MMCoursesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mmId = searchParams.get("mmId");

  return (
    <div className="mm-courses-page-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-courses-page-wrap{padding:12px!important}.mm-courses-page-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <ReadOutlined style={{ fontSize: 24, color: "#722ed1" }} />
                  <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>课程管理</Title>
      </div>

      <ContextSelector />

      {mmId ? (
        <MicroMajorCourseList mmId={mmId} standalone={false} />
      ) : (
        <Empty description="请在上方选择一个微专业" />
      )}
    </div>
  );
}
