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
import { AppPage, ProtoCard, ProtoTabs, ProtoEmpty } from "@/components/proto";

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
  const [subtab, setSubtab] = useState("all");

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
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;人脸抓拍</>}
      actions={
        <Button
          icon={<ReloadOutlined />}
          onClick={() => {
            examsQuery.refetch();
            snapshotsQuery.refetch();
            message.success("已刷新");
          }}
        >
          刷新
        </Button>
      }
    >
      <ProtoCard>
        <ProtoTabs
          items={[
            { id: "all", label: "全部记录" },
            { id: "recent", label: "最近更新" },
          ]}
          active={subtab}
          onChange={setSubtab}
        />
        <div className="pu-filters">
          <Select
            style={{ width: 320 }}
            value={selectedExamId ?? undefined}
            onChange={setSelectedExamId}
            loading={examsQuery.isLoading}
            placeholder="请选择一场考试"
            options={(examsQuery.data ?? []).map((e) => ({
              value: e.id,
              label: `${e.title}（${e.status === "ongoing" ? "进行中" : "已结束"}）`,
            }))}
          />
        </div>

        {selectedExam && (
          <div
            style={{
              display: "flex",
              gap: 32,
              flexWrap: "wrap",
              marginBottom: 16,
              padding: "12px 16px",
              background: "#f6f8fc",
              borderRadius: 10,
            }}
          >
            <Statistic title="考生人数" value={selectedExam.student_count} suffix="人" valueStyle={{ fontSize: 18 }} />
            <Statistic title="抓拍记录" value={snapshots.length} suffix="条" valueStyle={{ fontSize: 18 }} />
            <Statistic title="考场" value={selectedExam.room} valueStyle={{ fontSize: 18 }} />
            <Statistic title="监考教师" value={selectedExam.invigilator} valueStyle={{ fontSize: 18 }} />
          </div>
        )}

        {!selectedExamId ? (
          <ProtoEmpty title="请选择考试" description="选择监考考试以查看抓拍记录。" />
        ) : snapshots.length === 0 ? (
          <ProtoEmpty title="暂无抓拍记录" description="该考试暂无可展示的抓拍记录。" />
        ) : (
          <>
            <Table
              size="middle"
              rowKey="id"
              loading={snapshotsQuery.isLoading}
              dataSource={snapshots}
              pagination={false}
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
                  render: (v: string) => <Text strong>{v}</Text>,
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
            <div className="pu-table-footer">
              <span>共 {snapshots.length} 条</span>
            </div>
          </>
        )}
      </ProtoCard>
    </AppPage>
  );
}