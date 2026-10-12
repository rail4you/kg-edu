import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin } from "antd";
import { useAuth } from "./auth-context";

interface RequireRoleProps {
  /** 允许访问的角色列表 */
  roles: string[];
  children: ReactNode;
}

/**
 * 前端路由守卫（仅作补充，服务端仍会强制校验角色）。
 * - 未登录：跳登录页并带上 redirect；
 * - 角色不匹配：跳回各自工作台，避免学生进入管理端。
 */
export function RequireRole({ roles, children }: RequireRoleProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={`/login?redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  if (!roles.includes(user.role)) {
    const fallback =
      user.role === "teacher"
        ? "/teacher/dashboard"
        : user.role === "user"
          ? "/dashboard/overview"
          : "/";
    return <Navigate to={fallback} replace />;
  }

  return <>{children}</>;
}
