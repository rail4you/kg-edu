import { useQuery } from "@tanstack/react-query";
import { Card, Typography, Row, Col, Tag, Empty, Spin, Button, List, Avatar, Space } from "antd";
import {
  ReadOutlined,
  ScheduleOutlined,
  ExperimentOutlined,
  FileOutlined,
  TeamOutlined,
  BarChartOutlined,
  BulbOutlined,
  MailOutlined,
  BookOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { listCourses } from "@/lib/ash_rpc";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";

const { Title, Text, Paragraph } = Typography;

export default function StudentDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";

  const { data: courses = [], isLoading } = useQuery({
    queryKey: ["studentCourses", tenant, user?.id],
    queryFn: async () => {
      const result = await listCourses({
        tenant,
        fields: ["id", "title", "description", "imageUrl", "major", "semester", "credits"],
        headers: getHeaders(user),
      });
      return extractArrayData(result);
    },
    enabled: !!tenant && !!user,
  });

  const features = [
    { title: "邮件问答", path: "/dashboard/email-qa", icon: <MailOutlined />, color: "#52c41a" },
    { title: "学习推荐", path: "/dashboard/learning-recommendations", icon: <BulbOutlined />, color: "#2573E6" },
    { title: "教师团队", path: "/dashboard/teacher", icon: <TeamOutlined />, color: "#722ed1" },
    { title: "知识图谱", path: "/dashboard/graph", icon: <BarChartOutlined />, color: "#fa8c16" },
    { title: "考试系统", path: "/dashboard/exam-courses", icon: <ScheduleOutlined />, color: "#eb2f96" },
    { title: "实验系统", path: "/dashboard/experiment-courses", icon: <ExperimentOutlined />, color: "#13c2c2" },
    { title: "课程体系", path: "/dashboard/curriculum", icon: <BookOutlined />, color: "#1890ff" },
  ];

  if (authLoading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <Text>请先登录</Text>
      </div>
    );
  }

  return (
    <div>
      <Title level={3} style={{ marginBottom: 24 }}>
        <ReadOutlined style={{ marginRight: 8 }} />
        学习中心
      </Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {features.map((feature) => (
          <Col xs={12} sm={8} md={4} key={feature.path}>
            <Card
              hoverable
              style={{ textAlign: "center" }}
              onClick={() => navigate(feature.path)}
            >
              <Avatar
                size={48}
                style={{ backgroundColor: feature.color, marginBottom: 8 }}
                icon={feature.icon}
              />
              <div>
                <Text strong>{feature.title}</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Title level={4} style={{ marginBottom: 16 }}>
        我的课程
      </Title>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      ) : courses.length === 0 ? (
        <Empty description="暂无选课信息" />
      ) : (
        <List
          grid={{ gutter: 16, xs: 1, sm: 2, md: 3, lg: 3, xl: 4 }}
          dataSource={courses}
          renderItem={(course: any) => (
            <List.Item>
              <Card
                hoverable
                cover={
                  course.imageUrl ? (
                    <img
                      alt={course.title}
                      src={course.imageUrl}
                      style={{ height: 120, objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        height: 120,
                        background: "linear-gradient(135deg, #52c41a 0%, #73d13d 100%)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ReadOutlined style={{ fontSize: 36, color: "white" }} />
                    </div>
                  )
                }
                actions={[
                  <Button
                    type="link"
                    key="detail"
                    onClick={() => navigate(`/dashboard/front?courseId=${course.id}&tenant=${tenant}`)}
                  >
                    详情
                  </Button>,
                  <Button
                    type="link"
                    key="learn"
                    onClick={() => navigate(`/dashboard/overview`)}
                  >
                    学习
                  </Button>,
                ]}
              >
                <Card.Meta
                  title={course.title}
                  description={
                    <Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                      {course.description || "暂无描述"}
                    </Paragraph>
                  }
                />
                <Space size={4}>
                  {course.semester && <Tag color="blue">{course.semester}</Tag>}
                  {course.major && <Tag color="purple">{course.major}</Tag>}
                </Space>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
