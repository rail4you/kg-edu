import * as React from "react";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card, Button, Typography, Spin, Select, message, Row, Col, Table, Tag, Statistic,
} from "antd";
import { ArrowLeftOutlined, ReloadOutlined, CameraOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { AppPage } from "@/components/proto";

const { Text } = Typography;

interface Exam {
  id: string;
  title: string;
  status: "ongoing" | "finished";
  student_count: number;
  invigilator: string;
  room: string;
}

interface Snapshot {
  id: string;
  exam_id: string;
  checkpoint: string;
  student_id: string;
  student_name: string;
  student_email: string;
  seat: string;
  confidence: number;
  status: string;
  captured_at: string;
}

export default function FaceCheck() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const currentTenant = getCurrentTenant();
  const tenant = currentTenant?.schemaName || "";
  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { "x-org-schema": tenant };
    const token = (user as any)?.token;
    if (token) h["authorization"] = `Bearer ${token}`;
    return h;
  }, [user, tenant]);

  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);

  const examsQuery = useQuery({
    queryKey: ["proctor-exams", tenant],
    queryFn: async () => {
      const r = await fetch("/api/proctor/exams", { headers: authHeaders }).then((x) => x.json());
      if (!r.success) throw new Error(r.error);
      return r.data as Exam[];
    },
  });

  useEffect(() => {
    if (!selectedExamId && examsQuery.data && examsQuery.data.length > 0) {
      setSelectedExamId(examsQuery.data[0].id);
    }
  }, [examsQuery.data, selectedExamId]);

  const selectedExam = useMemo(
    () => examsQuery.data?.find((e) => e.id === selectedExamId) ?? null,
    [examsQuery.data, selectedExamId]
  );

  const snapshotsQuery = useQuery({
    queryKey: ["proctor-snapshots", selectedExamId],
    enabled: !!selectedExamId,
    queryFn: async () => {
      const r = await fetch(`/api/proctor/exams/${selectedExamId}/snapshots`, {
        headers: authHeaders,
      }).then((x) => x.json());
      if (!r.success) throw new Error(r.error);
      return r.data as Snapshot[];
    },
  });

  const snapshots = snapshotsQuery.data ?? [];

  if (authLoading) {
    return (
      <AppPage title="AI 考试监考抓拍" description="加载中">
        <div style={{ display: "flex", justifyContent: "center", padding: 48 }}>
          <Spin size="large" />
        </div>
      </AppPage>
    );
  }

  return (
    <AppPage
      title="AI 考试监考抓拍"
      description="基于实时摄像头 + AI 行为识别的考试监考平台"
      actions={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            examsQuery.refetch();
            snapshotsQuery.refetch();
            message.success("已刷新");
          }}
        />
      }
    >
      {/* 顶部：考试选择 + 元信息 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} md={12} lg={10}>
            <Text type="secondary" style={{ fontSize: 12 }}>选择监考考试</Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              value={selectedExamId ?? undefined}
              onChange={setSelectedExamId}
              loading={examsQuery.isLoading}
              placeholder="请选择一场考试"
              options={(examsQuery.data ?? []).map((e) => ({
                value: e.id,
                label: `${e.title}（${e.status === "ongoing" ? "进行中" : "已结束"}）`,
              }))}
            />
          </Col>
          {selectedExam && (
            <>
              <Col xs={8} md={4} lg={3}>
                <Statistic title="考生人数" value={selectedExam.student_count} suffix="人" valueStyle={{ fontSize: 18 }} />
              </Col>
              <Col xs={8} md={4} lg={3}>
                <Statistic title="抓拍记录" value={snapshots.length} suffix="条" valueStyle={{ fontSize: 18 }} />
              </Col>
              <Col xs={8} md={4} lg={4}>
                <Statistic title="考场" value={selectedExam.room} valueStyle={{ fontSize: 18 }} />
              </Col>
              <Col xs={24} md={24} lg={7}>
                <Text type="secondary" style={{ fontSize: 12 }}>监考教师</Text>
                <div style={{ fontSize: 16, fontWeight: 500 }}>{selectedExam.invigilator}</div>
              </Col>
            </>
          )}
        </Row>
      </Card>

      {/* 抓拍记录表格 */}
      <Card
        title={
          <span>
            <CameraOutlined /> 抓拍记录
            {selectedExam && (
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8, fontWeight: "normal" }}>
                · {selectedExam.title}
              </Text>
            )}
          </span>
        }
        size="small"
        bodyStyle={{ padding: 0 }}
      >
        <Table
          size="middle"
          rowKey="id"
          loading={snapshotsQuery.isLoading}
          dataSource={snapshots}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
          scroll={{ x: 800 }}
          columns={[
            {
              title: "抓拍时间",
              dataIndex: "captured_at",
              width: 170,
              render: (v: string) => new Date(v).toLocaleString("zh-CN", { hour12: false }),
            },
            {
              title: "节点",
              dataIndex: "checkpoint",
              width: 100,
              render: (v: string) => <Tag color="blue">{v}</Tag>,
            },
            {
              title: "学生",
              dataIndex: "student_name",
              width: 120,
              render: (v: string, row: Snapshot) => <Text strong>{v}</Text>,
            },
            {
              title: "邮箱",
              dataIndex: "student_email",
              ellipsis: true,
            },
            {
              title: "座位",
              dataIndex: "seat",
              width: 80,
            },
            {
              title: "置信度",
              dataIndex: "confidence",
              width: 100,
              sorter: (a: Snapshot, b: Snapshot) => a.confidence - b.confidence,
              render: (v: number) => `${v}%`,
            },
            {
              title: "状态",
              dataIndex: "status",
              width: 100,
              render: () => <Tag color="green">正常作答</Tag>,
            },
          ]}
        />
      </Card>
    </AppPage>
  );
}