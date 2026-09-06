import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getCurrentTenant } from "@/lib/tenant";
import { listOrganizations, getTenantUserCounts } from "@/lib/ash_rpc";

export const ALL_TENANTS = "__all__";

export type TenantCountKey = "total" | "super_admin" | "admin" | "teacher" | "student" | "classes" | "groups";

interface TenantOption {
  value: string;
  label: string;
}

/**
 * 管理端租户过滤 hook。
 * - 超级管理员：展示租户选择（含"全部租户"），租户名后显示指定角色数量（countKey）
 * - 普通管理员：无选择器，仅返回当前租户
 */
export function useTenantFilter(countKey: TenantCountKey = "total") {
  const { user } = useAuth();
  const currentTenant = getCurrentTenant();
  const isSuperAdmin = user?.role === "super_admin";
  const [selectedTenantId, setSelectedTenantId] = useState<string>(ALL_TENANTS);

  const { data: orgsResponse } = useQuery({
    queryKey: ["organizations"],
    queryFn: () =>
      listOrganizations({
        fields: ["id", "name", "schemaName"],
        page: { limit: 100, offset: 0 },
        headers: getAuthHeaders(user),
      }),
    enabled: isSuperAdmin,
  });

  const { data: countsResponse } = useQuery({
    queryKey: ["tenant-user-counts"],
    queryFn: () => getTenantUserCounts({ headers: getAuthHeaders(user) }),
    enabled: isSuperAdmin,
  });

  const organizations = useMemo(() => {
    if (!orgsResponse?.success) return [];
    const data = Array.isArray(orgsResponse.data)
      ? orgsResponse.data
      : ((orgsResponse.data as Record<string, unknown>)?.results as Array<
          Record<string, unknown>
        >) || [];
    return data.map((o) => ({
      id: o.id as string,
      name: o.name as string,
      schemaName: o.schemaName as string,
    }));
  }, [orgsResponse]);

  const userCounts = useMemo(() => {
    if (!countsResponse?.success || !countsResponse.data) return {} as Record<string, Record<string, number>>;
    const data = countsResponse.data as {
      tenants?: Array<{
        schema_name: string;
        total: number;
        super_admin: number;
        admin: number;
        teacher: number;
        student: number;
        classes?: number;
        groups?: number;
      }>;
    };
    const tenants = data.tenants;
    if (!tenants) return {} as Record<string, Record<string, number>>;
    return tenants.reduce((acc, t) => {
      acc[t.schema_name] = {
        total: t.total,
        super_admin: t.super_admin,
        admin: t.admin,
        teacher: t.teacher,
        student: t.student,
        classes: t.classes ?? 0,
        groups: t.groups ?? 0,
      };
      return acc;
    }, {} as Record<string, Record<string, number>>);
  }, [countsResponse]);

  const tenantOptions = useMemo<TenantOption[]>(() => {
    if (!isSuperAdmin) return [];
    return [
      { value: ALL_TENANTS, label: "全部租户" },
      ...organizations.map((o) => ({
        value: o.schemaName,
        label: `${o.name} (${userCounts[o.schemaName]?.[countKey] ?? 0})`,
      })),
    ];
  }, [isSuperAdmin, organizations, userCounts, countKey]);

  const defaultTenant = currentTenant?.schemaName || currentTenant?.id;

  const queryTenants = useMemo(() => {
    if (!isSuperAdmin) return defaultTenant ? [defaultTenant] : [];
    if (selectedTenantId === ALL_TENANTS) return organizations.map((o) => o.schemaName);
    return selectedTenantId ? [selectedTenantId] : [];
  }, [isSuperAdmin, selectedTenantId, organizations, defaultTenant]);

  return {
    isSuperAdmin,
    organizations,
    tenantOptions,
    selectedTenantId,
    setSelectedTenantId,
    queryTenants,
    defaultTenant,
  };
}
