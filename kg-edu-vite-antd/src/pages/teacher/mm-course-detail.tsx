import React, { useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftOutlined,
  BookOutlined,
  VideoCameraOutlined,
  FileTextOutlined,
  FileOutlined,
} from "@ant-design/icons";
import { Button, Card, Space, Spin, Tabs, Typography } from "antd";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getMicroMajorCourse } from "@/lib/ash_rpc";
import MMChapterManager from "./mm-chapter";
import MMVideoManager from "./mm-video";
import MMExerciseManager from "./mm-exercise";
import MMResourceManager from "./mm-resource";

const { Title } = Typography;

export default function MicroMajorCourseDetail() {
  const { microMajorId, courseId } = useParams<{
    microMajorId: string;
    courseId: string;
  }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;

  const location = useLocation();

  // Read active tab from URL path, default to "chapters"
  const activeTab = useMemo(() => {
    const pathParts = location.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];
    const validTabs = ["chapters", "videos", "exercises", "resources"];
    return validTabs.includes(lastPart) ? lastPart : "chapters";
  }, [location.pathname]);

  // Fetch course info
  const { data: course, isLoading } = useQuery({
    queryKey: ["mm-course", courseId],
    queryFn: async () => {
      const result = await getMicroMajorCourse({
        tenant: tenant!,
        fields: ["id", "title", "description", "publishStatus", "sortOrder", "semester", "credits", "major"],
        input: { id: courseId! },
        headers,
      });
      if (!result.success) return null;
      return (result.data as any) || null;
    },
    enabled: !!tenant && !!courseId,
  });

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  const tabItems = [
    {
      key: "chapters",
      label: (
        <span>
          <BookOutlined /> 章节管理
        </span>
      ),
      children: (
        <MMChapterManager
          tenant={tenant!}
          courseId={courseId!}
          headers={headers}
        />
      ),
    },
    {
      key: "videos",
      label: (
        <span>
          <VideoCameraOutlined /> 视频管理
        </span>
      ),
      children: (
        <MMVideoManager
          tenant={tenant!}
          courseId={courseId!}
          headers={headers}
        />
      ),
    },
    {
      key: "exercises",
      label: (
        <span>
          <FileTextOutlined /> 习题管理
        </span>
      ),
      children: (
        <MMExerciseManager
          tenant={tenant!}
          courseId={courseId!}
          headers={headers}
        />
      ),
    },
    {
      key: "resources",
      label: (
        <span>
          <FileOutlined /> 资源管理
        </span>
      ),
      children: (
        <MMResourceManager
          tenant={tenant!}
          courseId={courseId!}
          headers={headers}
        />
      ),
    },
  ];

  return (
    <div className="mm-course-detail-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.mm-course-detail-wrap{padding:12px!important}.mm-course-detail-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() =>
              navigate(`/micro-major/${microMajorId}/courses`)
            }
          >
            返回课程列表
          </Button>
                    <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/micro-major/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
            {course?.title || "课程管理"}
          </Title>
        </Space>
      </div>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            const basePath = `/micro-major/${microMajorId}/course/${courseId}`;
            navigate(key === "chapters" ? basePath : `${basePath}/${key}`);
          }}
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
}
