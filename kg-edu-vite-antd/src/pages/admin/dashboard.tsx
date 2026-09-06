import { useMemo } from "react";
import { Row, Col, Typography, Table, Card } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  UserOutlined,
  TeamOutlined,
  ClusterOutlined,
  ArrowRightOutlined,
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

const { Title, Text } = Typography;

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
  color: string;
  bgColor: string;
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
        {
          label: "总用户",
          value: globalTotals.total,
          color: "#1677ff",
          bgColor: "#EEF2FF",
          icon: <UserOutlined />,
        },
        { label: "管理员", value: globalTotals.admin, color: "#eb2f96", bgColor: "#FDF2F8", icon: <UserOutlined /> },
        { label: "教师", value: globalTotals.teacher, color: "#1890ff", bgColor: "#EFF6FF", icon: <TeamOutlined /> },
        { label: "学生", value: globalTotals.student, color: "#52c41a", bgColor: "#F0FDF4", icon: <UserOutlined /> },
        { label: "超级管理员", value: globalTotals.super_admin, color: "#722ed1", bgColor: "#FAF5FF", icon: <BankOutlined /> },
        { label: "租户", value: tenantCount, color: "#13c2c2", bgColor: "#E6FFFB", icon: <ClusterOutlined /> },
      ]
    : [
        { label: "总用户", value: users.length, color: "#1677ff", bgColor: "#EEF2FF", icon: <UserOutlined /> },
        { label: "管理员", value: adminCount, color: "#eb2f96", bgColor: "#FDF2F8", icon: <UserOutlined /> },
        { label: "教师", value: teacherCount, color: "#1890ff", bgColor: "#EFF6FF", icon: <TeamOutlined /> },
        { label: "学生", value: studentCount, color: "#52c41a", bgColor: "#F0FDF4", icon: <UserOutlined /> },
        { label: "超级管理员", value: superAdminCount, color: "#722ed1", bgColor: "#FAF5FF", icon: <BankOutlined /> },
        { label: "班级", value: classes.length, color: "#faad14", bgColor: "#FFFBE6", icon: <ClusterOutlined /> },
      ];

  const tenantColumns: ColumnsType<TenantUserCount> = [
    {
      title: "租户",
      dataIndex: "name",
      key: "name",
      render: (name, record) => (
        <Text strong>{name || record.schema_name}</Text>
      ),
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
      render: (total) => <Text strong style={{ color: "#1677ff" }}>{total}</Text>,
    },
  ];

  return (
    <div style={{ padding: isMobile ? 0 : 24 }}>
      {/* ── 统计面板 ── */}
      <Row
        gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}
        style={{ marginBottom: isMobile ? 16 : 28 }}
        align="stretch"
      >
        {statCards.map((stat) => (
          <Col xs={12} sm={12} md={8} key={stat.label} style={{ display: "flex" }}>
            <div
              style={{
                background: stat.bgColor,
                borderRadius: isMobile ? 8 : 12,
                padding: isMobile ? "10px 12px" : "18px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                border: "1px solid rgba(0,0,0,0.04)",
                width: "100%",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: isMobile ? 11 : 12,
                    color: "#666",
                    marginBottom: isMobile ? 2 : 4,
                    fontWeight: 500,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {stat.label}
                </div>
                <div
                  style={{
                    fontSize: isMobile ? 22 : 28,
                    fontWeight: 700,
                    color: stat.color,
                    lineHeight: 1.2,
                  }}
                >
                  {stat.value}
                </div>
              </div>
              {!isMobile && (
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    background: stat.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 20,
                    color: "#fff",
                    flexShrink: 0,
                    opacity: 0.9,
                  }}
                >
                  {stat.icon}
                </div>
              )}
            </div>
          </Col>
        ))}
      </Row>

      {/* ── 租户用户汇总 (仅超管) ── */}
      {isSuperAdmin && (
        <Card
          size={isMobile ? "small" : "default"}
          style={{ marginBottom: isMobile ? 16 : 28, borderRadius: 12 }}
          title={
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <BankOutlined style={{ color: "#722ed1" }} />
              <Text strong>各租户用户汇总</Text>
            </div>
          }
          extra={<Text type="secondary" style={{ fontSize: 12 }}>全局总用户: {globalTotals.total}</Text>}
        >
          <Table<TenantUserCount>
            columns={tenantColumns}
            dataSource={tenantCounts}
            rowKey="schema_name"
            loading={countsLoading}
            size={isMobile ? "small" : "middle"}
            pagination={false}
            scroll={{ x: 480 }}
            summary={() => (
              <Table.Summary.Row style={{ background: "#fafafa" }}>
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
                  <Text strong style={{ color: "#1677ff" }}>{globalTotals.total}</Text>
                </Table.Summary.Cell>
              </Table.Summary.Row>
            )}
          />
        </Card>
      )}

      {/* ── 功能模块标题 ── */}
      <Title
        level={isMobile ? 5 : 4}
        style={{
          marginBottom: isMobile ? 10 : 20,
          fontSize: isMobile ? 15 : undefined,
        }}
      >
        功能模块
      </Title>

      {/* ── 功能模块卡片 ── */}
      <Row gutter={[isMobile ? 8 : 16, isMobile ? 8 : 16]}>
        {menuItems.map((item) => (
          <Col xs={12} sm={12} md={8} lg={6} key={item.path}>
            {isMobile ? (
              /* 移动端：紧凑卡片 */
              <div
                onClick={() => navigate(item.path)}
                style={{
                  background: "#fff",
                  borderRadius: 8,
                  padding: "10px 10px",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  border: "1px solid #f0f0f0",
                  transition: "all 0.15s",
                  minHeight: 48,
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: `${item.color}15`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    fontSize: 14,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#333",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    lineHeight: 1.2,
                  }}
                >
                  {item.name}
                </span>
              </div>
            ) : (
              /* 桌面端：水平卡片 */
              <div
                onClick={() => navigate(item.path)}
                style={{
                  background: "#fff",
                  borderRadius: 10,
                  padding: "16px 18px",
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  cursor: "pointer",
                  border: "1px solid #f0f0f0",
                  transition: "all 0.2s ease, transform 0.15s ease",
                  height: "100%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = item.color;
                  e.currentTarget.style.boxShadow = `0 4px 12px ${item.color}10`;
                  e.currentTarget.style.transform = "translateY(-2px)";
                  const icon = e.currentTarget.querySelector(".dash-mod-icon") as HTMLElement;
                  if (icon) icon.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#f0f0f0";
                  e.currentTarget.style.boxShadow = "none";
                  e.currentTarget.style.transform = "translateY(0)";
                  const icon = e.currentTarget.querySelector(".dash-mod-icon") as HTMLElement;
                  if (icon) icon.style.transform = "scale(1)";
                }}
              >
                <div
                  className="dash-mod-icon"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 10,
                    background: `${item.color}12`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    transition: "transform 0.2s ease",
                    fontSize: 24,
                    color: item.color,
                  }}
                >
                  {item.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#1a1a1a",
                      lineHeight: 1.3,
                      marginBottom: 2,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#999",
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {item.description}
                  </div>
                </div>
                <ArrowRightOutlined
                  style={{
                    color: "#d9d9d9",
                    fontSize: 14,
                    flexShrink: 0,
                  }}
                />
              </div>
            )}
          </Col>
        ))}
      </Row>
    </div>
  );
}
