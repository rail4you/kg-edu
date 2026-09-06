import { useMemo, useState } from "react";
import { Card, Table, Space, Tag, Typography, Alert, Avatar, Tooltip, Select } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getUsersFromTenant } from "@/lib/ash_rpc";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant, hasTenant } from "@/lib/tenant";
import { useTenantFilter, ALL_TENANTS } from "@/hooks/use-tenant-filter";
import { TenantLayout } from "@/components/admin/tenant-layout";
import { MobileTableCard } from "@/components/admin/mobile-table-card";
import { useResponsive } from "@/hooks/use-responsive";

const { Text } = Typography;

// ── Role permissions (read-only display) ────────────────────────────

interface RolePermission {
  role: string;
  label: string;
  icon: string;
  color: string;
  permissions: { name: string; description: string }[];
}

const rolePermissions: RolePermission[] = [
  {
    role: "super_admin",
    label: "超级管理员",
    icon: "👑",
    color: "#eb2f96",
    permissions: [
      { name: "全局访问", description: "访问所有租户和系统功能" },
      { name: "租户管理", description: "创建、删除、管理组织租户" },
      { name: "用户管理", description: "管理所有租户下的用户账户" },
      { name: "系统配置", description: "管理 API Key、系统参数等全局配置" },
      { name: "数据库备份", description: "执行和恢复数据库备份" },
    ],
  },
  {
    role: "admin",
    label: "管理员",
    icon: "🛡️",
    color: "#faad14",
    permissions: [
      { name: "用户管理", description: "管理本租户内的管理员、教师和学生账户" },
      { name: "班级管理", description: "创建、编辑和管理班级" },
      { name: "权限管理", description: "分配和调整用户角色" },
      { name: "数据查看", description: "查看本租户的教学数据和统计" },
    ],
  },
  {
    role: "teacher",
    label: "教师",
    icon: "🎓",
    color: "#1677ff",
    permissions: [
      { name: "课程管理", description: "创建和编辑课程、章节、视频" },
      { name: "知识资源", description: "管理知识点、题库和实验" },
      { name: "考试管理", description: "创建考试、批改和统计分析" },
      { name: "作业管理", description: "布置和批改作业" },
      { name: "学生管理", description: "查看学生信息和学习进度" },
      { name: "AI 辅助", description: "使用 AI 生成习题、能力图谱等" },
      { name: "邮件通信", description: "配置邮箱和收发邮件" },
    ],
  },
  {
    role: "user",
    label: "学生",
    icon: "📚",
    color: "#52c41a",
    permissions: [
      { name: "课程学习", description: "查看课程内容、视频和资料" },
      { name: "考试参与", description: "参加在线考试和查看成绩" },
      { name: "实验操作", description: "参与实验课程和提交报告" },
      { name: "知识图谱", description: "查看个人能力图谱和学习推荐" },
      { name: "讨论交流", description: "参与课堂讨论和群组任务" },
      { name: "签到打卡", description: "课堂签到" },
    ],
  },
];

// ── Types ───────────────────────────────────────────────────────────

interface UserData {
  id: string;
  memberId: string;
  name: string;
  email?: string;
  role: string;
  _tenant?: string;
}

const roleFilterOptions = [
  { value: "all", label: "全部角色" },
  { value: "super_admin", label: "超级管理员" },
  { value: "admin", label: "管理员" },
  { value: "teacher", label: "教师" },
  { value: "user", label: "学生" },
];

const getRoleTag = (role: string) => {
  const rp = rolePermissions.find((r) => r.role === role);
  if (rp) return <Tag color={rp.color}>{rp.label}</Tag>;
  return <Tag>{role}</Tag>;
};

const getRoleIcon = (role: string) => {
  return rolePermissions.find((r) => r.role === role)?.icon || "👤";
};

// ── Component ───────────────────────────────────────────────────────

export default function PermissionsManagement() {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const { isMobile } = useResponsive();
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const {
    isSuperAdmin,
    organizations,
    tenantOptions,
    selectedTenantId,
    setSelectedTenantId,
    queryTenants,
  } = useTenantFilter("total");

  const fetchTenants = useMemo(() => {
    if (isSuperAdmin && selectedTenantId === ALL_TENANTS) {
      return [...queryTenants, "public"];
    }
    return queryTenants;
  }, [queryTenants, isSuperAdmin, selectedTenantId]);

  const { data: users, isLoading } = useQuery({
    queryKey: ["all-users-permissions", fetchTenants],
    queryFn: async () => {
      const results = await Promise.all(
        fetchTenants.map((tenant) =>
          getUsersFromTenant({
            tenant,
            fields: ["id", "memberId", "name", "email", "role"],
            headers: getAuthHeaders(user),
          }).catch(() => null),
        ),
      );
      const out: UserData[] = [];
      results.forEach((r, idx) => {
        if (!r?.success) return;
        const data = r.data as UserData[] | { results?: UserData[] };
        const items = Array.isArray(data) ? data : data?.results || [];
        for (const item of items) {
          out.push({ ...item, _tenant: fetchTenants[idx] });
        }
      });
      return out;
    },
    enabled: fetchTenants.length > 0,
  });

  const tenantNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    organizations.forEach((o) => {
      m[o.schemaName] = o.name;
    });
    if (currentTenant?.schemaName) {
      m[currentTenant.schemaName] = currentTenant.name || currentTenant.schemaName;
    }
    m["public"] = "系统租户";
    return m;
  }, [organizations, currentTenant]);

  const filteredUsers = useMemo(() => {
    const list = users || [];
    if (roleFilter === "all") return list;
    return list.filter((u) => u.role === roleFilter);
  }, [users, roleFilter]);

  const counts = useMemo(() => {
    const list = filteredUsers;
    return {
      total: list.length,
      super_admin: list.filter((u) => u.role === "super_admin").length,
      admin: list.filter((u) => u.role === "admin").length,
      teacher: list.filter((u) => u.role === "teacher").length,
      student: list.filter((u) => u.role === "user").length,
    };
  }, [filteredUsers]);

  const columns: ColumnsType<UserData> = [
    {
      title: "用户",
      key: "user",
      width: 260,
      render: (_, record) => (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Avatar size={32} style={{ backgroundColor: "#f5f5f5", color: "#1677ff", flexShrink: 0 }}>
            {getRoleIcon(record.role)}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <Text strong ellipsis style={{ display: "block", fontSize: 14 }}>
              {record.name || "未设置姓名"}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }} ellipsis>
              {record.memberId || "-"}
              {record.email && ` · ${record.email}`}
            </Text>
          </div>
        </div>
      ),
    },
    {
      title: "租户",
      dataIndex: "_tenant",
      key: "tenant",
      width: 140,
      render: (tenant) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {tenantNameMap[tenant] || tenant || "-"}
        </Text>
      ),
    },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      width: 120,
      align: "center",
      render: (role) => getRoleTag(role),
    },
    {
      title: "拥有权限",
      key: "permissions",
      render: (_, record) => {
        const rp = rolePermissions.find((r) => r.role === record.role);
        if (!rp) return <Text type="secondary" style={{ fontSize: 14 }}>—</Text>;
        return (
          <Space size={[4, 6]} wrap>
            {rp.permissions.map((perm) => (
              <Tooltip key={perm.name} title={perm.description}>
                <Tag style={{ cursor: "default", fontSize: 13, padding: "2px 8px" }}>
                  {perm.name}
                </Tag>
              </Tooltip>
            ))}
          </Space>
        );
      },
    },
  ];

  if (!hasTenant()) {
    return (
      <Card>
        <Alert
          message="需要选择组织"
          description="请先在组织管理页面选择一个组织，然后返回此页面查看用户权限。"
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
      {/* ── User list ── */}
      <Card styles={{ body: { padding: isMobile ? 12 : 20 } }}>
        <div style={{ marginBottom: isMobile ? 12 : 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <Text strong style={{ fontSize: isMobile ? 14 : 16 }}>
              用户列表
            </Text>
            <Select
              value={roleFilter}
              onChange={setRoleFilter}
              options={roleFilterOptions}
              style={{ width: 150 }}
              size={isMobile ? "small" : "middle"}
            />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isSuperAdmin && (
              <Tag color="purple" style={{ marginRight: 4 }}>
                全局汇总（{fetchTenants.length} 个租户）
              </Tag>
            )}
            <Tag>总用户数: {counts.total}</Tag>
            <Tag>管理员: {counts.admin}</Tag>
            <Tag>教师: {counts.teacher}</Tag>
            <Tag>学生: {counts.student}</Tag>
            <Tag>超管: {counts.super_admin}</Tag>
          </div>
        </div>

        {!isMobile && (
          <Table
            columns={columns}
            dataSource={filteredUsers}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 700 }}
            pagination={{
              showSizeChanger: true,
              showTotal: (total) => `共 ${total} 条`,
              defaultPageSize: 10,
              size: "small",
            }}
          />
        )}

        {isMobile && (
          <MobileTableCard<UserData>
            dataSource={filteredUsers}
            loading={isLoading}
            title={(r) => r.name}
            subtitle={(r) => `${r.memberId}${r.email ? ` · ${r.email}` : ""}`}
            extra={(r) => getRoleTag(r.role)}
            fields={(r) => {
              const rp = rolePermissions.find((p) => p.role === r.role);
              return [
                { label: "租户", value: tenantNameMap[r._tenant!] || r._tenant || "-" },
                ...(rp
                  ? [
                      {
                        label: "权限",
                        value: (
                          <Space size={4} wrap>
                            {rp.permissions.slice(0, 3).map((p) => (
                              <Tag key={p.name} style={{ fontSize: 11, padding: "0 4px" }}>
                                {p.name}
                              </Tag>
                            ))}
                            {rp.permissions.length > 3 && (
                              <Tag style={{ fontSize: 11, padding: "0 4px" }}>
                                +{rp.permissions.length - 3}
                              </Tag>
                            )}
                          </Space>
                        ),
                      },
                    ]
                  : []),
              ];
            }}
          />
        )}
      </Card>
    </div>
    </TenantLayout>
  );
}
