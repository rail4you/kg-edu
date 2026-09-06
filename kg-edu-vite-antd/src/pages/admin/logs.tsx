import { useState, useMemo, useCallback } from "react";
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Typography,
  Input,
  Select,
  Row,
  Col,
  App,
  DatePicker,
} from "antd";
import { ReloadOutlined, DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { useAuth } from "@/auth/auth-context";
import { listActivityLogs, listActivityLogsByTimeRange } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant, hasTenant } from "@/lib/tenant";
import { fetchAcrossTenants } from "@/lib/tenant-query";
import { useTenantFilter } from "@/hooks/use-tenant-filter";
import { TenantLayout } from "@/components/admin/tenant-layout";
import { Alert } from "antd";
import { MobileTableCard } from "@/components/admin/mobile-table-card";
import { useResponsive } from "@/hooks/use-responsive";

const { Title, Text } = Typography;

// ── Types ───────────────────────────────────────────────────────────

interface LogEntry {
  id: string;
  timestamp: string;
  actionType: string;
  resourceType: string;
  userId: string;
  userName: string;
  /** 来源租户 schema */
  tenant: string;
}

interface AshActivityLog {
  id: string;
  userId: string;
  actionType: string;
  resourceType: string;
  resourceId: string;
  insertedAt: string;
  _tenant?: string;
  user?: { memberId?: string; name?: string };
}

type TimePreset = "all" | "today" | "yesterday" | "week" | "month" | "custom";

// ── Constants ───────────────────────────────────────────────────────

const actionTypeLabels: Record<string, { label: string; color: string }> = {
  file_view: { label: "查看文件", color: "blue" },
  video_view: { label: "观看视频", color: "cyan" },
  exercise_submit: { label: "提交练习", color: "green" },
  homework_submit: { label: "提交作业", color: "purple" },
  mm_video_view: { label: "微专业-看视频", color: "geekblue" },
  mm_exercise_submit: { label: "微专业-练习", color: "lime" },
  mm_resource_download: { label: "资源下载", color: "orange" },
};

const resourceTypeLabels: Record<string, string> = {
  File: "文件",
  Video: "视频",
  Exercise: "练习",
  Homework: "作业",
  MicroMajorVideo: "微专业视频",
  MicroMajorExercise: "微专业练习",
  MicroMajorResource: "微专业资源",
  Course: "课程",
  Chapter: "章节",
  KnowledgeResource: "知识资源",
  Experiment: "实验",
};

const logLevels = [
  { value: "ALL", label: "全部类型" },
  ...Object.entries(actionTypeLabels).map(([value, { label }]) => ({ value, label })),
];

const TIME_PRESET_OPTIONS: { value: TimePreset; label: string }[] = [
  { value: "all", label: "全部时间" },
  { value: "today", label: "今天" },
  { value: "yesterday", label: "昨天" },
  { value: "week", label: "近一周" },
  { value: "month", label: "近一月" },
  { value: "custom", label: "自定义" },
];

// ── Helpers ─────────────────────────────────────────────────────────

const transformLog = (log: AshActivityLog): LogEntry => ({
  id: log.id,
  timestamp: log.insertedAt,
  actionType: log.actionType,
  resourceType: resourceTypeLabels[log.resourceType] || log.resourceType || "—",
  userId: log.userId,
  userName: log.user?.name || log.user?.memberId || log.userId?.slice(0, 8) || "—",
  tenant: log._tenant || "",
});

const formatTime = (ts: string) => {
  try {
    const d = new Date(ts);
    return d.toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return ts;
  }
};

/**
 * 计算时间窗口的 [startDate, endDate) 边界（endDate 为闭区间取值的次日，即包含整个结束日）。
 * 返回 null 表示「全部时间」。
 */
function computeDateRange(preset: TimePreset, customRange: [Dayjs, Dayjs] | null) {
  const today = dayjs().startOf("day");
  const fmt = (d: Dayjs) => d.format("YYYY-MM-DD");
  switch (preset) {
    case "today":
      return { start: fmt(today), end: fmt(today.add(1, "day")) };
    case "yesterday":
      return { start: fmt(today.subtract(1, "day")), end: fmt(today) };
    case "week":
      return { start: fmt(today.subtract(6, "day")), end: fmt(today.add(1, "day")) };
    case "month":
      return { start: fmt(today.subtract(29, "day")), end: fmt(today.add(1, "day")) };
    case "custom":
      if (!customRange) return null;
      return {
        start: fmt(customRange[0].startOf("day")),
        end: fmt(customRange[1].add(1, "day")),
      };
    default:
      return null;
  }
}

// ── Component ───────────────────────────────────────────────────────

export default function SystemLogs() {
  const { message } = App.useApp();
  const { user } = useAuth();
  const { isMobile } = useResponsive();
  const {
    isSuperAdmin,
    organizations,
    tenantOptions,
    selectedTenantId,
    setSelectedTenantId,
    queryTenants,
  } = useTenantFilter("total");

  const currentTenant = getCurrentTenant();

  // schemaName → 组织名称；普通管理员用自己的当前租户名
  const tenantNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    organizations.forEach((o) => {
      map[o.schemaName] = o.name;
    });
    if (currentTenant?.name) {
      const key = currentTenant.schemaName || currentTenant.id || "";
      if (key) map[key] = currentTenant.name;
    }
    return map;
  }, [organizations, currentTenant]);

  const resolveTenantName = useCallback(
    (schema: string) => tenantNameMap[schema] || schema,
    [tenantNameMap],
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("ALL");
  const [timePreset, setTimePreset] = useState<TimePreset>("all");
  const [customRange, setCustomRange] = useState<[Dayjs, Dayjs] | null>(null);

  const dateRange = useMemo(
    () => computeDateRange(timePreset, customRange),
    [timePreset, customRange],
  );

  const handlePresetChange = (value: TimePreset) => {
    setTimePreset(value);
    if (value === "custom" && !customRange) {
      const today = dayjs().startOf("day");
      setCustomRange([today, today]);
    }
  };

  const { data: logsData, isLoading, refetch } = useQuery({
    queryKey: [
      "activity-logs",
      queryTenants,
      dateRange ? `${dateRange.start}|${dateRange.end}` : "all",
    ],
    queryFn: () =>
      fetchAcrossTenants<AshActivityLog>(queryTenants, (tenant) => {
        const fields = [
          "id",
          "userId",
          "actionType",
          "resourceType",
          "resourceId",
          "insertedAt",
          { user: ["name", "memberId"] },
        ];
        const headers = getAuthHeaders(user);
        if (dateRange) {
          // 精确按日期窗口统计（返回窗口内全部记录）
          return listActivityLogsByTimeRange({
            tenant,
            input: { startDate: dateRange.start, endDate: dateRange.end },
            fields,
            sort: "-insertedAt",
            headers,
          });
        }
        // 全部时间：取每个租户最新 500 条
        return listActivityLogs({
          tenant,
          fields,
          sort: "-insertedAt",
          page: { limit: 500, offset: 0 },
          headers,
        });
      }),
    enabled: queryTenants.length > 0,
    refetchInterval: 30_000,
  });

  const logs: LogEntry[] = useMemo(() => {
    return (logsData || []).map(transformLog);
  }, [logsData]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm ||
        log.actionType.toLowerCase().includes(q) ||
        log.resourceType.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.userId.toLowerCase().includes(q) ||
        resolveTenantName(log.tenant).toLowerCase().includes(q);

      const matchesType = selectedType === "ALL" || log.actionType === selectedType;

      return matchesSearch && matchesType;
    });
  }, [logs, searchTerm, selectedType, resolveTenantName]);

  const stats = useMemo(() => {
    const byType: Record<string, number> = {};
    filteredLogs.forEach((l) => {
      byType[l.actionType] = (byType[l.actionType] || 0) + 1;
    });
    return byType;
  }, [filteredLogs]);

  const handleExportLogs = useCallback(() => {
    const csvContent = [
      ["时间", "操作类型", "资源类型", "租户", "用户", "用户ID"],
      ...filteredLogs.map((log) => [
        log.timestamp,
        log.actionType,
        log.resourceType,
        resolveTenantName(log.tenant),
        log.userName,
        log.userId,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-logs-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    message.success("日志导出成功");
  }, [filteredLogs, resolveTenantName, message]);

  const columns: ColumnsType<LogEntry> = [
    {
      title: "时间", dataIndex: "timestamp", key: "timestamp", width: 160,
      render: (ts) => <Text style={{ fontSize: 13 }}>{formatTime(ts)}</Text>,
    },
    {
      title: "操作", dataIndex: "actionType", key: "actionType", width: 110,
      render: (at) => {
        const info = actionTypeLabels[at];
        return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{at}</Tag>;
      },
    },
    {
      title: "资源", dataIndex: "resourceType", key: "resourceType", width: 120,
      render: (rt) => <Tag>{rt}</Tag>,
    },
    {
      title: "租户", dataIndex: "tenant", key: "tenant", width: 140,
      render: (schema) => <Text style={{ fontSize: 13 }}>{resolveTenantName(schema)}</Text>,
    },
    {
      title: "用户", key: "user", width: 150,
      render: (_, r) => (
        <div>
          <Text>{r.userName}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 11 }}>{r.userId?.slice(0, 12)}...</Text>
        </div>
      ),
    },
  ];

  if (!hasTenant() && !isSuperAdmin) {
    return (
      <Card>
        <Alert
          message="需要选择组织"
          description="请先在组织管理页面选择一个组织，然后返回此页面查看活动日志。"
          type="info"
          showIcon
        />
      </Card>
    );
  }

  return (
    <TenantLayout
      tenants={tenantOptions}
      selected={selectedTenantId}
      onSelect={setSelectedTenantId}
    >
    <div>
      {/* Stats cards */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={4}>
          <Card size="small">
            <Text type="secondary" style={{ fontSize: isMobile ? 11 : 14 }}>
              总记录
            </Text>
            <Title level={isMobile ? 5 : 3} style={{ margin: 0 }}>
              {filteredLogs.length}
            </Title>
          </Card>
        </Col>
        {Object.entries(actionTypeLabels).slice(0, isMobile ? 3 : 5).map(([key, { label, color }]) => (
          <Col xs={12} sm={4} key={key}>
            <Card size="small">
              <Text type="secondary" style={{ fontSize: isMobile ? 11 : 14 }}>
                {label}
              </Text>
              <Title level={isMobile ? 5 : 3} style={{ margin: 0, color }}>
                {stats[key] || 0}
              </Title>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: isMobile ? 12 : 24 } }}>
        <Row gutter={[8, 8]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="搜索用户名、用户ID、资源类型、租户..."
              prefix={<SearchOutlined />}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              style={{ width: "100%" }}
              value={selectedType}
              onChange={setSelectedType}
              options={logLevels.map((l) => ({ value: l.value, label: l.label }))}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              style={{ width: "100%" }}
              value={timePreset}
              onChange={handlePresetChange}
              options={TIME_PRESET_OPTIONS}
            />
          </Col>
          {timePreset === "custom" && (
            <Col xs={24} md={12}>
              <DatePicker.RangePicker
                value={customRange}
                onChange={(dates) =>
                  setCustomRange((dates as [Dayjs, Dayjs] | null) ?? null)
                }
                allowClear={false}
                style={{ width: "100%" }}
              />
            </Col>
          )}
        </Row>
      </Card>

      {/* Table */}
      <Card styles={{ body: { padding: isMobile ? 12 : 24 } }}>
        {isMobile && (
          <div style={{ marginBottom: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => refetch()}>
              刷新
            </Button>
            <Button size="small" type="primary" icon={<DownloadOutlined />} onClick={handleExportLogs}>
              导出
            </Button>
          </div>
        )}
        {!isMobile && (
          <Table
            columns={columns}
            dataSource={filteredLogs}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 950 }}
            title={() => (
              <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
                <Space wrap>
                  <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
                    刷新
                  </Button>
                  <Button type="primary" icon={<DownloadOutlined />} onClick={handleExportLogs}>
                    导出
                  </Button>
                </Space>
              </div>
            )}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total) => `共 ${total} 条`,
              defaultPageSize: 20,
              pageSizeOptions: ["20", "50", "100"],
              size: "small",
            }}
          />
        )}

        {isMobile && (
          <MobileTableCard<LogEntry>
            dataSource={filteredLogs}
            loading={isLoading}
            title={(r) => r.userName}
            subtitle={(r) => r.userId?.slice(0, 12)}
            extra={(r) => {
              const info = actionTypeLabels[r.actionType];
              return info ? <Tag color={info.color}>{info.label}</Tag> : <Tag>{r.actionType}</Tag>;
            }}
            fields={(r) => [
              { label: "时间", value: <Text style={{ fontSize: 12 }}>{formatTime(r.timestamp)}</Text> },
              { label: "租户", value: <Text style={{ fontSize: 12 }}>{resolveTenantName(r.tenant)}</Text> },
              { label: "资源", value: <Tag>{r.resourceType}</Tag> },
            ]}
          />
        )}

        {isMobile && (
          <div style={{ textAlign: "center", marginTop: 12, color: "#999", fontSize: 12 }}>
            共 {filteredLogs.length} 条记录
          </div>
        )}
      </Card>
    </div>
    </TenantLayout>
  );
}