import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import * as echarts from "echarts";
import { useRef, useEffect } from "react";
import { Card, Row, Col, Typography, Spin, Statistic, Empty, Button } from "antd";
import {
  BarChartOutlined,
  RiseOutlined,
  FallOutlined,
  LineChartOutlined,
  ArrowLeftOutlined
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { useParams , useNavigate } from "react-router-dom";
import { getStudentExamsByExam } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";

const { Title, Text } = Typography;

interface StatisticsData {
  summary: {
    totalStudents: number;
    submittedCount: number;
    avgScore: number;
    maxScore: number;
    minScore: number;
    passRate: number;
    excellentRate: number;
  };
  scoreDistribution: { range: string; count: number }[];
  questionStats: {
    questionId: string;
    question: string;
    avgScore: number;
    maxScore: number;
    accuracy: number;
  }[];
}

export default function ExamStatistics() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { examId } = useParams();
  const currentTenant = getCurrentTenant();
  const chartRef = useRef(null);

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["exam-statistics", examId],
    queryFn: async (): Promise<StatisticsData> => {
      const result = await getStudentExamsByExam({
        tenant: currentTenant?.schemaName || "",
        fields: ["id", "status", "score", "passed"],
        input: { examId: examId! },
        headers: getAuthHeaders(user) as Record<string, string>,
      });

      if (result.success && result.data) {
        const studentExams = result.data as any[];

        const submittedExams = studentExams.filter(
          (se: any) => se.status === "submitted" || se.status === "graded",
        );

        if (submittedExams.length === 0) {
          return {
            summary: {
              totalStudents: studentExams.length,
              submittedCount: 0,
              avgScore: 0,
              maxScore: 0,
              minScore: 0,
              passRate: 0,
              excellentRate: 0,
            },
            scoreDistribution: [],
            questionStats: [],
          };
        }

        const scores = submittedExams.map((se: any) => se.score);
        const avgScore =
          scores.reduce((sum: number, score: number) => sum + score, 0) /
          scores.length;
        const maxScore = Math.max(...scores);
        const minScore = Math.min(...scores);
        const passedCount = submittedExams.filter(
          (se: any) => se.passed,
        ).length;
        const passRate = (passedCount / submittedExams.length) * 100;
        const excellentCount = submittedExams.filter(
          (se: any) => se.score >= 90,
        ).length;
        const excellentRate = (excellentCount / submittedExams.length) * 100;

        const distribution = [
          {
            range: "0-59",
            count: submittedExams.filter((se: any) => se.score < 60).length,
          },
          {
            range: "60-69",
            count: submittedExams.filter(
              (se: any) => se.score >= 60 && se.score < 70,
            ).length,
          },
          {
            range: "70-79",
            count: submittedExams.filter(
              (se: any) => se.score >= 70 && se.score < 80,
            ).length,
          },
          {
            range: "80-89",
            count: submittedExams.filter(
              (se: any) => se.score >= 80 && se.score < 90,
            ).length,
          },
          {
            range: "90-100",
            count: submittedExams.filter((se: any) => se.score >= 90).length,
          },
        ];

        return {
          summary: {
            totalStudents: studentExams.length,
            submittedCount: submittedExams.length,
            avgScore: Math.round(avgScore * 10) / 10,
            maxScore,
            minScore,
            passRate: Math.round(passRate * 10) / 10,
            excellentRate: Math.round(excellentRate * 10) / 10,
          },
          scoreDistribution: distribution,
          questionStats: [],
        };
      }

      return {
        summary: {
          totalStudents: 0,
          submittedCount: 0,
          avgScore: 0,
          maxScore: 0,
          minScore: 0,
          passRate: 0,
          excellentRate: 0,
        },
        scoreDistribution: [],
        questionStats: [],
      };
    },
    enabled: !!examId && !!user,
  });

  useEffect(() => {
    if (!statsData || !chartRef.current) return;

    const chart = echarts.init(chartRef.current);
    const option = {
      title: { text: "成绩分布", left: "center" },
      tooltip: { trigger: "axis" },
      xAxis: {
        type: "category",
        data: statsData.scoreDistribution.map((d) => d.range),
      },
      yAxis: { type: "value", name: "人数" },
      series: [
        {
          data: statsData.scoreDistribution.map((d) => d.count),
          type: "bar",
          itemStyle: { color: "#1890ff" },
        },
      ],
    };
    chart.setOption(option);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      chart.dispose();
    };
  }, [statsData]);

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

  if (isLoading) {
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

  if (!statsData) {
    return (
      <div style={{ padding: 24, minHeight: "100vh", background: "#f5f5f5" }}>
        <Empty description="暂无数据" />
      </div>
    );
  }

  return (
    <div
      style={{ minHeight: "100vh", background: "#f5f5f5", paddingBottom: 24 }}
    >
      <div
        style={{
          padding: 24,
          background: "white",
          borderBottom: "1px solid #e0e0e0",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <Button
          className="teacher-page-back-btn"
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/teacher/dashboard")}
          style={{ color: "#1890ff", padding: "4px 8px", fontSize: 16 }}
        />
        <Title level={4} style={{ margin: 0, fontWeight: 700, color: "#333" }}>
          考试统计分析
        </Title>
      </div>

      <div className="exam-statistics-wrap" style={{ padding: 24 }}>
<style>{`@media(max-width:768px){.exam-statistics-wrap{padding:12px!important}.exam-statistics-wrap .ant-table-cell{padding:6px 4px!important}}`}</style>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="参考人数"
                value={statsData.summary.submittedCount}
                suffix={`/ ${statsData.summary.totalStudents}`}
                prefix={<BarChartOutlined style={{ color: "#1890ff" }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="平均分"
                value={statsData.summary.avgScore}
                valueStyle={{ color: "#1890ff" }}
                prefix={<LineChartOutlined style={{ color: "#1890ff" }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="及格率"
                value={statsData.summary.passRate}
                suffix="%"
                valueStyle={{ color: "#52c41a" }}
                prefix={<RiseOutlined style={{ color: "#52c41a" }} />}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card>
              <Statistic
                title="优秀率"
                value={statsData.summary.excellentRate}
                suffix="%"
                valueStyle={{ color: "#faad14" }}
                prefix={<RiseOutlined style={{ color: "#faad14" }} />}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} md={16}>
            <Card style={{ padding: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>
                成绩分布
              </Title>
              <div ref={chartRef} style={{ height: 400 }} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card style={{ padding: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>
                统计概览
              </Title>
              <div style={{ marginTop: 16 }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <Text>最高分:</Text>
                  <Text strong style={{ color: "#1890ff" }}>
                    {statsData.summary.maxScore}
                  </Text>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 16,
                  }}
                >
                  <Text>最低分:</Text>
                  <Text strong style={{ color: "#ff4d4f" }}>
                    {statsData.summary.minScore}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        </Row>

        {statsData.questionStats.length > 0 && (
          <Card style={{ padding: 24, marginTop: 24 }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              题目统计
            </Title>
            <div style={{ marginTop: 16 }}>
              {statsData.questionStats.map((q) => (
                <div
                  key={q.questionId}
                  style={{
                    marginBottom: 16,
                    padding: 16,
                    background: "#f5f5f5",
                    borderRadius: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      marginBottom: 8,
                    }}
                  >
                    <Text strong>{q.question}</Text>
                    <Text type="secondary">
                      平均分: {q.avgScore}/{q.maxScore}
                    </Text>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 16 }}
                  >
                    <div
                      style={{
                        flex: 1,
                        background: "#e0e0e0",
                        borderRadius: 8,
                        height: 8,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${q.accuracy}%`,
                          background: q.accuracy >= 60 ? "#52c41a" : "#ff4d4f",
                          height: "100%",
                        }}
                      />
                    </div>
                    <Text>{q.accuracy}%</Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
