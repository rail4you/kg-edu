import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  Empty,
  Spin,
  Tag,
  Timeline,
  Typography,
  Select,
  Space,
} from "antd";
import {
  VideoCameraOutlined,
  FileTextOutlined,
  FileOutlined,
  ClockCircleOutlined,
  ApartmentOutlined,
} from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import {
  myMicroMajorEnrollments,
  listActivityLogsByUser,
} from "@/lib/ash_rpc";
import { extractArrayData } from "@/utils/api-helpers";

const { Title, Text } = Typography;

const ACTION_ICONS: Record<string, React.ReactNode> = {
  mm_video_view: <VideoCameraOutlined style={{ color: "#722ed1" }} />,
  mm_exercise_submit: <FileTextOutlined style={{ color: "#52c41a" }} />,
  mm_resource_download: <FileOutlined style={{ color: "#1890ff" }} />,
};

const ACTION_LABELS: Record<string, string> = {
  mm_video_view: "观看了视频",
  mm_exercise_submit: "完成了习题",
  mm_resource_download: "下载了资源",
};

const ACTION_COLORS: Record<string, string> = {
  mm_video_view: "#722ed1",
  mm_exercise_submit: "#52c41a",
  mm_resource_download: "#1890ff",
};

interface ActivityItem {
  id: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  microMajorCourseTitle?: string | null;
  microMajorName?: string | null;
  metadata?: Record<string, any> | null;
  insertedAt?: string;
}

export default function StudentMMTimeline() {
  const { user, tenant } = useAuth();
  const headers = getAuthHeaders(user) as Record<string, string>;
  const [selectedMMId, setSelectedMMId] = useState<string | null>(null);

  // Fetch user enrollments for filter
  const { data: enrollments = [] } = useQuery({
    queryKey: ["timeline-enrollments", tenant, user?.id],
    queryFn: async () => {
      const result = await myMicroMajorEnrollments({
        tenant: tenant!,
        fields: ["id", "microMajorId", { microMajor: ["id", "name"] }],
        headers,
      });
      return extractArrayData(result) as Array<{ id: string; microMajorId: string; microMajor?: { id: string; name: string } }>;
    },
    enabled: !!tenant && !!user,
  });

  // Fetch activities
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["mm-timeline", tenant, user?.id, selectedMMId],
    queryFn: async () => {
      if (!user) return [];
      const filter: any = {
        actionType: { in: ["mm_video_view", "mm_exercise_submit", "mm_resource_download"] },
      };
      if (selectedMMId) {
        filter.microMajorId = { eq: selectedMMId };
      }
      const result = await listActivityLogsByUser({
        tenant: tenant!,
        input: { userId: user.id },
        fields: [
          "id", "actionType", "resourceType", "resourceId",
          "microMajorCourseTitle", "microMajorName",
          "metadata", "insertedAt",
        ],
        filter,
        sort: "-insertedAt",
        headers,
      });
      if (result.success && result.data) {
        const data = result.data;
        // handle paginated results
        const items = Array.isArray(data) ? data : (data as any)?.results || [];
        return items as ActivityItem[];
      }
      return [];
    },
    enabled: !!tenant && !!user,
  });

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};
    for (const item of activities) {
      const date = item.insertedAt ? new Date(item.insertedAt).toLocaleDateString("zh-CN") : "未知日期";
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    }
    return groups;
  }, [activities]);

  const mmOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const enr of enrollments) {
      if (enr.microMajor) {
        map.set(enr.microMajor.id, enr.microMajor);
      }
    }
    return Array.from(map.values());
  }, [enrollments]);

  return (
    <div style={{ padding: "24px 0" }}>
      <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Title level={3} style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
          <ClockCircleOutlined style={{ color: "#722ed1" }} />
          学习动态
        </Title>
        <Select
          style={{ minWidth: 200 }}
          placeholder="全部微专业"
          value={selectedMMId}
          onChange={setSelectedMMId}
          allowClear
          options={mmOptions.map(mm => ({ value: mm.id, label: mm.name }))}
        />
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", padding: 48 }}><Spin size="large" /></div>
      ) : activities.length === 0 ? (
        <Card>
          <Empty description="暂无学习记录，开始学习后记录会显示在此处" />
        </Card>
      ) : (
        <Card>
          {Object.entries(groupedByDate).map(([date, items]) => (
            <div key={date} style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#666",
                  marginBottom: 12,
                  paddingBottom: 8,
                  borderBottom: "1px solid #f0f0f0",
                }}
              >
                {date}
              </div>
              <Timeline
                items={items.map((item) => ({
                  color: ACTION_COLORS[item.actionType] || "#999",
                  dot: ACTION_ICONS[item.actionType] || undefined,
                  children: (
                    <div>
                      <Space>
                        <Tag color={ACTION_COLORS[item.actionType] || "default"}>
                          {ACTION_LABELS[item.actionType] || item.actionType}
                        </Tag>
                        {item.microMajorCourseTitle && (
                          <Text strong>{item.microMajorCourseTitle}</Text>
                        )}
                      </Space>
                      {item.microMajorName && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            <ApartmentOutlined style={{ marginRight: 4 }} />
                            {item.microMajorName}
                          </Text>
                        </div>
                      )}
                      {item.insertedAt && (
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(item.insertedAt).toLocaleTimeString("zh-CN")}
                          </Text>
                        </div>
                      )}
                      {item.actionType === "mm_exercise_submit" && item.metadata?.is_correct !== undefined && (
                        <div>
                          <Tag color={item.metadata.is_correct ? "success" : "error"}>
                            {item.metadata.is_correct ? "✓ 回答正确" : "✗ 回答错误"}
                          </Tag>
                        </div>
                      )}
                    </div>
                  ),
                }))}
              />
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
