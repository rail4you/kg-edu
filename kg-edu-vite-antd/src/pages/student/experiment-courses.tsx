import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Typography,
  Button,
  Tag,
  Tooltip,
  Spin,
  Alert,
  Table,
  Grid,
} from "antd";
import {
  ArrowRightOutlined,
  ExperimentOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
} from "@ant-design/icons";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { listCourses, getExperimentsByCourse } from "@/lib/ash_rpc";
import { getHeaders, extractArrayData } from "@/utils/api-helpers";
import { themeColors as colors } from "@/styles/theme";

const { Title, Text } = Typography;

interface Experiment {
  id: string;
  title: string;
  description?: string;
  experimentType: "online" | "offline";
  difficultyLevel: "easy" | "medium" | "hard";
  durationHours?: number;
  objectives?: string;
}

export default function ExperimentCourses() {
  const { useBreakpoint } = Grid;
  const screens = useBreakpoint();
  const isMobile = !screens.md;
  const { user, tenant, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { courseId: urlCourseId } = useParams<{ courseId: string }>();
  const [searchParams] = useSearchParams();
  const storedCourseId = localStorage.getItem("selectedCourse");
  const searchCourseId = searchParams.get("courseId");
  // 优先级：URL 路径参数 > 查询参数（来自 front 页面链接） > localStorage
  const courseId = urlCourseId || searchCourseId || storedCourseId || null;

  const { data: courseData, isLoading: isLoadingCourse } = useQuery({
    queryKey: ["course", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return null;

      const result = await listCourses({
        tenant,
        fields: ["id", "title", "description"],
        filter: { id: { eq: courseId } },
        headers: getHeaders(user),
      });

      const courses = extractArrayData(result);
      if (courses.length > 0) {
        return { success: true, data: courses[0] };
      }
      return null;
    },
    enabled: !!courseId && !!user && !!tenant,
  });

  const { data: experimentsResult, isLoading: isLoadingExperiments } = useQuery({
    queryKey: ["experiments", "course", courseId, tenant],
    queryFn: async () => {
      if (!courseId) return { success: true, data: [] };

      const result = await getExperimentsByCourse({
        tenant,
        fields: [
          "id",
          "title",
          "description",
          "experimentType",
          "difficultyLevel",
          "durationHours",
          "objectives",
          "requirements",
        ],
        input: { courseId },
        headers: getHeaders(user),
      });

      return result;
    },
    enabled: !!courseId && !!user && !!tenant,
  });

  if (authLoading || isLoadingCourse || isLoadingExperiments) {
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

  if (!user) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" message="用户未登录，请登录以访问实验。" />
      </div>
    );
  }

  if (!courseId) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          type="info"
          message="请先选择一个课程"
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" onClick={() => navigate("/dashboard")}>
          返回首页选择课程
        </Button>
      </div>
    );
  }

  if (!courseData?.data) {
    return (
      <div style={{ padding: 24 }}>
        <Text type="danger">无法加载课程信息</Text>
      </div>
    );
  }

  const course = courseData.data;
  const experiments: Experiment[] = experimentsResult?.success
    ? extractArrayData(experimentsResult.data)
    : [];

  const onlineCount = experiments.filter((e) => e.experimentType === "online").length;
  const offlineCount = experiments.filter((e) => e.experimentType === "offline").length;
  const totalHours = experiments.reduce((acc, e) => acc + (e.durationHours || 0), 0);

  const getExperimentTypeLabel = (type: Experiment["experimentType"]) => {
    return type === "online" ? "线上" : "线下";
  };

  const getDifficultyLevelLabel = (level: Experiment["difficultyLevel"]) => {
    const labels: Record<Experiment["difficultyLevel"], string> = {
      easy: "简单",
      medium: "中等",
      hard: "困难",
    };
    return labels[level];
  };

  const getDifficultyLevelColor = (level: Experiment["difficultyLevel"]) => {
    const colorMap: Record<Experiment["difficultyLevel"], string> = {
      easy: "success",
      medium: "warning",
      hard: "error",
    };
    return colorMap[level];
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: colors.background }}>
      <div style={{ flexGrow: 1, overflow: "auto", padding: isMobile ? "12px" : "24px 32px" }}>
        {/* 紧凑统计卡片 */}
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr 1fr 1fr', gap: isMobile ? 6 : 16, marginBottom: isMobile ? 8 : 20 }}>
          {[
            { label: '实验项目', val: experiments.length, icon: <ExperimentOutlined />, color: colors.primary, sub: `共 ${onlineCount} 线上 · ${offlineCount} 线下 · ${totalHours} 学时` },
            { label: '线上实验', val: onlineCount, icon: <ExperimentOutlined />, color: '#10B981', sub: '' },
            { label: '线下实验', val: offlineCount, icon: <ExperimentOutlined />, color: '#6177A5', sub: '' },
            { label: '总学时', val: totalHours, icon: <ClockCircleOutlined />, color: '#D16900', sub: '' },
          ].map((item, i) => (
            <div key={i} style={{
              background: i === 0 ? 'rgba(37,115,230,0.04)' : '#fff',
              borderRadius: isMobile ? 10 : 12,
              padding: isMobile ? '8px 10px' : 20,
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 8 : 14,
              boxShadow: i === 0 ? '0 1px 4px rgba(37,115,230,0.08)' : '0 1px 3px rgba(0,0,0,0.04)',
              border: i === 0 ? '1px solid rgba(37,115,230,0.08)' : 'none',
            }}>
              <div style={{
                width: isMobile ? 36 : 48, height: isMobile ? 36 : 48, borderRadius: isMobile ? 10 : 14,
                background: i === 0 ? `linear-gradient(135deg, ${colors.primary}18 0%, ${colors.primary}08 100%)` : '#f5f5f5',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                {React.cloneElement(item.icon as React.ReactElement, { style: { fontSize: isMobile ? 16 : 22, color: item.color } })}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: isMobile ? 20 : 32, fontWeight: 700, lineHeight: 1.15, color: colors.textPrimary }}>
                  {item.val}
                </div>
                <div style={{ fontSize: isMobile ? 10 : 12, color: colors.textSecondary }}>
                  {item.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 实验列表 */}
        <div style={{
          background: "#FFFFFF", borderRadius: 12,
          padding: isMobile ? "12px" : "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{
              fontSize: 18, fontWeight: 700,
              fontFamily: "'Manrope', sans-serif",
              color: colors.textPrimary, margin: 0,
            }}>
              实验列表
            </h2>
            <p style={{ fontSize: 13, color: colors.textSecondary, margin: "4px 0 0" }}>
              {course.title} 的全部实验项目
            </p>
          </div>

          {experiments.length === 0 ? (
            <div style={{ textAlign: "center", padding: 48 }}>
              <Text type="secondary">该课程暂无实验项目</Text>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
            <Table
              dataSource={experiments}
              rowKey="id"
              size={isMobile ? 'small' : 'middle'}
              scroll={{ x: isMobile ? 600 : undefined }}
              pagination={{
                pageSize: isMobile ? 5 : 10,
                showSizeChanger: false,
              }}
              columns={[
                {
                  title: "实验名称",
                  dataIndex: "title",
                  key: "title",
                  render: (text: string) => (
                    <Tooltip title={text} mouseEnterDelay={0.3}>
                      <Text strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{text}</Text>
                    </Tooltip>
                  ),
                },
                {
                  title: "类型",
                  dataIndex: "experimentType",
                  key: "experimentType",
                  width: 100,
                  align: "center",
                  render: (type: "online" | "offline") => (
                    <Tag color={type === "online" ? "processing" : "success"}>
                      {getExperimentTypeLabel(type)}
                    </Tag>
                  ),
                },
                {
                  title: "难度",
                  dataIndex: "difficultyLevel",
                  key: "difficultyLevel",
                  width: 80,
                  align: "center",
                  render: (level: "easy" | "medium" | "hard") => (
                    <Tag color={getDifficultyLevelColor(level)}>
                      {getDifficultyLevelLabel(level)}
                    </Tag>
                  ),
                },
                {
                  title: "时长",
                  dataIndex: "durationHours",
                  key: "durationHours",
                  width: 100,
                  align: "center",
                  render: (hours?: number) => `${hours || 0} 小时`,
                },
                {
                  title: "操作",
                  key: "action",
                  width: 100,
                  align: "center",
                  render: (_: unknown, record: Experiment) => (
                    <Button
                      type="link"
                      icon={<ArrowRightOutlined />}
                      onClick={() => navigate(`/dashboard/experiment-detail/${record.id}`)}
                    >
                      查看
                    </Button>
                  ),
                },
              ]}
            />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
