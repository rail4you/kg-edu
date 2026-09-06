import * as React from "react"
import { useNavigate } from "react-router-dom";
import { useState } from "react"
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Button,
  Typography,
  Tag,
  Alert,
  Row,
  Col,
  Divider,
  Table,
  Input,
  Space,
  Tooltip,
  Modal,
  Badge,
  Spin,
  Statistic,
  Select,
} from "antd";
import {
  SearchOutlined,
  EyeOutlined,
  UserOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  CloseOutlined,
  MinusCircleOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listUsers, listEnrollmentsByStudent, listCourses } from "@/lib/ash_rpc";

const { Title, Text } = Typography;

interface Student {
  id: string;
  name: string;
  email?: string;
  memberId?: string;
}

interface KnowledgeResource {
  id: string;
  name: string;
  knowledgeType?: string;
  importanceLevel?: string;
  description?: string;
  courseId?: string;
}

interface Recommendation {
  id: string;
  recommendationType: string;
  priority: number;
  reason: string;
  status: "pending" | "viewed" | "in_progress" | "completed" | "dismissed";
  createdAt: string;
  viewedAt?: string;
  completedAt?: string;
  knowledgeResource?: KnowledgeResource;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

interface RecommendationSummary {
  studentId: string;
  studentName: string;
  pendingCount: number;
  inProgressCount: number;
  completedCount: number;
  dismissedCount: number;
  totalCount: number;
}

function transformRecommendation(item: any): Recommendation {
  const knowledgeResource = item.knowledgeResource || item.knowledge_resource;

  return {
    id: item.id,
    recommendationType: item.recommendationType || item.recommendation_type,
    priority: item.priority,
    reason: item.reason,
    status: item.status,
    createdAt: item.createdAt || item.created_at,
    viewedAt: item.viewedAt || item.viewed_at,
    completedAt: item.completedAt || item.completed_at,
    knowledgeResource: knowledgeResource
      ? {
          id: knowledgeResource.id,
          name: knowledgeResource.name,
          knowledgeType: knowledgeResource.knowledgeType || knowledgeResource.knowledge_type,
          importanceLevel:
            knowledgeResource.importanceLevel || knowledgeResource.importance_level,
          description: knowledgeResource.description,
          courseId: knowledgeResource.courseId || knowledgeResource.course_id,
        }
      : undefined,
    metadata: item.metadata,
  };
}

export default function TeacherLearningRecommendations() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Fetch all courses
  const {
    data: coursesData,
    isLoading: isLoadingCourses,
  } = useQuery({
    queryKey: ["all-courses", currentTenant?.schemaName],
    queryFn: async () => {
      if (!currentTenant?.schemaName) return [];
      const result = await listCourses({
        tenant: currentTenant.schemaName,
        fields: ["id", "title"],
        sort: "+title",
      });
      if (result.success && result.data) {
        return result.data as Array<{ id: string; title: string }>;
      }
      return [];
    },
    enabled: !!currentTenant?.schemaName,
  });

  const {
    data: studentsResult,
    isLoading: isLoadingStudents,
    error: studentsError,
    refetch: refetchStudents,
  } = useQuery({
    queryKey: ["teacher-students", user?.id],
    queryFn: async () => {
      if (!user?.id) return { data: [] };

      const result = await listUsers({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "name", "email", "memberId"],
        filter: { role: { eq: "user" } },
        sort: "+name",
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data = (result as any).data;
        const students = Array.isArray(data)
          ? data
          : data?.results || data?.data || [];
        return { ...result, data: students };
      }

      return { data: [] };
    },
    enabled: !!user?.id,
  });

  const students = React.useMemo(() => {
    if (!studentsResult?.data) return [];
    return studentsResult.data as Student[];
  }, [studentsResult]);

  const filteredStudents = React.useMemo(() => {
    if (!searchTerm) return students;

    const lowerTerm = searchTerm.toLowerCase();
    return students.filter(
      (student) =>
        student.name?.toLowerCase().includes(lowerTerm) ||
        student.email?.toLowerCase().includes(lowerTerm) ||
        student.memberId?.toLowerCase().includes(lowerTerm),
    );
  }, [students, searchTerm]);

  // Fetch recommendations for all filtered students
  const {
    data: recommendationsData,
    isLoading: isLoadingRecommendations,
    refetch: refetchRecommendations,
  } = useQuery({
    queryKey: ["student-recommendations", filteredStudents.map(s => s.id), currentTenant?.schemaName],
    queryFn: async () => {
      if (!filteredStudents.length || !currentTenant?.schemaName) return new Map<string, Recommendation[]>();
      
      const recommendationsMap = new Map<string, Recommendation[]>();
      
      // Fetch recommendations for each student in parallel
      const fetchPromises = filteredStudents.map(async (student) => {
        try {
          const response = await fetch("/rpc/run", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders(user),
            },
            body: JSON.stringify({
              action: "get_student_recommendations",
              tenant: currentTenant?.schemaName,
              input: { studentId: student.id },
            }),
          });
          
          const result = await response.json();
          const recs = result.success && Array.isArray(result.data?.recommendations)
            ? result.data.recommendations.map(transformRecommendation)
            : [];
          recommendationsMap.set(student.id, recs);
        } catch (error) {
          console.error(`Failed to fetch recommendations for student ${student.id}:`, error);
          recommendationsMap.set(student.id, []);
        }
      });
      
      await Promise.all(fetchPromises);
      return recommendationsMap;
    },
    enabled: filteredStudents.length > 0 && !!currentTenant?.schemaName && !!user,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch student course enrollments
  const {
    data: enrollmentsData,
    isLoading: isLoadingEnrollments,
  } = useQuery({
    queryKey: ["student-enrollments", filteredStudents.map(s => s.id), currentTenant?.schemaName],
    queryFn: async () => {
      if (!filteredStudents.length || !currentTenant?.schemaName) return new Map<string, string[]>();
      
      const enrollmentsMap = new Map<string, string[]>();
      
      const fetchPromises = filteredStudents.map(async (student) => {
        try {
          const result = await listEnrollmentsByStudent({
            tenant: currentTenant?.schemaName || "",
            input: { memberId: student.id },
            fields: ["id", "courseId"],
            headers: getAuthHeaders(user) as Record<string, string>,
          });
          
          if (result.success && result.data) {
            const courseIds = (result.data as Array<{ courseId: string }>)
              .map(e => e.courseId)
              .filter(Boolean);
            enrollmentsMap.set(student.id, courseIds);
          } else {
            enrollmentsMap.set(student.id, []);
          }
        } catch (error) {
          console.error(`Failed to fetch enrollments for student ${student.id}:`, error);
          enrollmentsMap.set(student.id, []);
        }
      });
      
      await Promise.all(fetchPromises);
      return enrollmentsMap;
    },
    enabled: filteredStudents.length > 0 && !!currentTenant?.schemaName && !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Filter recommendations by enrolled courses
  const filteredRecommendationsData = React.useMemo(() => {
    if (!recommendationsData || !enrollmentsData) return recommendationsData;
    
    const filteredMap = new Map<string, Recommendation[]>();
    
    recommendationsData.forEach((recommendations, studentId) => {
      const enrolledCourses = enrollmentsData.get(studentId) || [];

      if (!Array.isArray(recommendations)) {
        filteredMap.set(studentId, []);
        return;
      }

      const filtered = recommendations.filter(rec => {
        if (!rec.knowledgeResource?.courseId) return true;
        return enrolledCourses.includes(rec.knowledgeResource.courseId);
      });
      
      filteredMap.set(studentId, filtered);
    });
    
    return filteredMap;
  }, [recommendationsData, enrollmentsData]);

  const recommendationSummaries = React.useMemo(() => {
    if (!filteredRecommendationsData || filteredRecommendationsData.size === 0) {
      return filteredStudents.map((student) => ({
        studentId: student.id,
        studentName: student.name || "Unknown",
        pendingCount: 0,
        inProgressCount: 0,
        completedCount: 0,
        dismissedCount: 0,
        totalCount: 0,
      }));
    }

    return filteredStudents.map((student) => {
      const recommendations = filteredRecommendationsData.get(student.id) || [];
      const getStatus = (r: Recommendation) => (r.status || "").toLowerCase();
      const pendingCount = recommendations.filter(
        (r) => getStatus(r) === "pending" || getStatus(r) === "viewed",
      ).length;
      const inProgressCount = recommendations.filter(
        (r) => getStatus(r) === "in_progress",
      ).length;
      const completedCount = recommendations.filter(r => getStatus(r) === "completed").length;
      const dismissedCount = recommendations.filter(r => getStatus(r) === "dismissed").length;

      return {
        studentId: student.id,
        studentName: student.name || "Unknown",
        pendingCount,
        inProgressCount,
        completedCount,
        dismissedCount,
        totalCount: recommendations.length,
      };
    });
  }, [filteredStudents, filteredRecommendationsData]);

  const stats = React.useMemo(() => {
    const totalStudents = filteredStudents.length;
    const totalPending = recommendationSummaries.reduce(
      (sum, s) => sum + s.pendingCount,
      0,
    );
    const totalInProgress = recommendationSummaries.reduce(
      (sum, s) => sum + s.inProgressCount,
      0,
    );
    const totalCompleted = recommendationSummaries.reduce(
      (sum, s) => sum + s.completedCount,
      0,
    );
    const totalDismissed = recommendationSummaries.reduce(
      (sum, s) => sum + s.dismissedCount,
      0,
    );
    const totalRecommendations = recommendationSummaries.reduce(
      (sum, s) => sum + s.totalCount,
      0,
    );
    const studentsWithPending = recommendationSummaries.filter(
      (s) => s.pendingCount > 0,
    ).length;

    return {
      totalStudents,
      totalPending,
      totalInProgress,
      totalCompleted,
      totalDismissed,
      totalRecommendations,
      studentsWithPending,
    };
  }, [recommendationSummaries, filteredStudents.length]);

  // Fetch recommendations for selected student (detail view)
  const {
    data: studentRecommendations,
    isLoading: isLoadingStudentRecommendations,
  } = useQuery({
    queryKey: ["student-recommendations-detail", selectedStudent?.id, currentTenant?.schemaName],
    queryFn: async () => {
      if (!selectedStudent?.id || !currentTenant?.schemaName) return { recommendations: [], enrolledCourses: [] };
      
      const [recommendationsRes, enrollmentsRes] = await Promise.all([
        fetch("/rpc/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(user),
          },
          body: JSON.stringify({
            action: "get_student_recommendations",
            tenant: currentTenant?.schemaName,
            input: { studentId: selectedStudent.id },
          }),
        }),
        listEnrollmentsByStudent({
          tenant: currentTenant?.schemaName,
          input: { memberId: selectedStudent.id },
          fields: ["id", "courseId"],
          headers: getAuthHeaders(user) as Record<string, string>,
        }),
      ]);
      
      const result = await recommendationsRes.json();
      const recommendations = (result.success && Array.isArray(result.data?.recommendations))
        ? result.data.recommendations.map(transformRecommendation)
        : [];
      
      const enrolledCourses = enrollmentsRes.success && enrollmentsRes.data
        ? (enrollmentsRes.data as Array<{ courseId: string }>)
            .map(e => e.courseId)
            .filter(Boolean)
        : [];
      
      return { recommendations, enrolledCourses };
    },
    enabled: !!selectedStudent?.id && !!currentTenant?.schemaName && detailDialogOpen,
  });

  const handleViewStudent = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (student) {
      setSelectedStudent(student);
      setSelectedCourseId(null);
      setDetailDialogOpen(true);
    }
  };

  const handleCloseDialog = () => {
    setDetailDialogOpen(false);
    setSelectedStudent(null);
    setSelectedCourseId(null);
  };

  const enrolledCoursesList = React.useMemo(() => {
    if (!selectedStudent?.id || !studentRecommendations) return [];
    return studentRecommendations.enrolledCourses || [];
  }, [selectedStudent, studentRecommendations]);

  const recommendations = React.useMemo(() => {
    if (!selectedStudent?.id || !studentRecommendations) return [];
    const enrolledCourses = new Set(studentRecommendations.enrolledCourses || []);

    return (studentRecommendations.recommendations || []).filter((recommendation) => {
      const courseId = recommendation.knowledgeResource?.courseId;
      if (!courseId) return true;
      return enrolledCourses.has(courseId);
    });
  }, [selectedStudent, studentRecommendations]);

  const recommendationStats = React.useMemo(() => {
    if (recommendations.length === 0) {
      return { pending: 0, inProgress: 0, completed: 0, dismissed: 0 };
    }
    const getStatus = (r: Recommendation) => (r.status || "").toLowerCase();
    return {
      pending: recommendations.filter(
        (r) => getStatus(r) === "pending" || getStatus(r) === "viewed",
      ).length,
      inProgress: recommendations.filter((r) => getStatus(r) === "in_progress").length,
      completed: recommendations.filter((r) => getStatus(r) === "completed").length,
      dismissed: recommendations.filter((r) => getStatus(r) === "dismissed").length,
    };
  }, [recommendations]);

  const columns: ColumnsType<RecommendationSummary> = [
    {
      title: "学生姓名",
      dataIndex: "studentName",
      key: "studentName",
      render: (name: string) => {
        return (
          <Space>
            <UserOutlined style={{ color: "#8c8c8c" }} />
            <Text strong>{name}</Text>
          </Space>
        );
      },
    },
    {
      title: "学号",
      key: "memberId",
      render: (_, record) => {
        const student = filteredStudents.find((s) => s.id === record.studentId);
        return <Text type="secondary">{student?.memberId || "-"}</Text>;
      },
    },
    {
      title: "待学习",
      dataIndex: "pendingCount",
      key: "pendingCount",
      align: "center",
      render: (count: number) => (
        <Tag color={count > 0 ? "orange" : "default"}>{count}</Tag>
      ),
    },
    {
      title: "进行中",
      dataIndex: "inProgressCount",
      key: "inProgressCount",
      align: "center",
      render: (count: number) => (
        <Tag color={count > 0 ? "blue" : "default"}>{count}</Tag>
      ),
    },
    {
      title: "已完成",
      dataIndex: "completedCount",
      key: "completedCount",
      align: "center",
      render: (count: number) => (
        <Tag color={count > 0 ? "green" : "default"}>{count}</Tag>
      ),
    },
    {
      title: "已忽略",
      dataIndex: "dismissedCount",
      key: "dismissedCount",
      align: "center",
      render: (count: number) => (
        <Tag color={count > 0 ? "default" : "default"}>{count}</Tag>
      ),
    },
    {
      title: "总计",
      dataIndex: "totalCount",
      key: "totalCount",
      align: "center",
      render: (count: number) => (
        <Tag color="blue">{count}</Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      align: "center",
      render: (_, record) => (
        <Tooltip title="查看详情">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => handleViewStudent(record.studentId)}
          />
        </Tooltip>
      ),
    },
  ];

  if (isLoadingStudents) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 400,
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (studentsError) {
    return (
      <div className="learning-recommendations-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.learning-recommendations-wrap{padding:12px!important}.learning-recommendations-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Alert
          type="error"
          message={`加载学生数据失败: ${(studentsError as Error).message}`}
        />
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <Card style={{ marginBottom: 24 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Space>
            <BulbOutlined style={{ fontSize: 40, color: "#1890ff" }} />
            <div>
                        <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
                学生学习推荐分析
              </Title>
              <Text type="secondary">查看和管理班级学生的学习推荐情况</Text>
            </div>
          </Space>
        </div>

        <Row gutter={12} style={{ marginTop: 16 }}>
          <Col xs={12} sm={4}>
            <Card size="small" style={{ textAlign: "center" }}>
              <Statistic
                title="学生总数"
                value={stats.totalStudents}
                valueStyle={{ color: "#1890ff", fontWeight: "bold", fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card size="small" style={{ textAlign: "center" }}>
              <Statistic
                title="待学习推荐"
                value={stats.totalPending}
                valueStyle={{ color: "#faad14", fontWeight: "bold", fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card size="small" style={{ textAlign: "center" }}>
              <Statistic
                title="已完成推荐"
                value={stats.totalCompleted}
                valueStyle={{ color: "#52c41a", fontWeight: "bold", fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card size="small" style={{ textAlign: "center" }}>
              <Statistic
                title="进行中推荐"
                value={stats.totalInProgress}
                valueStyle={{ color: "#1890ff", fontWeight: "bold", fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card size="small" style={{ textAlign: "center" }}>
              <Statistic
                title="已忽略推荐"
                value={stats.totalDismissed}
                valueStyle={{ color: "#8c8c8c", fontWeight: "bold", fontSize: 20 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={4}>
            <Card size="small" style={{ textAlign: "center" }}>
              <Statistic
                title="有待学习学生"
                value={stats.studentsWithPending}
                valueStyle={{ color: "#ff4d4f", fontWeight: "bold", fontSize: 20 }}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Title level={5} style={{ marginBottom: 16 }}>
        学生推荐列表
      </Title>

      <Card>
        <div style={{ padding: "0 0 16px 0" }}>
          <Input
            placeholder="搜索学生姓名、学号、邮箱或班级..."
            prefix={<SearchOutlined />}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            allowClear
          />
        </div>

        <Divider style={{ margin: 0 }} />

        <Table
          columns={columns}
          dataSource={recommendationSummaries}
          rowKey="studentId"
          pagination={{
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 条`,
            pageSizeOptions: ["10", "25", "50", "100"],
            defaultPageSize: 25,
          }}
          locale={{
            emptyText: searchTerm ? "没有找到匹配的学生" : "暂无学生数据",
          }}
        />
      </Card>

      <Modal
        open={detailDialogOpen}
        onCancel={handleCloseDialog}
        footer={<Button onClick={handleCloseDialog}>关闭</Button>}
        width={900}
        styles={{ body: { padding: 24 } }}
        title={
          <Space>
            <UserOutlined style={{ color: "#1890ff" }} />
            <div>
              <Text strong>{selectedStudent?.name} - 学习推荐详情</Text>
              <br />
              <Text type="secondary" style={{ fontSize: 12 }}>
                学号: {selectedStudent?.memberId || "-"}
              </Text>
            </div>
          </Space>
        }
        closeIcon={<CloseOutlined />}
      >
        {isLoadingStudentRecommendations ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />} />
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">加载中...</Text>
            </div>
          </div>
        ) : (
          <div>
            <Title level={5} style={{ textAlign: "center", marginBottom: 8 }}>
              学习推荐统计
            </Title>
            <Text
              type="secondary"
              style={{ display: "block", textAlign: "center", marginBottom: 24 }}
            >
              共 {recommendations.length} 条推荐
            </Text>

            <Row gutter={12} justify="center">
              <Col xs={8} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Badge
                    count={recommendationStats.pending}
                    color="#faad14"
                    overflowCount={999}
                  >
                    <MinusCircleOutlined
                      style={{ fontSize: 28, color: "#faad14" }}
                    />
                  </Badge>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>{recommendationStats.pending}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>待学习</Text>
                  </div>
                </Card>
              </Col>
              <Col xs={8} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Badge
                    count={recommendationStats.inProgress}
                    color="#1890ff"
                    overflowCount={999}
                  >
                    <PlayCircleOutlined
                      style={{ fontSize: 28, color: "#1890ff" }}
                    />
                  </Badge>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>{recommendationStats.inProgress}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>进行中</Text>
                  </div>
                </Card>
              </Col>
              <Col xs={8} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Badge
                    count={recommendationStats.completed}
                    color="#52c41a"
                    overflowCount={999}
                  >
                    <CheckCircleOutlined
                      style={{ fontSize: 28, color: "#52c41a" }}
                    />
                  </Badge>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>{recommendationStats.completed}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>已完成</Text>
                  </div>
                </Card>
              </Col>
              <Col xs={8} sm={6}>
                <Card size="small" style={{ textAlign: "center" }}>
                  <Badge
                    count={recommendationStats.dismissed}
                    color="#8c8c8c"
                    overflowCount={999}
                  >
                    <CloseOutlined
                      style={{ fontSize: 28, color: "#8c8c8c" }}
                    />
                  </Badge>
                  <div style={{ marginTop: 8 }}>
                    <Text strong>{recommendationStats.dismissed}</Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 12 }}>已忽略</Text>
                  </div>
                </Card>
              </Col>
            </Row>

            {recommendations.length > 0 && (
              <div style={{ marginTop: 32 }}>
                <Title level={5} style={{ marginBottom: 16 }}>
                  推荐详情
                </Title>
                <Table
                  dataSource={recommendations}
                  rowKey="id"
                  size="small"
                  scroll={{ y: 400 }}
                  pagination={{ pageSize: 10 }}
                  columns={[
                    {
                      title: "推荐资源",
                      key: "resource",
                      render: (_: unknown, rec: any) => {
                        const name = rec?.knowledgeResource?.name || "-";
                        const reason = rec?.reason;
                        return (
                          <div style={{ maxWidth: "100%" }}>
                            <Tooltip title={name} mouseEnterDelay={0.3}>
                              <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {name}
                              </Text>
                            </Tooltip>
                            <Tooltip title={reason} mouseEnterDelay={0.3}>
                              <Text type="secondary" style={{ fontSize: 12, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {reason}
                              </Text>
                            </Tooltip>
                          </div>
                        );
                      },
                    },
                    {
                      title: "类型",
                      dataIndex: "recommendationType",
                      key: "recommendationType",
                      render: (type: string) => (
                        <Tag>
                          {type === "weak_knowledge_review" && "薄弱知识点复习"}
                          {type === "prerequisite_learning" && "前置知识学习"}
                          {type === "related_practice" && "相关练习"}
                          {type === "video_learning" && "视频学习"}
                          {type === "reading_material" && "阅读材料"}
                          {type === "homework_practice" && "作业练习"}
                          {type === "exam_review" && "考试复习"}
                        </Tag>
                      ),
                    },
                    {
                      title: "状态",
                      dataIndex: "status",
                      key: "status",
                      render: (status: string) => {
                        const statusMap: Record<string, { color: string; label: string }> = {
                          pending: { color: "orange", label: "待学习" },
                          viewed: { color: "blue", label: "已查看" },
                          in_progress: { color: "processing", label: "进行中" },
                          completed: { color: "success", label: "已完成" },
                          dismissed: { color: "default", label: "已忽略" },
                        };
                        const s = statusMap[status] || { color: "default", label: status };
                        return <Tag color={s.color}>{s.label}</Tag>;
                      },
                    },
                    {
                      title: "创建时间",
                      dataIndex: "createdAt",
                      key: "createdAt",
                      render: (date: string) => (
                        <Text type="secondary">
                          {date ? new Date(date).toLocaleDateString("zh-CN") : "-"}
                        </Text>
                      ),
                    },
                  ]}
                />
              </div>
            )}

            {recommendations.length === 0 && (
              <div style={{ marginTop: 32, textAlign: "center" }}>
                <Text type="secondary">暂无推荐数据</Text>
              </div>
            )}
          </div>
        )}
      </Modal>
      </div>
    </div>
  );
}
