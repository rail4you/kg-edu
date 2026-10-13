import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Empty, Space, Spin, Table, Tag, Typography } from "antd";
import { ArrowLeftOutlined, ClockCircleOutlined } from "@ant-design/icons";
import { AppPage, ProtoCard } from "@/components/proto";
import { useAuth } from "@/auth/auth-context";
import { getCurrentTenant } from "@/lib/tenant";
import { getAuthHeaders } from "@/lib/auth";
import { listActivityLogsByDay } from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";

const { Text } = Typography;

const ACTION_LABEL: Record<string, string> = {
  file_view: "查看文件",
  video_view: "观看视频",
  exercise_submit: "提交练习",
  homework_submit: "提交作业",
  mm_video_view: "观看微专业视频",
  mm_exercise_submit: "提交微专业练习",
  mm_resource_download: "下载微专业资源",
  notice: "通知",
};

interface ActivityRow {
  id: string;
  userId: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any> | null;
  insertedAt: string;
  user?: { id: string; name?: string; email?: string } | null;
}

export default function TeacherActivityLogs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const tenant = getCurrentTenant()?.schemaName || "";
  const [searchParams] = useSearchParams();
  const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

  const { start, end } = useMemo(() => {
    const d = new Date(`${date}T00:00:00Z`);
    const next = new Date(d.getTime() + 24 * 3600 * 1000);
    return { start: d.toISOString(), end: next.toISOString() };
  }, [date]);

  const logsQuery = useQuery({
    queryKey: ["activity-logs-day", tenant, date],
    enabled: !!tenant,
    queryFn: async () => {
      const r = await listActivityLogsByDay({
        tenant,
        input: { start, end },
        fields: [
          "id",
          "userId",
          "actionType",
          "resourceType",
          "resourceId",
          "metadata",
          "insertedAt",
          { user: ["id", "name", "email"] },
        ],
        headers: getAuthHeaders(user),
      });
      return extractArrayData(r) as ActivityRow[];
    },
  });

  const logs = logsQuery.data ?? [];

  const studentCount = useMemo(() => new Set(logs.map((l) => l.userId)).size, [logs]);

  const displayName = (r: ActivityRow) =>
    r.user?.name || r.user?.email?.split("@")[0] || (r.userId ? `用户 ${r.userId.slice(0, 8)}` : "未知");

  return (
    <AppPage
      title={`学习记录 · ${date}`}
      description="该日期内学生的学习活动明细"
      breadcrumb={<>智慧课程&nbsp;&nbsp;/&nbsp;&nbsp;教师工作台&nbsp;&nbsp;/&nbsp;&nbsp;学习记录</>}
      actions={
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      }
    >
      <ProtoCard>
        {logsQuery.isLoading ? (
          <div style={{ textAlign: "center", padding: 48 }}>
            <Spin />
          </div>
        ) : logs.length === 0 ? (
          <Empty description={`${date} 暂无学习活动记录`} image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ margin: "24px 0" }} />
        ) : (
          <>
            <div style={{ marginBottom: 12, color: "#64748b", fontSize: 13 }}>
              共 {logs.length} 条活动 · {studentCount} 名学生
            </div>
            <Table
              rowKey="id"
              dataSource={logs}
              pagination={{ pageSize: 15 }}
              scroll={{ x: 820 }}
              columns={[
                {
                  title: "时间",
                  dataIndex: "insertedAt",
                  width: 180,
                  render: (v: string) => (
                    <Space size={6}>
                      <ClockCircleOutlined style={{ color: "#94a3b8" }} />
                      {new Date(v).toLocaleString("zh-CN", { hour12: false })}
                    </Space>
                  ),
                },
                {
                  title: "学生",
                  key: "student",
                  width: 160,
                  render: (_: any, r: ActivityRow) => <Text strong>{displayName(r)}</Text>,
                },
                {
                  title: "行为",
                  dataIndex: "actionType",
                  width: 160,
                  render: (v: string) => <Tag color="blue">{ACTION_LABEL[v] || v}</Tag>,
                },
                {
                  title: "资源类型",
                  dataIndex: "resourceType",
                  width: 160,
                  render: (v: string) => v || "-",
                },
              ]}
            />
          </>
        )}
      </ProtoCard>
    </AppPage>
  );
}
