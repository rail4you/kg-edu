import { useState, useMemo } from "react";
import { Form, Input, Button, message, Modal, Layout, Typography, List, Tooltip, Grid } from "antd";
import {
  UserOutlined,
  LockOutlined,
  TeamOutlined,
  PhoneOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/auth/auth-context";
import { setCurrentTenant } from "@/lib/tenant";
import { usePageTitle } from "@/hooks/use-page-title";
import { useBranding } from "@/hooks/use-branding";
import GlobalFooter from "@/components/layout/global-footer";
import { themeColors } from "@/styles/theme";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

/** 登录页品牌 Logo + 标题 */
function LoginBrandSection() {
  const branding = useBranding();
  return (
    <>
      <img src={branding.logo_dark} alt={branding.app_name} style={{ height: 44, objectFit: "contain" }} />
    </>
  );
}

interface MatchedTenant {
  tenantId: string;
  tenantName: string;
  schemaName: string;
}

type RoleType = "student" | "teacher" | "admin";
type LoginMode = "username" | "phone";

const colors = {
  primary: themeColors.primary,        // "#2573E6"
  primaryLight: themeColors.primaryHover, // "#1D5FCC"
  accent: "#D4A843",
  navBg: themeColors.navBg,
};

interface RoleConfig {
  key: RoleType;
  label: string;
  subtitle: string;
  backendRoles: string[];
  redirectPath: string;
}

const roleConfigs: Record<RoleType, RoleConfig> = {
  student: {
    key: "student",
    label: "学生登录",
    subtitle: "输入学号和密码，开始学习之旅",
    backendRoles: ["user"],
    redirectPath: "/",
  },
  teacher: {
    key: "teacher",
    label: "教师登录",
    subtitle: "输入教职工号和密码，进入教学管理",
    backendRoles: ["teacher"],
    redirectPath: "/teacher/module-home",
  },
  admin: {
    key: "admin",
    label: "管理员登录",
    subtitle: "输入管理员账号和密码，进入系统管理",
    backendRoles: ["admin", "super_admin"],
    redirectPath: "/admin/dashboard",
  },
};

async function callFindUserTenants(memberId: string, password: string): Promise<{ success: boolean; data?: any; errors?: any[] }> {
  const response = await fetch("/api/session/find-tenants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberId, password }),
  });

  if (!response.ok) {
    return {
      success: false,
      errors: [{ type: "network", message: response.statusText, details: {} }],
    };
  }

  return response.json();
}

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const screens = Grid.useBreakpoint();
  usePageTitle();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("username");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [tenantModalVisible, setTenantModalVisible] = useState(false);
  const [matchedTenants, setMatchedTenants] = useState<MatchedTenant[]>([]);
  const [pendingCredentials, setPendingCredentials] = useState<{ memberId: string; password: string } | null>(null);

  const roleParam = searchParams.get("role") as RoleType | null;
  const redirectParam = searchParams.get("redirect");
  const roleConfig = useMemo(() => {
    if (roleParam && roleConfigs[roleParam]) {
      return roleConfigs[roleParam];
    }
    return null;
  }, [roleParam]);
  const isMobile = !screens.md;
  const otherRoles = roleConfig
    ? (["student", "teacher", "admin"] as RoleType[]).filter((r) => r !== roleConfig.key)
    : [];

  // 计算登录成功后的跳转路径：优先使用 redirect 参数，否则使用 roleConfig 的默认路径
  const getRedirectPath = () => {
    if (redirectParam) {
      return redirectParam;
    }
    return roleConfig?.redirectPath || "/dashboard";
  };

  const handleLoginWithTenant = async (tenant: MatchedTenant) => {
    if (!pendingCredentials) return;
    setTenantModalVisible(false);
    setLoading(true);

    try {
      setCurrentTenant({
        id: tenant.tenantId,
        name: tenant.tenantName,
        schemaName: tenant.schemaName,
      });

      const user = await login(
        pendingCredentials.memberId,
        pendingCredentials.password,
        tenant.schemaName,
        tenant.tenantId,
      );

      if (roleConfig && roleConfig.backendRoles.length > 0 && !roleConfig.backendRoles.includes(user.role)) {
        message.error(`您不是${roleConfig.label}，请重新选择角色登录`);
        return;
      }

      message.success("登录成功！");
      navigate(getRedirectPath());
    } catch (error: any) {
      const msg = error.message || "登录失败，请检查用户名和密码";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: { memberId: string; password: string }) => {
    setLoading(true);
    setErrorMsg("");

    try {
      const result = await callFindUserTenants(values.memberId, values.password);

      if (!result.success) {
        const errorMsg = result.errors?.[0]?.message || "登录失败";
        setErrorMsg(errorMsg);
        message.error(errorMsg);
        setLoading(false);
        return;
      }

      const tenants = result.data?.tenants || [];

      if (tenants.length === 0) {
        const errorMsg = "未找到对应的组织，请确认账号密码是否正确";
        setErrorMsg(errorMsg);
        message.error(errorMsg);
        setLoading(false);
        return;
      }

      if (tenants.length === 1) {
        const tenant = tenants[0];
        setCurrentTenant({
          id: tenant.tenantId,
          name: tenant.tenantName,
          schemaName: tenant.schemaName,
        });

        const user = await login(values.memberId, values.password, tenant.schemaName, tenant.tenantId);

        if (roleConfig && roleConfig.backendRoles.length > 0 && !roleConfig.backendRoles.includes(user.role)) {
          message.error(`您不是${roleConfig.label}，请重新选择角色登录`);
          setLoading(false);
          return;
        }

        message.success("登录成功！");
        navigate(getRedirectPath());
      } else {
        setMatchedTenants(tenants);
        setPendingCredentials({ memberId: values.memberId, password: values.password });
        setTenantModalVisible(true);
      }
    } catch (error: any) {
      const msg = error.message || "登录失败，请检查用户名和密码";
      setErrorMsg(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLoginModeChange = (mode: LoginMode) => {
    setLoginMode(mode);
    setErrorMsg("");
    form.setFieldsValue({ memberId: undefined });
  };

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {/* Header */}
      <Header
        style={{
          background: colors.navBg || themeColors.navBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "0 16px" : "0 48px",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          height: 56,
          lineHeight: "56px",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
          onClick={() => navigate("/")}
        >
          <LoginBrandSection />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "0 14px",
              height: 32,
              lineHeight: "32px",
              background: "rgba(255, 255, 255, 0.08)",
              border: "1px solid rgba(255, 255, 255, 0.28)",
              textDecoration: "none",
              fontSize: 13,
              fontWeight: 500,
              color: "rgba(255, 255, 255, 0.92)",
              borderRadius: 6,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.16)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.42)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.28)";
            }}
          >
            返回首页
          </Link>
        </div>
      </Header>

      <Content
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: isMobile ? "16px 12px 24px" : "24px 8px",
          background: "linear-gradient(180deg, #F7FAFF 0%, #FFFFFF 40%)",
        }}
      >
        {/* 角色选择卡片 */}
        {!roleConfig && (
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              width: "100%",
              maxWidth: 960,
              background: "#FFFFFF",
              borderRadius: isMobile ? 18 : 16,
              overflow: "hidden",
              boxShadow: isMobile ? "0 12px 32px rgba(37,115,230,0.12)" : "0 4px 24px rgba(0,0,0,0.1)",
            }}
          >
            {/* 左侧图片 */}
            <div
              style={{
                flex: isMobile ? "0 0 180px" : "0 0 50%",
                position: "relative",
              }}
            >
              <img
                src="/assets/login-hero.png"
                alt="education"
                style={{
                  width: "100%",
                  height: isMobile ? 180 : "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              {isMobile && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(12,32,61,0.1) 0%, rgba(12,32,61,0.6) 100%)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 18,
                  }}
                >
                  <div>
                    <div style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                      选择你的入口
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 13 }}>
                      学生、教师、管理员分角色登录
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧角色选择 */}
            <div
              style={{
                flex: 1,
                padding: isMobile ? 18 : 28,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <Title level={isMobile ? 4 : 3} style={{ color: colors.primary, marginBottom: 6, textAlign: "center" }}>
                选择登录角色
              </Title>
              <Text style={{ color: "#666", fontSize: 13, display: "block", marginBottom: 16, textAlign: "center" }}>
                请选择您的身份进入对应的登录页面
              </Text>

              <div style={{ display: "flex", flexDirection: "column", gap: isMobile ? 10 : 6 }}>
                {(["student", "teacher", "admin"] as RoleType[]).map((role) => {
                  const config = roleConfigs[role];
                  return (
                    <div
                      key={role}
                      onClick={() => {
                        const params = new URLSearchParams();
                        params.set("role", role);
                        if (redirectParam) params.set("redirect", redirectParam);
                        navigate(`/login?${params.toString()}`);
                      }}
                      style={{
                        padding: isMobile ? "14px 16px" : 16,
                        background: "#FFFFFF",
                        borderRadius: 14,
                        boxShadow: isMobile ? "0 8px 18px rgba(15,23,42,0.08)" : "0 2px 8px rgba(0,0,0,0.06)",
                        cursor: "pointer",
                        transition: "all 0.3s ease",
                        border: "1px solid #E8E8E8",
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                      }}
                      onMouseEnter={(e) => {
                        if (isMobile) return;
                        e.currentTarget.style.borderColor = colors.primary;
                        e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,102,204,0.15)`;
                        e.currentTarget.style.transform = "translateX(6px)";
                      }}
                      onMouseLeave={(e) => {
                        if (isMobile) return;
                        e.currentTarget.style.borderColor = "#E8E8E8";
                        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.06)";
                        e.currentTarget.style.transform = "translateX(0)";
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 10,
                          background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <TeamOutlined style={{ fontSize: 20, color: "#FFFFFF" }} />
                      </div>
                      <div>
                        <Title level={5} style={{ margin: "0 0 2px", color: "#1F1F1F" }}>
                          {config.label}
                        </Title>
                        <Text style={{ color: "#666", fontSize: isMobile ? 13 : 12 }}>
                          {config.subtitle}
                        </Text>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 登录表单 */}
        {roleConfig && (
          <div
            style={{
              display: "flex",
              flexDirection: isMobile ? "column" : "row",
              width: "100%",
              maxWidth: 860,
              background: "#FFFFFF",
              borderRadius: isMobile ? 18 : 16,
              overflow: "hidden",
              boxShadow: isMobile ? "0 12px 32px rgba(37,115,230,0.12)" : "0 4px 24px rgba(0,0,0,0.1)",
            }}
          >
            {/* 左侧图片 */}
            <div
              style={{
                flex: isMobile ? "0 0 180px" : "0 0 45%",
                position: "relative",
              }}
            >
              <img
                src="/assets/login-hero.png"
                alt="education"
                style={{
                  width: "100%",
                  height: isMobile ? 180 : "100%",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              {isMobile && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    left: 0,
                    inset: 0,
                    background: "linear-gradient(180deg, rgba(12,32,61,0.08) 0%, rgba(12,32,61,0.62) 100%)",
                    display: "flex",
                    alignItems: "flex-end",
                    padding: 18,
                  }}
                >
                  <div>
                    <div style={{ color: "#FFFFFF", fontSize: 20, fontWeight: 700, marginBottom: 4 }}>
                      {roleConfig.label}
                    </div>
                    <div style={{ color: "rgba(255,255,255,0.88)", fontSize: 13 }}>
                      {roleConfig.subtitle}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 右侧表单 */}
            <div
              style={{
                flex: 1,
                padding: isMobile ? 18 : 24,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              {/* 登录标题 */}
              <div style={{ textAlign: "center", marginBottom: isMobile ? 16 : 12, display: isMobile ? "none" : "block" }}>
                <Title level={4} style={{ margin: "0 0 4px", color: "#1F1F1F" }}>
                  {roleConfig.label}
                </Title>
                <Text style={{ color: "#666", fontSize: 12 }}>
                  {roleConfig.subtitle}
                </Text>
              </div>

              {/* 登录模式切换 */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", background: "#F5F7FA", borderRadius: 10, padding: 3 }}>
                  {[
                    { key: "username" as LoginMode, label: "用户名登录" },
                    { key: "phone" as LoginMode, label: "手机号登录" },
                  ].map((mode) => (
                    <div
                      key={mode.key}
                      onClick={() => handleLoginModeChange(mode.key)}
                      style={{
                        flex: 1,
                        textAlign: "center",
                        padding: isMobile ? "10px 12px" : "8px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: loginMode === mode.key ? "#FFFFFF" : "transparent",
                        boxShadow: loginMode === mode.key ? "0 1px 4px rgba(0,0,0,0.08)" : "none",
                        transition: "all 0.2s ease",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: isMobile ? 14 : 13,
                          fontWeight: loginMode === mode.key ? 600 : 400,
                          color: loginMode === mode.key ? colors.primary : "#666",
                        }}
                      >
                        {mode.label}
                      </Text>
                    </div>
                  ))}
                </div>
              </div>

              {/* 错误提示 */}
              {errorMsg && (
                <div
                  style={{
                    marginBottom: 12,
                    padding: "10px 12px",
                    background: "#FFF2F0",
                    border: "1px solid #FFCCC7",
                    borderRadius: 8,
                    color: "#CF1322",
                    fontSize: 13,
                  }}
                >
                  {errorMsg}
                </div>
              )}

              {/* 表单 */}
              <Form form={form} onFinish={onFinish} layout="vertical">
                <Form.Item
                  name="memberId"
                  rules={[
                    { required: true, message: loginMode === "username" ? "请输入用户名" : "请输入手机号" },
                    ...(loginMode === "phone"
                      ? [{ pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号格式" }]
                      : []),
                  ]}
                >
                  <Input
                    prefix={loginMode === "username" ? <UserOutlined style={{ color: "#999" }} /> : <PhoneOutlined style={{ color: "#999" }} />}
                    placeholder={loginMode === "username" ? "请输入用户名" : "请输入手机号"}
                    size="large"
                    maxLength={loginMode === "phone" ? 11 : undefined}
                    style={{ borderRadius: 12, height: isMobile ? 46 : undefined }}
                  />
                </Form.Item>

                <Form.Item
                  name="password"
                  rules={[
                    { required: true, message: "请输入密码" },
                    { min: 6, message: "密码长度不能少于6位" },
                  ]}
                  help="密码长度至少6位"
                >
                  <Input.Password
                    prefix={<LockOutlined style={{ color: "#999" }} />}
                    placeholder="请输入密码"
                    size="large"
                    style={{ borderRadius: 12, height: isMobile ? 46 : undefined }}
                  />
                </Form.Item>

                <Form.Item style={{ marginTop: 12, marginBottom: 0 }}>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    size="large"
                    loading={loading}
                    style={{
                      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryLight} 100%)`,
                      border: "none",
                      borderRadius: 12,
                      height: isMobile ? 46 : 44,
                      fontSize: 15,
                      fontWeight: 600,
                      boxShadow: "0 4px 16px rgba(0,102,204,0.3)",
                    }}
                  >
                    登 录
                  </Button>
                </Form.Item>
              </Form>

              {/* 返回选择角色 */}
              <div style={{ textAlign: "center", marginTop: 12 }}>
                <Link to={redirectParam ? `/login?redirect=${encodeURIComponent(redirectParam)}` : "/login"} style={{ color: "#999", fontSize: 12 }}>
                  ← 返回选择角色
                </Link>
              </div>

              {/* 切换角色 */}
              {isMobile ? (
                <div style={{ marginTop: 14 }}>
                  <div style={{ textAlign: "center", color: "#999", fontSize: 12, marginBottom: 10 }}>
                    切换到其他角色
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {otherRoles.map((r) => (
                      <Link
                        key={r}
                        to={`/login?role=${r}${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ""}`}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 999,
                          border: "1px solid rgba(37,115,230,0.18)",
                          background: "#F7FAFF",
                          color: colors.primary,
                          fontSize: 13,
                          fontWeight: 500,
                          textDecoration: "none",
                        }}
                      >
                        {roleConfigs[r].label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: "center", marginTop: 8 }}>
                  <Tooltip
                    title={
                      <div>
                        <div style={{ marginBottom: 4 }}>选择其他登录角色：</div>
                        {otherRoles.map((r) => (
                          <div key={r}>
                            <Link to={`/login?role=${r}${redirectParam ? `&redirect=${encodeURIComponent(redirectParam)}` : ""}`} style={{ color: "#fff" }}>
                              {roleConfigs[r].label}
                            </Link>
                          </div>
                        ))}
                      </div>
                    }
                    placement="bottom"
                  >
                    <span style={{ color: "#999", fontSize: 12, cursor: "pointer" }}>
                      切换角色 <QuestionCircleOutlined style={{ marginLeft: 4 }} />
                    </span>
                  </Tooltip>
                </div>
              )}
            </div>
          </div>
        )}
      </Content>

      <GlobalFooter />

      {/* 组织选择弹窗 */}
      <Modal
        title="选择组织"
        open={tenantModalVisible}
        onCancel={() => {
          setTenantModalVisible(false);
          setPendingCredentials(null);
        }}
        footer={null}
        width={isMobile ? "calc(100vw - 24px)" : 400}
      >
        <p style={{ color: "#666", marginBottom: 16 }}>您的账号存在于多个组织中，请选择要登录的组织：</p>
        <List
          dataSource={matchedTenants}
          renderItem={(tenant) => (
            <List.Item
              style={{ cursor: "pointer", padding: "12px 16px", borderRadius: 8 }}
              onClick={() => handleLoginWithTenant(tenant)}
            >
              <List.Item.Meta title={tenant.tenantName || tenant.schemaName} />
            </List.Item>
          )}
        />
      </Modal>
    </Layout>
  );
}
