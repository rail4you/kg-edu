import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeftOutlined,
  BookOutlined,
  ApartmentOutlined,
  TrophyOutlined,
  FileTextOutlined,
  ReadOutlined,
  LinkOutlined,
} from "@ant-design/icons";
import {
  Button,
  Card,
  Space,
  Spin,
  Tabs,
  Typography,
  Descriptions,
  Tag,
  Empty,
  Row,
  Col,
  Divider,
  Alert,
  Skeleton,
} from "antd";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { myCourses, listMajorCourses, getMajor } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";
import { useEditPermission } from "@/hooks/use-edit-permission";

const { Title, Text, Paragraph } = Typography;

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const { canEdit } = useEditPermission();

  // Fetch course data
  const { data: course, isLoading: courseLoading } = useQuery({
    queryKey: ["course-detail", courseId, tenant],
    queryFn: async () => {
      const result = await myCourses({
        tenant: tenant!,
        fields: [
          "id",
          "title",
          "description",
          "imageUrl",
          "teacherId",
          "publishStatus",
          "semester",
          "semesterHours",
          "credits",
          "major",
          "colorScheme",
          "educationLevel",
          "subjectCategoryId",
          { subjectCategory: ["id", "name"] },
        ] as any,
        headers,
      });
      if (!result.success) throw new Error("获取课程失败");
      const courses = extractArrayData(result) as any[];
      return courses.find((c) => c.id === courseId) || null;
    },
    enabled: !!tenant && !!courseId,
  });

  // Fetch major info via major_courses join table (by courseId)
  const { data: majorInfo, isLoading: majorLoading } = useQuery({
    queryKey: ["course-major", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return null;
      // Find the major-course link
      const linkResult = await listMajorCourses({
        tenant: tenant!,
        fields: ["id", "majorId", "courseId"] as any,
        filter: { courseId: { eq: courseId } },
        page: { limit: 1 },
        headers,
      });
      if (!linkResult.success) return null;
      const links = extractArrayData(linkResult) as any[];
      if (!links || links.length === 0) return null;
      const majorId = links[0].majorId;
      if (!majorId) return null;

      // Get full major detail
      const detailResult = await getMajor({
        tenant: tenant!,
        input: { id: majorId },
        fields: [
          "id",
          "name",
          "code",
          "description",
          "college",
          "degreeType",
          "duration",
          "status",
        ],
        headers,
      });
      if (!detailResult.success) return null;
      return detailResult.data || null;
    },
    enabled: !!tenant && !!courseId,
  });

  const isLoading = courseLoading || (!!course?.major && majorLoading);

  if (!courseId) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="缺少课程 ID" />
        <Button onClick={() => navigate("/teacher/dashboard/course")}>
          返回课程列表
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Skeleton active paragraph={{ rows: 1 }} />
        </div>
        <Card>
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin size="large" />
            <div style={{ marginTop: 12, color: "#999" }}>加载中...</div>
          </div>
        </Card>
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: 24 }}>
        <Empty description="课程不存在" />
        <Button onClick={() => navigate("/teacher/dashboard/course")}>
          返回课程列表
        </Button>
      </div>
    );
  }

  const tabItems = [
    {
      key: "basic",
      label: (
        <span>
          <BookOutlined /> 基本信息
        </span>
      ),
      children: (
        <div>
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="课程名称" span={2}>
              <Text strong>{course.title}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="学期">
              {course.semester || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="学分">
              {course.credits ? `${course.credits} 学分` : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="学时">
              {course.semesterHours ? `${course.semesterHours} 学时` : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="专业">
              {course.major ? (
                <Tag color="purple">{course.major}</Tag>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="教育层次">
              {course.educationLevel ? (
                <Tag color="blue">
                  {course.educationLevel === "graduate"
                    ? "研究生"
                    : course.educationLevel === "undergraduate"
                    ? "本科"
                    : course.educationLevel === "higher_vocational"
                    ? "高职"
                    : course.educationLevel === "secondary_vocational"
                    ? "中职"
                    : course.educationLevel}
                </Tag>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="学科门类">
              {course.subjectCategory?.name ? (
                <Tag color="geekblue">{course.subjectCategory.name}</Tag>
              ) : (
                "-"
              )}
            </Descriptions.Item>
            <Descriptions.Item label="发布状态" span={2}>
              <Tag color={course.publishStatus ? "green" : "default"}>
                {course.publishStatus ? "已发布" : "草稿"}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
          {course.description && (
            <>
              <Divider />
              <Title level={5}>课程描述</Title>
              <Paragraph>{course.description}</Paragraph>
            </>
          )}
          {course.imageUrl && (
            <>
              <Divider />
              <Title level={5}>封面图片</Title>
              <img
                src={course.imageUrl}
                alt={course.title}
                style={{
                  maxWidth: 400,
                  maxHeight: 250,
                  borderRadius: 8,
                  objectFit: "cover",
                }}
              />
            </>
          )}
        </div>
      ),
    },
    {
      key: "major",
      label: (
        <span>
          <ApartmentOutlined /> 课程专业
        </span>
      ),
      children: (
        <div>
          {!majorInfo ? (
            <Alert
              message="该课程未关联专业"
              description="当前课程未在专业管理中关联任何专业，请在专业管理的课程体系中为该课程绑定专业。"
              type="info"
              showIcon
            />
          ) : (
            <div>
              {/* 专业介绍 */}
              <Card
                title={
                  <Space>
                    <ReadOutlined />
                    <span>专业介绍</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="专业名称">
                    <Text strong>{majorInfo.name}</Text>
                  </Descriptions.Item>
                  <Descriptions.Item label="专业代码">
                    {majorInfo.code || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="所属学院">
                    {majorInfo.college || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="学位类型">
                    {majorInfo.degreeType === "bachelor"
                      ? "本科"
                      : majorInfo.degreeType === "master"
                      ? "硕士"
                      : majorInfo.degreeType === "doctoral"
                      ? "博士"
                      : majorInfo.degreeType || "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="学制">
                    {majorInfo.duration ? `${majorInfo.duration}年` : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag
                      color={
                        majorInfo.status === "active" ? "green" : "default"
                      }
                    >
                      {majorInfo.status === "active" ? "启用" : "草稿"}
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
                {majorInfo.description && (
                  <>
                    <Divider />
                    <Title level={5}>专业简介</Title>
                    <Paragraph style={{ lineHeight: 1.8 }}>
                      {majorInfo.description}
                    </Paragraph>
                  </>
                )}
              </Card>

              {/* 专业能力图谱 */}
              <Card
                title={
                  <Space>
                    <TrophyOutlined />
                    <span>专业能力图谱</span>
                  </Space>
                }
                style={{ marginBottom: 16 }}
              >
                <Paragraph type="secondary">
                  查看本专业的能力素质图谱，了解专业能力结构、能力等级和关联关系。
                </Paragraph>
                <Button
                  type="primary"
                  icon={<ApartmentOutlined />}
                  onClick={() =>
                    navigate(
                      `/teacher/dashboard/major-competency/${majorInfo.id}`
                    )
                  }
                >
                  查看能力图谱
                </Button>
              </Card>

              {/* 专业的下载文档 */}
              <Card
                title={
                  <Space>
                    <FileTextOutlined />
                    <span>专业文档下载</span>
                  </Space>
                }
              >
                <Paragraph type="secondary">
                  查看和下载本专业相关的分析报告，包括岗位分析、能力图谱、课程体系等 AI 生成文档。
                </Paragraph>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button
                    icon={<FileTextOutlined />}
                    onClick={() =>
                      navigate(
                        `/teacher/dashboard/major-report/${majorInfo.id}`
                      )
                    }
                    block
                  >
                    查看分析报告
                  </Button>
                  <Button
                    icon={<BookOutlined />}
                    onClick={() =>
                      navigate(
                        `/teacher/dashboard/major-curriculum/${majorInfo.id}`
                      )
                    }
                    block
                  >
                    查看课程体系设计
                  </Button>
                  <Button
                    icon={<LinkOutlined />}
                    onClick={() =>
                      navigate(
                        `/teacher/dashboard/major-detail/${majorInfo.id}`
                      )
                    }
                    block
                  >
                    查看专业详情页面
                  </Button>
                </Space>
              </Card>
            </div>
          )}
        </div>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Space>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard/course")}
          >
            返回课程列表
          </Button>
          <Title level={4} style={{ margin: 0 }}>
            {course.title}
          </Title>
          <Tag color={course.publishStatus ? "green" : "default"}>
            {course.publishStatus ? "已发布" : "草稿"}
          </Tag>
        </Space>
        <Space>
          <Button
            icon={<BookOutlined />}
            onClick={() =>
              navigate("/teacher/dashboard/course", {
                state: { editCourseId: courseId },
              })
            }
            style={canEdit ? undefined : { display: "none" }}
          >
            编辑课程
          </Button>
        </Space>
      </div>

      <Card>
        <Tabs
          defaultActiveKey="basic"
          items={tabItems}
          size="large"
        />
      </Card>
    </div>
  );
}
