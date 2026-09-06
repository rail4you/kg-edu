import { useSearchParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button, Grid, Typography, Empty, Spin } from "antd";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftOutlined, MenuOutlined } from "@ant-design/icons";
import { useAuth } from "@/auth/auth-context";
import { getAuthHeaders } from "@/lib/auth";
import { getMicroMajorCourse } from "@/lib/ash_rpc";
import { UserMenu } from "@/components/layout/user-menu";
import { MobileFullMenu } from "@/components/layout/mobile-full-menu";
import GlobalFooter from "@/components/layout/global-footer";
import { useBranding } from "@/hooks/use-branding";
import { usePortalNavItems } from "@/hooks/use-portal-config";
import { themeColors as colors } from "@/styles/theme";
import StudentMMCourse from "./mm-course";

const { Text } = Typography;

export default function StudentMMCoursePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const branding = useBranding();
  const mmCourseId = searchParams.get("mmCourseId");
  const mmId = searchParams.get("mmId");
  const urlTenant = searchParams.get("tenant");
  const { user, tenant: authTenant } = useAuth();
  const tenant = urlTenant || authTenant || "";
  const headers = getAuthHeaders(user) as Record<string, string>;
  const breakpoint = Grid.useBreakpoint();
  const isMobile = !breakpoint.md;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  // 动态门户导航（固定 2 项（课程/微专业）+ 模板页（上限 6））
  const navItems = usePortalNavItems();

  const { data: course } = useQuery({
    queryKey: ["smm-ctx-course", mmCourseId],
    queryFn: async () => {
      if (!mmCourseId || !tenant) return null;
      const r = await getMicroMajorCourse({ tenant, input: { id: mmCourseId }, fields: ["id", "title", "major"], headers });
      return r.success && r.data ? (r.data as { title: string; major?: string | null }) : null;
    }, enabled: !!mmCourseId && !!tenant,
  });

  if (!mmCourseId) return <div style={{ padding: 48, textAlign: "center" }}><Empty description="缺少课程参数" /></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#F0F1F3" }}>
      {/* Header */}
      <div style={{
        height: isMobile ? 52 : 60,
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: isMobile ? "0 12px" : "0 24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        flexShrink: 0,
        zIndex: 100,
        gap: 8,
      }}>
        {/* Left: Back button */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", flexShrink: 0 }} onClick={() => navigate(`/micro-majors/${tenant}/${mmId}`)}>
          <ArrowLeftOutlined style={{ fontSize: isMobile ? 16 : 14, color: colors.textSecondary }} />
          {!isMobile && (
            <>
              <div style={{ width: 4, height: 28, borderRadius: 2, background: colors.primary, flexShrink: 0 }} />
              <img src={branding.logo_dark} alt={branding.app_name} style={{ height: 44, objectFit: "contain" }} />
              <span style={{ fontSize: 17, fontWeight: 700, color: colors.textPrimary, whiteSpace: "nowrap" }}>{branding.app_title}</span>
              <span style={{ color: "#e0e0e0", fontSize: 18 }}>|</span>
            </>
          )}
          <span style={{ color: colors.textSecondary, fontSize: isMobile ? 12 : 13, whiteSpace: "nowrap" }}>
            {isMobile ? "返回" : "返回微专业详情"}
          </span>
        </div>

        {/* Center: Course name */}
        {course && (
          <div style={{
            flex: 1,
            textAlign: isMobile ? "left" : "center",
            overflow: "hidden",
            padding: isMobile ? "0 4px" : "0",
          }}>
            <span style={{
              fontSize: isMobile ? 14 : 18,
              fontWeight: 800,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "block",
              maxWidth: "100%",
            }}>
              {course.title}
            </span>
          </div>
        )}

        {/* Right: User actions */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 4 : 10, flexShrink: 0 }}>
          {isMobile ? (
            <>
              <UserMenu role="student" variant="header" />
              <Button
                type="text"
                icon={<MenuOutlined style={{ fontSize: 18, color: colors.textPrimary }} />}
                onClick={() => setMobileMenuOpen(true)}
                aria-label="打开菜单"
              />
            </>
          ) : (
            <UserMenu role="student" variant="header" />
          )}
        </div>
      </div>

      <MobileFullMenu
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        items={navItems}
        activeKey="/micro-majors"
        sectionTitle="导航"
      />

      {/* Content */}
      <div style={{ flex: 1, padding: isMobile ? "12px" : "16px 40px" }}>
        <StudentMMCourse tenant={tenant} mmCourseId={mmCourseId} mmId={mmId || ""} headers={headers} />
      </div>

      {/* Footer */}
      <GlobalFooter />
    </div>
  );
}
