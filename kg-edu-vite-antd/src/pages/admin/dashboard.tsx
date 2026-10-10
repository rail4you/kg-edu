import { useMemo } from "react";
import { Table, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  UserOutlined,
  TeamOutlined,
  ClusterOutlined,
  BankOutlined,
} from "@ant-design/icons";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { getUsersFromTenant, listClasses, getTenantUserCounts } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { getAdminDashboardItems } from "@/layouts/admin-menu-config";
import { useResponsive } from "@/hooks/use-responsive";
import { PageHead, StatGrid, ProtoCard } from "@/components/proto";

const { Text } = Typography;

interface TenantUser {
  id: string;
  role?: string | null;
}

interface ResultList<T> {
  results?: T[];
}

interface TenantUserCount {
  schema_name: string;
  name: string;
  total: number;
  super_admin: number;
  admin: number;
  teacher: number;
  student: number;
}

/* ── 统计卡片配置 ── */
interface StatConfig {
  label: string;
  value: number;
  icon?: React.ReactNode;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const menuItems = useMemo(() => getAdminDashboardItems(user?.role), [user?.role]);
  const currentTenant = getCurrentTenant();
  const tenantId = currentTenant?.schemaName || currentTenant?.id;
  const { isMobile } = useResponsive();
  const isSuperAdmin = user?.role === "super_admin";

  const { data: usersResponse } = useQuery({
    queryKey: ["admin-users-count", tenantId],
    queryFn: () =>
      getUsersFromTenant({
        tenant: tenantId,
        fields: ["id", "role"],
        headers: getAuthHeaders(user),
      }),
    enabled: !!tenantId && !isSuperAdmin,
  });

  const { data: classesResponse } = useQuery({
    queryKey: ["admin-classes-count", tenantId],
    queryFn: () =>
      listClasses({
        tenant: tenantId,
        fields: ["id"],
        page: { limit: 1000, offset: 0 },
        headers: getAuthHeaders(user),
      }),
    enabled: !!tenantId && !!user && !isSuperAdmin,
  });

  const { data: tenantCountsResponse, isLoading: countsLoading } = useQuery({
    queryKey: ["admin-global-user-counts"],
    queryFn: () =>
      getTenantUserCounts({
        headers: getAuthHeaders(user),
      }),
    enabled: isSuperAdmin,
  });

  const users: TenantUser[] = usersResponse?.success
    ? Array.isArray(usersResponse.data)
      ? usersResponse.data
      : (usersResponse.data as ResultList<TenantUser>)?.results || []
    : [];

  const classes = classesResponse?.success
    ? Array.isArray(classesResponse.data)
      ? classesResponse.data
      : (classesResponse.data as ResultList<{ id: string }>)?.results || []
    : [];

  const tenantCounts = useMemo<TenantUserCount[]>(() => {
    if (!tenantCountsResponse?.success) return [];
    const data = tenantCountsResponse.data as { tenants?: TenantUserCount[] };
    return Array.isArray(data?.tenants) ? data.tenants : [];
  }, [tenantCountsResponse]);

  const globalTotals = useMemo(() => {
    return tenantCounts.reduce(
      (acc, c) => ({
        total: acc.total + (c.total || 0),
        admin: acc.admin + (c.admin || 0),
        teacher: acc.teacher + (c.teacher || 0),
        student: acc.student + (c.student || 0),
        super_admin: acc.super_admin + (c.super_admin || 0),
      }),
      { total: 0, admin: 0, teacher: 0, student: 0, super_admin: 0 },
    );
  }, [tenantCounts]);

  const tenantCount = useMemo(
    () => tenantCounts.filter((t) => t.schema_name !== "public").length,
    [tenantCounts],
  );

  const adminCount = users.filter((u) => u.role === "admin").length;
  const teacherCount = users.filter((u) => u.role === "teacher").length;
  const studentCount = users.filter((u) => u.role === "user").length;
  const superAdminCount = users.filter((u) => u.role === "super_admin").length;

  /* ── 统计数据 ── */
  const statCards: StatConfig[] = isSuperAdmin
    ? [
        { label: "总用户", value: globalTotals.total, icon: <UserOutlined /> },
        { label: "管理员", value: globalTotals.admin, icon: <UserOutlined /> },
        { label: "教师", value: globalTotals.teacher, icon: <TeamOutlined /> },
        { label: "学生", value: globalTotals.student, icon: <UserOutlined /> },
        { label: "超级管理员", value: globalTotals.super_admin, icon: <BankOutlined /> },
        { label: "租户", value: tenantCount, icon: <ClusterOutlined /> },
      ]
    : [
        { label: "总用户", value: users.length, icon: <UserOutlined /> },
        { label: "管理员", value: adminCount, icon: <UserOutlined /> },
        { label: "教师", value: teacherCount, icon: <TeamOutlined /> },
        { label: "学生", value: studentCount, icon: <UserOutlined /> },
        { label: "超级管理员", value: superAdminCount, icon: <BankOutlined /> },
        { label: "班级", value: classes.length, icon: <ClusterOutlined /> },
      ];

  const tenantColumns: ColumnsType<TenantUserCount> = [
    {
      title: "租户",
      dataIndex: "name",
      key: "name",
      render: (name, record) => <Text strong>{name || record.schema_name}</Text>,
    },
    {
      title: "管理员",
      dataIndex: "admin",
      key: "admin",
      width: 100,
      align: "center",
    },
    {
      title: "教师",
      dataIndex: "teacher",
      key: "teacher",
      width: 100,
      align: "center",
    },
    {
      title: "学生",
      dataIndex: "student",
      key: "student",
      width: 100,
      align: "center",
    },
    {
      title: "超级管理员",
      dataIndex: "super_admin",
      key: "super_admin",
      width: 100,
      align: "center",
    },
    {
      title: "总用户",
      dataIndex: "total",
      key: "total",
      width: 100,
      align: "center",
      render: (total) => <Text strong style={{ color: "#2859df" }}>{total}</Text>,
    },
  ];

  return (
    <div style={{ padding: isMobile ? 12 : "20px 24px 40px" }}>
      <PageHead
        title="管理控制台"
        description="查看管理员常用入口和系统概览"
      />

      <StatGrid
        columns={isMobile ? 2 : 3}
        items={statCards.map((s) => ({ label: s.label, value: s.value, icon: s.icon }))}
      />

      {isSuperAdmin && (
        <ProtoCard
          title="各租户用户汇总"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>全局总用户: {globalTotals.total}</Text>}
          className="pu-card--flush"
          style={{ marginBottom: 24 }}
        >
          <div className="pu-table-wrap" style={{ padding: "0 24px 8px" }}>
            <Table<TenantUserCount>
              columns={tenantColumns}
              dataSource={tenantCounts}
              rowKey="schema_name"
              loading={countsLoading}
              size={isMobile ? "small" : "middle"}
              pagination={false}
              scroll={{ x: 480 }}
              summary={() => (
                <Table.Summary.Row style={{ background: "#f6f8fc" }}>
                  <Table.Summary.Cell index={0}>
                    <Text strong>合计</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={1} align="center">
                    <Text strong>{globalTotals.admin}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2} align="center">
                    <Text strong>{globalTotals.teacher}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="center">
                    <Text strong>{globalTotals.student}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={4} align="center">
                    <Text strong>{globalTotals.super_admin}</Text>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5} align="center">
                    <Text strong style={{ color: "#2859df" }}>{globalTotals.total}</Text>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </div>
        </ProtoCard>
      )}

      <div className="pu-section-title" style={{ marginBottom: 16 }}>功能模块</div>

      <div
        className="pu-grid"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${isMobile ? 150 : 260}px, 1fr))`,
          gap: isMobile ? 10 : 16,
        }}
      >
        {menuItems.map((item) => (
          <div
            key={item.path}
            onClick={() => navigate(item.path)}
            className="pu-card"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: isMobile ? "12px 14px" : "16px 18px",
              cursor: "pointer",
              transition: "border-color 0.2s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#c7d8fb";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--pu-line)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              style={{
                width: isMobile ? 36 : 48,
                height: isMobile ? 36 : 48,
                borderRadius: 11,
                background: "#edf2ff",
                color: "var(--pu-blue)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                fontSize: isMobile ? 16 : 22,
              }}
            >
              {item.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--pu-ink)",
                  lineHeight: 1.3,
                  marginBottom: 2,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {item.name}
              </div>
              {!isMobile && (
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--pu-muted)",
                    lineHeight: 1.4,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {item.description}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
