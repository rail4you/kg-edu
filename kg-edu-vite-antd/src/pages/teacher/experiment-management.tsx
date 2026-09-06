import * as React from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  Button,
  Typography,
  Tag,
  Space,
  Table,
  Spin,
  Popconfirm,
  Input,
  List,
  Empty,
  Row,
  Col,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  DashboardOutlined,
  CloudOutlined,
  ExperimentOutlined,
  BookOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getHeaders } from "@/utils/api-helpers";
import {
  getExperimentsByCourse,
  destroyExperiment,
} from "@/lib/ash_rpc";
import { useCourses } from "@/hooks/use-courses";
import ActionDropdown from "@/components/ActionDropdown";
import { useEditPermission } from "@/hooks/use-edit-permission";

const { Title, Text } = Typography;

interface Experiment {
  id: string;
  title: string;
  description?: string;
  experimentType: "online" | "offline";
  durationHours?: number;
  difficultyLevel: "easy" | "medium" | "hard";
  status: "draft" | "published" | "archived";
  courseId?: string;
  courseName?: string;
  chapterId?: string;
  chapterName?: string;
  knowledgeResourcesCount?: number;
  guideUrl?: string | null;
  guideTitle?: string | null;
}

export default function ExperimentManagement() {
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canEdit } = useEditPermission();
  const [searchParams] = useSearchParams();
  const [searchText, setSearchText] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // 从 URL 参数初始化 selectedCourseId
  React.useEffect(() => {
    const courseIdFromUrl = searchParams.get("courseId");
    if (courseIdFromUrl) {
      setSelectedCourseId(courseIdFromUrl);
    }
  }, [searchParams]);

  // 获取课程列表（与教师端课程管理页面一致）
  const { courses, loading: isLoadingCourses } = useCourses({
    fields: ["id", "title", "description"],
  });

  // 获取所有课程的实验数量
  const { data: allCoursesExperiments } = useQuery({
    queryKey: ["experiments", "all-courses", tenant, courses],
    queryFn: async () => {
      const results = await Promise.all(
        courses.map(async (course) => {
          const result = await getExperimentsByCourse({
            tenant,
            fields: ["id"],
            input: { courseId: course.id },
            headers: getHeaders(user),
          });
          const experiments = result.success && result.data
            ? (Array.isArray(result.data) ? result.data : (result.data as any).results || (result.data as any).data || [])
            : [];
          return { courseId: course.id, count: experiments.length };
        })
      );
      return results;
    },
    enabled: !!user && !!tenant && courses.length > 0 && !searchParams.get("courseId"),
  });

  // 自动选择实验最多的课程
  React.useEffect(() => {
    if (!selectedCourseId && allCoursesExperiments && allCoursesExperiments.length > 0) {
      const courseWithMostExperiments = allCoursesExperiments.reduce((prev, current) =>
        current.count > prev.count ? current : prev
      );
      if (courseWithMostExperiments.count > 0) {
        setSelectedCourseId(courseWithMostExperiments.courseId);
      } else if (courses.length > 0) {
        setSelectedCourseId(courses[0].id);
      }
    }
  }, [allCoursesExperiments, selectedCourseId, courses]);

  // 获取选中课程的实验列表
  const { data: experimentsResult, isLoading } = useQuery({
    queryKey: ["experiments", "course", selectedCourseId, tenant],
    queryFn: async () => {
      if (!selectedCourseId) {
        return { data: [] };
      }

      const result = await getExperimentsByCourse({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "experimentType",
          "durationHours",
          "difficultyLevel",
          "status",
          "sortOrder",
          "knowledgeResourcesCount",
          "guideUrl",
          "guideTitle",
          { course: ["id", "title"] },
          { chapter: ["id", "title"] },
        ],
        input: { courseId: selectedCourseId },
        headers: getHeaders(user),
      });

      if (result.success && result.data) {
        const experiments = Array.isArray(result.data)
          ? result.data
          : (result.data as any).results || (result.data as any).data || [];
        return {
          data: experiments.map((exp: any) => ({
            ...exp,
            courseName: exp.course?.title || "",
            chapterName: exp.chapter?.title || "",
          })),
        };
      }
      return { data: [] };
    },
    enabled: !!user && !!selectedCourseId && !!tenant,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return destroyExperiment({
        tenant,
        primaryKey: id,
        headers: getHeaders(user),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["experiments"] });
    },
  });

  if (authLoading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="experiment-management-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.experiment-management-wrap{padding:12px!important}.experiment-management-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Text type="danger">用户未登录，请登录以访问实验管理。</Text>
      </div>
    );
  }

  const getExperimentTypeLabel = (type: Experiment["experimentType"]) => {
    return type === "online" ? "线上" : "线下";
  };

  const getExperimentTypeIcon = (type: Experiment["experimentType"]) => {
    return type === "online" ? (
      <CloudOutlined style={{ marginRight: 4 }} />
    ) : (
      <ExperimentOutlined style={{ marginRight: 4 }} />
    );
  };

  const getDifficultyLevelLabel = (level: Experiment["difficultyLevel"]) => {
    const labels: Record<Experiment["difficultyLevel"], string> = {
      easy: "简单",
      medium: "中等",
      hard: "困难",
    };
    return labels[level];
  };

  const getDifficultyLevelColor = (
    level: Experiment["difficultyLevel"],
  ): string => {
    const colors: Record<Experiment["difficultyLevel"], string> = {
      easy: "green",
      medium: "orange",
      hard: "red",
    };
    return colors[level];
  };

  const getStatusLabel = (status: Experiment["status"]) => {
    const labels: Record<Experiment["status"], string> = {
      draft: "草稿",
      published: "已发布",
      archived: "已归档",
    };
    return labels[status];
  };

  const getStatusColor = (status: Experiment["status"]): string => {
    const colors: Record<Experiment["status"], string> = {
      draft: "default",
      published: "blue",
      archived: "cyan",
    };
    return colors[status];
  };

  const experiments = experimentsResult?.data || [];
  const stats = {
    total: experiments.length,
    published: experiments.filter((e: Experiment) => e.status === "published")
      .length,
    draft: experiments.filter((e: Experiment) => e.status === "draft").length,
  };

  const filteredExperiments = experiments.filter((exp: Experiment) =>
    exp.title.toLowerCase().includes(searchText.toLowerCase()),
  );

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const handleGuideClick = (url: string) => {
    if (url) {
      window.open(url, '_blank');
    }
  };

  const columns: ColumnsType<Experiment> = [
    {
      title: "实验名称",
      dataIndex: "title",
      key: "title",
      width: 200,
      render: (text: string) => (
        <Tooltip title={text} mouseEnterDelay={0.3}>
          <Text strong style={{ fontWeight: 600, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</Text>
        </Tooltip>
      ),
      align: "left",
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: Experiment["status"]) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
      align: "left",
    },
    {
      title: "类型",
      dataIndex: "experimentType",
      key: "experimentType",
      width: 100,
      render: (type: Experiment["experimentType"]) => (
        <Space size={4}>
          {getExperimentTypeIcon(type)}
          <Tag>{getExperimentTypeLabel(type)}</Tag>
        </Space>
      ),
      align: "center",
    },
    {
      title: "所属课程",
      dataIndex: "courseName",
      key: "courseName",
      width: 150,
      render: (text: string) => text || "-",
      align: "center",
    },
    {
      title: "难度",
      dataIndex: "difficultyLevel",
      key: "difficultyLevel",
      width: 100,
      render: (level: Experiment["difficultyLevel"]) => (
        <Tag color={getDifficultyLevelColor(level)}>
          {getDifficultyLevelLabel(level)}
        </Tag>
      ),
      align: "center",
    },
    {
      title: "学时",
      dataIndex: "durationHours",
      key: "durationHours",
      width: 80,
      render: (hours: number) => (hours ? `${hours}h` : "-"),
      align: "center",
    },
    {
      title: "知识点",
      dataIndex: "knowledgeResourcesCount",
      key: "knowledgeResourcesCount",
      width: 80,
      render: (count: number) => count || 0,
      align: "center",
    },
    {
      title: "指导书",
      key: "guideUrl",
      width: 120,
      align: "center",
      render: (_, record) =>
        record.guideUrl ? (
          <a
            onClick={() => handleGuideClick(record.guideUrl!)}
            style={{ cursor: "pointer", color: "#1890ff" }}
          >
            {record.guideTitle || "实验指导书"}
          </a>
        ) : (
          "-"
        ),
    },
    {
      title: "操作",
      key: "action",
      width: 80,
      align: "center",
      render: (_, record) => {
        const items = [
          {
            key: "view",
            label: "查看详情",
            icon: <EyeOutlined />,
            onClick: () => navigate(`/teacher/dashboard/experiment-detail/${record.id}`),
          },
          ...(canEdit
            ? [
                {
                  key: "edit",
                  label: "编辑",
                  icon: <EditOutlined />,
                  onClick: () => navigate(`/teacher/dashboard/experiment-form/${record.id}`),
                },
                { type: "divider" as const },
                {
                  key: "delete",
                  label: "删除",
                  icon: <DeleteOutlined />,
                  danger: true,
                  onClick: () => deleteMutation.mutate(record.id),
                },
              ]
            : []),
        ];
        return <ActionDropdown items={items} />;
      },
    },
  ];

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f5f5f5",
      }}
    >
      <div
        style={{
          padding: "16px 24px",
          backgroundColor: "white",
          borderBottom: "1px solid #f0f0f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <ExperimentOutlined style={{ fontSize: 24, color: "#1890ff" }} />
                    <Button
            className="teacher-page-back-btn"
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate("/teacher/dashboard")}
            style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
          />
<Title level={4} style={{ margin: 0 }}>
            实验管理
          </Title>
        </div>

        {selectedCourse && (
        <Row gutter={[16, 16]}>
          <Col span={8}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 6, 
                  background: 'linear-gradient(135deg, #1890ff 0%, #69c0ff 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ExperimentOutlined style={{ fontSize: 18, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>总实验数</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#1890ff' }}>{stats.total}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 6, 
                  background: 'linear-gradient(135deg, #52c41a 0%, #95de64 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <CloudOutlined style={{ fontSize: 18, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>已发布</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>{stats.published}</div>
                </div>
              </div>
            </Card>
          </Col>
          <Col span={8}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ 
                  width: 36, 
                  height: 36, 
                  borderRadius: 6, 
                  background: 'linear-gradient(135deg, #faad14 0%, #ffe58f 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <ExperimentOutlined style={{ fontSize: 18, color: '#fff' }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: '#8c8c8c' }}>草稿</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: '#faad14' }}>{stats.draft}</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
        )}
      </div>

      <div style={{ flexGrow: 1, display: "flex", padding: 24, gap: 24 }}>
        {/* 左侧课程列表 */}
        <Card
          style={{ width: 280, flexShrink: 0 }}
          styles={{ body: { padding: 0 } }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f0f0f0",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <BookOutlined style={{ color: "#1890ff" }} />
            <span>课程列表</span>
            <Tag color="blue" style={{ marginLeft: "auto" }}>
              {courses.length}
            </Tag>
          </div>
          <div style={{ maxHeight: 500, overflow: "auto" }}>
            {isLoadingCourses ? (
              <div style={{ padding: 24, textAlign: "center" }}>
                <Spin />
              </div>
            ) : courses.length === 0 ? (
              <Empty
                description="暂无课程"
                style={{ padding: 24 }}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            ) : (
              <List
                dataSource={courses}
                renderItem={(course) => (
                  <List.Item
                    style={{
                      padding: "12px 16px",
                      cursor: "pointer",
                      backgroundColor:
                        selectedCourseId === course.id ? "#e6f7ff" : "transparent",
                      borderLeft:
                        selectedCourseId === course.id
                          ? "3px solid #1890ff"
                          : "3px solid transparent",
                      transition: "all 0.2s",
                    }}
                    onClick={() => setSelectedCourseId(course.id)}
                    onMouseEnter={(e) => {
                      if (selectedCourseId !== course.id) {
                        e.currentTarget.style.backgroundColor = "#fafafa";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCourseId !== course.id) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }
                    }}
                  >
                    <div style={{ width: "100%" }}>
                      <Text
                        strong={selectedCourseId === course.id}
                        style={{
                          color:
                            selectedCourseId === course.id ? "#1890ff" : "#333",
                        }}
                      >
                        {course.title}
                      </Text>
                      {course.description && (
                        <Text
                          type="secondary"
                          style={{
                            display: "block",
                            fontSize: 12,
                            marginTop: 4,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {course.description}
                        </Text>
                      )}
                    </div>
                  </List.Item>
                )}
              />
            )}
          </div>
        </Card>

        {/* 右侧实验列表 */}
        <Card style={{ flexGrow: 1 }}>
          {!selectedCourseId ? (
            <Empty
              description="请从左侧选择一个课程查看实验"
              style={{ padding: 48 }}
            />
          ) : (
            <>
              <div
                style={{
                  marginBottom: 24,
                  marginTop: -14,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Space size="middle">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate("/teacher/dashboard/experiment-form/new")}
                    style={canEdit ? undefined : { display: "none" }}
                  >
                    创建实验
                  </Button>
                </Space>
                <Input.Search
                  placeholder="搜索实验名称"
                  allowClear
                  onChange={(e) => setSearchText(e.target.value)}
                  style={{ width: 300 }}
                />
              </div>
              <Table
                className="theme-table"
                columns={columns}
                dataSource={filteredExperiments}
                rowKey="id"
                loading={isLoading}
                pagination={{
                  showSizeChanger: true,
                  showTotal: (total) => `共 ${total} 条`,
                  defaultPageSize: 10,
                  pageSizeOptions: ["10", "25", "50", "100"],
                }}
              />
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
